/* =============================================================================
 * MODEL · store.js
 * "appState" — regras de negócio (cálculo de progresso, getters da árvore
 * projeto/célula/robô) e persistência granular no Firestore.
 * Depende de: data.js (state, getUUID) e firebase.js (canEdit, isOwner, globals).
 * ========================================================================== */

const appState = {
    // S-09: log append-only em subcoleção própria (protegida por rules: sem update/delete).
    addLog(msg) {
        const wref = this._wsRef(); if (!wref) return;
        let ts; try { ts = firebase.firestore.FieldValue.serverTimestamp(); } catch(e){ ts = null; }
        wref.collection('logs').add({
            msg: msg,
            ts: ts,
            tsLocal: new Date().toLocaleString('pt-BR'),
            by: window.currentUserId || null,
            byName: window.currentUserName || null
        }).catch(e => console.error('[RoboTrack] addLog', e && e.message));
    },
    // Notificações in-app: 1 doc por pessoa-alvo (endereçadas por NOME, como os
    // assignees). Nunca notifica o próprio autor e nunca pode quebrar um save —
    // por isso o catch silencioso (ex.: regras ainda não publicadas).
    notify(targets, type, msg, ctx) {
        const wref = this._wsRef(); if (!wref) return;
        const me = window.currentUserName;
        const uniq = [...new Set((targets || []).filter(n => n && n !== 'Não Atribuído' && n !== me))];
        if (!uniq.length) return;
        let ts; try { ts = firebase.firestore.FieldValue.serverTimestamp(); } catch(e){ ts = null; }
        uniq.forEach(target => {
            wref.collection('notifications').add({
                target, type, msg,
                byName: me || null,
                ts, tsLocal: new Date().toLocaleString('pt-BR'),
                read: false,
                ctx: ctx || null
            }).catch(e => console.warn('[RoboTrack] notify', e && e.message));
        });
    },
    load() { /* Firebase onSnapshot handles data loading */ },
    // --- Persistência granular (S-04/S-05): 1 documento por projeto ---
    _wsRef() {
        const _db = window._fbDB, _auth = window._fbAuth;
        if (!_db || !_auth || !_auth.currentUser) { console.warn('[RoboTrack] Firebase/usuário não pronto.'); return null; }
        if (!canEdit()) { console.warn('[RoboTrack] gravação ignorada: somente leitura.'); return null; }
        return _db.collection('workspaces').doc(window.currentWsId || _auth.currentUser.uid);
    },
    // Honestidade do estado: 'saving' | 'saved' | 'error'. A cor vem da classe,
    // o ícone do sprite — nada de emoji, que não aceita `color`.
    _IND: { saving: ['clock', 'Salvando…'], saved: ['check-circle', 'Salvo'], error: ['x-circle', 'Erro ao salvar'] },
    _ind(stateName, keep) {
        const i = document.getElementById('save-indicator'); if (!i) return;
        const [ico, txt] = this._IND[stateName] || this._IND.saved;
        i.dataset.state = stateName;
        i.innerHTML = icon(ico) + '<span>' + txt + '</span>';
        i.style.opacity = '1';
        if (!keep) setTimeout(() => { i.style.opacity = '0'; }, 2000);
    },
    _saveErr(e) { console.error('[RoboTrack] ERRO AO SALVAR:', e && e.code, e && e.message); alert('ERRO ao salvar: ' + (e && e.message) + '\n\nVerifique as regras do Firestore.'); this._ind('error', true); },
    // Grava UM projeto (documento próprio) — concorrência isolada por projeto.
    saveProject(pid) {
        const wref = this._wsRef(); if (!wref) return;
        const p = this.getProject(pid); if (!p) return;
        if (p._ord == null) p._ord = Date.now();
        this._ind('saving', true);
        wref.collection('projects').doc(pid).set({
            name: p.name, cells: p.cells || [], _ord: p._ord,
            _updatedBy: window.currentUserName || '', _updatedAt: new Date().toISOString()
        }).then(() => this._ind('saved')).catch(e => this._saveErr(e));
    },
    deleteProjectDoc(pid) {
        const wref = this._wsRef(); if (!wref) return;
        wref.collection('projects').doc(pid).delete().catch(e => this._saveErr(e));
    },
    // Grava configurações do workspace (nome, templates, responsáveis, logs).
    saveSettings() {
        const wref = this._wsRef(); if (!wref) return;
        this._ind('saving', true);
        wref.set({
            ownerUid: window.currentWsId || (window._fbAuth.currentUser && window._fbAuth.currentUser.uid),
            name: state.wsName || 'Meu Workspace',
            defaultTasks: state.defaultTasks, responsibles: state.responsibles,
            _updatedAt: new Date().toISOString()
        }, { merge: true }).then(() => this._ind('saved')).catch(e => this._saveErr(e));
    },
    save() { this.saveSettings(); }, // compat: chamadas genéricas gravam as configurações
    getProject(pid) { return state.projects.find(p => p.id === pid); },
    getCell(pid, cid) {
        const p = this.getProject(pid);
        return p ? p.cells.find(c => c.id === cid) : null;
    },
    getRobot(pid, cid, rid) {
        const c = this.getCell(pid, cid);
        return c ? c.robots.find(r => r.id === rid) : null;
    },
    calcRobotProgress(robot) {
        if(!robot.tasks || robot.tasks.length === 0) return 0;
        let tWeight = 0, cPoints = 0, validTasksCount = 0;
        robot.tasks.forEach(t => {
            if(t.status.includes("N/A")) return;
            validTasksCount++;
            tWeight += (t.weight||1)*100;
            cPoints += (t.weight||1)*(t.progress||0);
        });
        if(validTasksCount === 0 && robot.tasks.length > 0) return 100;
        return tWeight === 0 ? 0 : Math.round((cPoints / tWeight) * 100);
    },
    calcCellProgress(cell) {
        if(!cell.robots || cell.robots.length === 0) return 0;
        let sum = 0;
        cell.robots.forEach(r => sum += this.calcRobotProgress(r));
        return Math.round(sum / cell.robots.length);
    },
    calcProjectProgress(project) {
        if(!project.cells || project.cells.length === 0) return 0;
        let sum = 0;
        project.cells.forEach(c => sum += this.calcCellProgress(c));
        return Math.round(sum / project.cells.length);
    },
    getStatusStyle(val) {
        if(val === "Concluído") return "concluido";
        if(val === "Em Andamento") return "andamento";
        if(val === "N/A") return "na";
        return "pendente";
    },
    exportBackup() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const a = document.createElement('a'); a.download = "RoboTrack_Database.json"; a.href = dataStr; a.click();
    },
    factoryReset() {
        if (!isOwner()) { alert('Apenas o dono do workspace pode apagá-lo.'); return; }
        if(confirm("Você DELETARÁ absolutamente TODAS as células e robôs deste workspace! Continuar?")) {
            const _db = window._fbDB, ws = window._fbAuth.currentUser.uid;
            const wref = _db.collection('workspaces').doc(ws);
            const batch = _db.batch();
            (state.projects || []).forEach(p => batch.delete(wref.collection('projects').doc(p.id)));
            batch.delete(wref);
            batch.commit().then(()=>{ location.reload(); }).catch(e=>{ alert('Erro ao apagar: ' + e.message); });
        }
    }
};
