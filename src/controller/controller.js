/* =============================================================================
 * CONTROLLER · controller.js
 * Intermediário: eventos do usuário (uiActions), roteamento (nav), autenticação
 * e a ponte View<->Model (_reRender / onAuthStateChanged). Muta o Model e manda
 * a View redesenhar. Depende de todos os outros módulos.
 * ========================================================================== */

        // uiPrompt: modal de input que substitui o prompt() nativo (bloqueado no Brave
        // e outros). Resolve com a string digitada no OK, ou null no Cancelar/Esc.
        function uiPrompt(title, desc, value) {
            return new Promise(resolve => {
                const ov = document.getElementById('modal-prompt');
                document.getElementById('prompt-title').textContent = title || '';
                const d = document.getElementById('prompt-desc');
                d.textContent = desc || ''; d.style.display = desc ? 'block' : 'none';
                const inp = document.getElementById('prompt-input');
                const ok = document.getElementById('prompt-ok'), cancel = document.getElementById('prompt-cancel');
                inp.value = value || '';
                ov.classList.add('active');
                setTimeout(() => { inp.focus(); inp.select(); }, 30);
                function done(val) {
                    ov.classList.remove('active');
                    ok.onclick = cancel.onclick = inp.onkeydown = ov.onclick = null;
                    resolve(val);
                }
                ok.onclick = () => done(inp.value);
                cancel.onclick = () => done(null);
                ov.onclick = e => { if (e.target === ov) done(null); }; // clicar no fundo cancela
                inp.onkeydown = e => {
                    if (e.key === 'Enter') { e.preventDefault(); done(inp.value); }
                    else if (e.key === 'Escape') { e.preventDefault(); done(null); }
                };
            });
        }

        const uiActions = {
            setFilter(f, btnNode) {
                currentTaskFilter = f;
                if(btnNode) {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btnNode.classList.add('active');
                }
                ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
            },
            openLogsModal() {
                const list = document.getElementById('logs-list');
                list.innerHTML = "<i>Carregando...</i>";
                document.getElementById('modal-logs').classList.add('active');
                const _db = window._fbDB, ws = window.currentWsId;
                if (!_db || !ws) { list.innerHTML = "<i>Indisponível.</i>"; return; }
                _db.collection('workspaces').doc(ws).collection('logs').orderBy('ts', 'desc').limit(200).get()
                    .then(snap => {
                        if (snap.empty) { list.innerHTML = "<i>Nenhum registro.</i>"; return; }
                        list.innerHTML = snap.docs.map(doc => {
                            const l = doc.data();
                            const when = l.tsLocal || (l.ts && l.ts.toDate ? l.ts.toDate().toLocaleString('pt-BR') : '');
                            const who = l.byName ? ' — ' + sanitize(l.byName) : '';
                            return `<div style="background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; font-size:0.8rem; display:flex; gap:12px;"><span style="color:var(--accent); white-space:nowrap;">[${sanitize(when)}]</span><span>${sanitize(l.msg)}${who}</span></div>`;
                        }).join('');
                    })
                    .catch(e => { list.innerHTML = "<i>Erro ao carregar registros: " + sanitize(e.message) + "</i>"; });
            },
            openInviteModal() {
                document.getElementById('inp-invite-email').value = '';
                document.getElementById('sel-invite-role').value = 'view';
                document.getElementById('invite-link-wrap').style.display = 'none';
                document.getElementById('invite-form-wrap').style.display = 'block';
                document.getElementById('modal-invite').classList.add('active');
                this.loadTeam();
            },
            // Gestão de equipe do MEU workspace: membros + convites pendentes
            async loadTeam() {
                const _db = window._fbDB, _user = window._fbAuth && window._fbAuth.currentUser;
                const mEl = document.getElementById('ws-members-list');
                const iEl = document.getElementById('ws-invites-list');
                if (!_db || !_user) return;
                try {
                    const ms = await _db.collection('workspaces').doc(_user.uid).collection('members').get();
                    mEl.innerHTML = ms.empty ? '<i style="color:var(--text-muted); font-size:0.8rem;">Só você por enquanto.</i>' :
                        ms.docs.map(d => { const m = d.data(); return `
                        <div class="team-row">
                            <span class="team-mail">${sanitize(m.email || d.id)}</span>
                            <select onchange="uiActions.setMemberRole('${d.id}', this.value)" style="width:auto; margin:0; font-size:0.78rem;">
                                <option value="view" ${m.role==='view'?'selected':''}>Somente ver</option>
                                <option value="edit" ${m.role==='edit'?'selected':''}>Ver e editar</option>
                            </select>
                            <button class="btn-icon" style="color:var(--danger)" title="Remover do workspace" onclick="uiActions.removeMember('${d.id}')">🗑️</button>
                        </div>`; }).join('');
                } catch(e) { mEl.innerHTML = '<i style="color:var(--danger); font-size:0.8rem;">Erro ao listar membros: ' + sanitize(e.message) + '</i>'; }
                try {
                    const inv = await _db.collection('invites').where('createdBy', '==', _user.uid).get();
                    const pend = inv.docs.filter(d => !d.data().used);
                    iEl.innerHTML = !pend.length ? '<i style="color:var(--text-muted); font-size:0.8rem;">Nenhum convite pendente.</i>' :
                        pend.map(d => { const v = d.data(); const exp = v.expiresAt ? new Date(v.expiresAt).toLocaleDateString('pt-BR') : '—'; return `
                        <div class="team-row">
                            <span class="team-mail">${sanitize(v.email)} <small style="color:var(--text-muted)">(${v.role==='edit'?'editar':'ver'} · expira ${exp})</small></span>
                            <button class="btn-icon" style="color:var(--danger)" title="Revogar convite" onclick="uiActions.revokeInvite('${d.id}')">🗑️</button>
                        </div>`; }).join('');
                } catch(e) { iEl.innerHTML = '<i style="color:var(--danger); font-size:0.8rem;">Erro ao listar convites: ' + sanitize(e.message) + '<br>Verifique se as regras do Firestore estão atualizadas.</i>'; }
            },
            async setMemberRole(uid, role) {
                try {
                    await window._fbDB.collection('workspaces').doc(window._fbAuth.currentUser.uid).collection('members').doc(uid).update({ role });
                } catch(e) { alert('Erro ao mudar papel: ' + e.message); }
                this.loadTeam();
            },
            async removeMember(uid) {
                if (!confirm('Remover esta pessoa do seu workspace? Ela perde o acesso imediatamente.')) return;
                try {
                    await window._fbDB.collection('workspaces').doc(window._fbAuth.currentUser.uid).collection('members').doc(uid).delete();
                } catch(e) { alert('Erro ao remover: ' + e.message); }
                this.loadTeam();
            },
            async revokeInvite(token) {
                if (!confirm('Revogar este convite? O link deixa de funcionar.')) return;
                try {
                    await window._fbDB.collection('invites').doc(token).delete();
                } catch(e) { alert('Erro ao revogar: ' + e.message); }
                this.loadTeam();
            },
            closeInviteModal() { document.getElementById('modal-invite').classList.remove('active'); },
            async createInvite() {
                const emailRaw = document.getElementById('inp-invite-email').value.trim();
                const role = document.getElementById('sel-invite-role').value; // 'view' | 'edit'
                if (!emailRaw || !/.+@.+\..+/.test(emailRaw)) return alert('Digite um e-mail válido.');
                const _db = window._fbDB;
                const _user = window._fbAuth && window._fbAuth.currentUser;
                if (!_user) return alert('Faça login novamente.');
                const email = emailRaw.toLowerCase();
                const token = genToken();
                const wsName = state.wsName || ('Workspace de ' + (_user.displayName || (_user.email||'').split('@')[0]));
                try {
                    await _db.collection('invites').doc(token).set({
                        email, role, wsId: _user.uid, wsName,
                        createdBy: _user.uid, createdByEmail: (_user.email||'').toLowerCase(),
                        used: false, createdAt: new Date().toISOString(),
                        expiresAt: Date.now() + 7*24*60*60*1000 // millis, 7 dias
                    });
                    const link = location.origin + location.pathname + '?convite=' + token;
                    document.getElementById('invite-link-input').value = link;
                    document.getElementById('invite-link-role').textContent = role === 'edit' ? 'Ver e editar' : 'Somente ver';
                    document.getElementById('invite-link-email').textContent = email;
                    document.getElementById('invite-form-wrap').style.display = 'none';
                    document.getElementById('invite-link-wrap').style.display = 'block';
                    this.loadTeam();
                } catch(e) {
                    alert('Erro ao criar convite: ' + (e && e.message) + '\n\nVerifique se você publicou as regras do Firestore para "invites".');
                }
            },
            copyInviteLink() {
                const inp = document.getElementById('invite-link-input');
                inp.select(); inp.setSelectionRange(0, 99999);
                try { navigator.clipboard.writeText(inp.value); } catch(e){ try { document.execCommand('copy'); } catch(_){} }
                const b = document.getElementById('btn-copy-link'); const t = b.textContent; b.textContent = '✅ Copiado!'; setTimeout(()=>{ b.textContent = t; }, 1500);
            },
            async addProject() {
                const name = await uiPrompt("Novo Projeto", "Digite o nome do projeto (ex: Linha de Montagem A).");
                if(name) { const _id = getUUID(); state.projects.push({ id: _id, name: name, cells: [], _ord: Date.now() }); appState.saveProject(_id); ui.renderDashboard(); }
            },
            async addCell() {
                const name = await uiPrompt("Nova Célula", "Digite o nome da célula (ex: Célula de Solda LD).");
                if(name) {
                    const p = appState.getProject(activeContext.projectId);
                    p.cells.push({ id: getUUID(), name: name, robots: [] });
                    appState.saveProject(activeContext.projectId); ui.renderProject(activeContext.projectId);
                }
            },
            openModalAddRobot() {
                // Volta sempre ao passo 1 (quantidade + aplicação)
                document.getElementById('robot-step1').style.display = 'block';
                document.getElementById('robot-step2').style.display = 'none';
                document.getElementById('inp-robot-qty').value = 1;
                document.getElementById('robot-names').innerHTML = '';
                document.getElementById('modal-add-robot').classList.add('active');
            },
            closeModal() { document.getElementById('modal-add-robot').classList.remove('active'); },

            // Passo 1 -> 2: gera um campo de nome por robô
            robotStep2() {
                let qty = parseInt(document.getElementById('inp-robot-qty').value, 10);
                if(!qty || qty < 1) qty = 1;
                if(qty > 50) qty = 50;
                const wrap = document.getElementById('robot-names');
                wrap.innerHTML = '';
                for(let i = 1; i <= qty; i++) {
                    const inp = document.createElement('input');
                    inp.type = 'text'; inp.className = 'robot-name-inp'; inp.style.width = '100%';
                    inp.placeholder = 'Robô ' + i + ' (ex: R' + String(i).padStart(2,'0') + ' - Solda)';
                    wrap.appendChild(inp);
                }
                document.getElementById('robot-step1').style.display = 'none';
                document.getElementById('robot-step2').style.display = 'block';
                const first = wrap.querySelector('input'); if(first) setTimeout(()=>first.focus(), 30);
            },
            robotBack() {
                document.getElementById('robot-step2').style.display = 'none';
                document.getElementById('robot-step1').style.display = 'block';
            },

            // Aplica a nova ordem (vinda do drag & drop) ao Model e persiste.
            // 'ids' é a ordem dos data-id dos cards após soltar.
            commitReorder(kind, ids) {
                if (typeof canEdit === 'function' && !canEdit()) return;
                const byOrder = (arr, key) => { const m = {}; arr.forEach(x => m[x[key]] = x);
                    return ids.map(id => m[id]).filter(Boolean).concat(arr.filter(x => !ids.includes(x[key]))); };
                if (kind === 'project') {
                    state.projects = byOrder(state.projects, 'id');
                    state.projects.forEach((p, i) => { if (p._ord !== i) { p._ord = i; appState.saveProject(p.id); } });
                    ui.renderDashboard();
                } else if (kind === 'cell') {
                    const p = appState.getProject(activeContext.projectId); if (!p) return;
                    p.cells = byOrder(p.cells, 'id');
                    appState.saveProject(p.id); ui.renderProject(p.id);
                } else if (kind === 'robot') {
                    const c = appState.getCell(activeContext.projectId, activeContext.cellId); if (!c) return;
                    c.robots = byOrder(c.robots, 'id');
                    appState.saveProject(activeContext.projectId); ui.renderCell(activeContext.projectId, activeContext.cellId);
                }
            },

            confirmAddRobot() {
                const appType = document.getElementById('sel-robot-app').value;
                // Um nome por campo; ignora vazios e duplicatas na mesma leva.
                const names = [...new Set([...document.querySelectorAll('#robot-names .robot-name-inp')]
                    .map(el => el.value.trim()).filter(Boolean))];
                if(!names.length) return alert("Dê um nome para ao menos um robô.");

                const c = appState.getCell(activeContext.projectId, activeContext.cellId);
                // Quais tarefas-base se aplicam a esta aplicação (mesmo p/ todos os robôs).
                const templates = (state.defaultTasks || []).filter(dt => {
                    const filters = dt.appFilters || dt.apps || [];
                    return filters.length === 0 || filters.includes('Misto / Geral') || filters.includes('Todas') || filters.includes(appType);
                });

                names.forEach(name => {
                    const rTasks = templates.map(dt => ({ id: getUUID(), cat: dt.cat || "Extra", desc: dt.desc, weight: 1, progress: 0, status: "Pendente", resp: "Não Atribuído", obs: "" }));
                    c.robots.push({ id: getUUID(), name, application: appType, tasks: rTasks });
                });

                appState.saveProject(activeContext.projectId);
                this.closeModal();
                ui.renderCell(activeContext.projectId, activeContext.cellId);
            },

            async addCustomTask() {
                const cat = await uiPrompt("Categoria da tarefa", "Deixe em branco para 'Extras'.", "Extras - Geral");
                if(cat === null) return;
                const desc = await uiPrompt("Nova tarefa", "Descreva a tarefa detalhadamente:", "");
                if(!desc) return;

                const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
                if(!r) return;
                r.tasks.push({ id: getUUID(), cat: cat||"Extra", desc, weight: 1, progress: 0, status: "Pendente", resp: "Não Atribuído", obs: "" });
                appState.saveProject(activeContext.projectId);
                ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
            },
            async renameProject(e, pid) {
                e.stopPropagation();
                const p = appState.getProject(pid);
                if(!p) return;
                const n = await uiPrompt("Renomear projeto", "", p.name);
                if(n && n !== p.name) { p.name = n; appState.saveProject(pid); ui.renderDashboard(); }
            },
            async renameCell(e, pid, cid) {
                e.stopPropagation();
                const c = appState.getCell(pid, cid);
                if(!c) return;
                const n = await uiPrompt("Renomear célula", "", c.name);
                if(n && n !== c.name) { c.name = n; appState.saveProject(pid); ui.renderProject(pid); }
            },
            async renameRobot(e, pid, cid, rid) {
                e.stopPropagation();
                const r = appState.getRobot(pid, cid, rid);
                if(!r) return;
                const n = await uiPrompt("Renomear robô", "", r.name);
                if(n && n !== r.name) { r.name = n; appState.saveProject(pid); ui.renderCell(pid, cid); }
            },
            // skipConfirm: usado pelo swipe (arrastar + tocar em "Excluir" já é intenção
            // clara, e alguns navegadores como o Brave bloqueiam confirm() repetido).
            deleteProject(pid, skipConfirm) {
                if(skipConfirm || confirm("Remover este PROJETO e tudo dentro dele?")) { state.projects = state.projects.filter(p => p.id !== pid); appState.deleteProjectDoc(pid); ui.renderDashboard(); }
            },
            deleteCell(pid, cid, skipConfirm) {
                if(skipConfirm || confirm("Remover esta CÉLULA inteira?")) { const p = appState.getProject(pid); p.cells = p.cells.filter(c => c.id !== cid); appState.saveProject(pid); ui.renderProject(pid); }
            },
            deleteRobot(pid, cid, rid, skipConfirm) {
                if(skipConfirm || confirm("Remover este ROBÔ e as tarefas dele?")) { const c = appState.getCell(pid, cid); c.robots = c.robots.filter(r => r.id !== rid); appState.saveProject(pid); ui.renderCell(pid, cid); }
            },
            deleteTask(tid, skipConfirm) {
                if(skipConfirm || confirm("Deletar esta tarefa do robô?")) { const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId); r.tasks = r.tasks.filter(t => t.id !== tid); appState.saveProject(activeContext.projectId); ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId); }
            },
            async renameTask(tid) {
                if (!requireEdit()) return;
                const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
                const t = r && r.tasks.find(x => x.id === tid);
                if (!t) return;
                const n = await uiPrompt("Editar tarefa", "Descrição da tarefa:", t.desc);
                if (n && n !== t.desc) { t.desc = n; appState.saveProject(activeContext.projectId); ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId); }
            },

            updateTask(tid, field, val) {
                if (!canEdit()) { ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId); return; }
                const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
                const t = r.tasks.find(x => x.id === tid);
                if(t) {
                    let _settingsTouched = false;
                    // Auto-assign: usa window.currentUserName como fallback seguro caso auth.currentUser
                    // ainda esteja null durante a inicialização do Firebase Auth
                    const _liveUser = auth.currentUser;
                    const _liveName = (_liveUser ? (_liveUser.displayName || _liveUser.email) : null) || window.currentUserName || null;
                    if ((field === 'progress' || field === 'status') && _liveName) {
                        if (!t.resp || t.resp === 'Não Atribuído') {
                            t.resp = _liveName;
                            // Garante que o nome aparece no dropdown de responsáveis
                            if (!state.responsibles) state.responsibles = ['Não Atribuído'];
                            if (!state.responsibles.includes(_liveName)) { state.responsibles.push(_liveName); _settingsTouched = true; }
                        }
                    }
                    if (field === 'status') {
                        t.status = val;
                        if(val === 'Concluído') t.progress = 100;
                        if(val.includes('N/A')) t.progress = 0;
                        if(val === 'Pendente') t.progress = 0;
                    } 
                    else if (field === 'progress') {
                        const newVal = Number(val);
                        t.progress = newVal;

                        if (t.progress === 100) {
                            t.status = "Concluído";
                            appState.addLog(`Em [${r.name}], ${t.resp} concluiu a tarefa "${t.desc}" com 100%.`);
                        }
                        else if (t.progress > 0) t.status = "Em Andamento";
                        else if (!t.status.includes("N/A")) t.status = "Pendente"; 
                    } 
                    else {
                        t[field] = val;
                    }
                    
                    appState.saveProject(activeContext.projectId);
                    if (_settingsTouched) appState.saveSettings();
                    ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId); // Fully re-render to secure UI state mapping seamlessly
                    
                    if((field === 'progress' || field === 'status') && t.progress === 100) {
                        const row = document.getElementById(`tr_${tid}`);
                        if(row) { row.classList.remove('pulse-anim'); void row.offsetWidth; row.classList.add('pulse-anim'); }
                    }
                }
            },
            
            // Teams Settings
            addResponsible() {
                const n = document.getElementById('inp-resp-name').value;
                if(!n) return alert("Digite um nome!");
                if(!state.responsibles) state.responsibles = ["Não Atribuído"];
                if(!state.responsibles.includes(n)) state.responsibles.push(n);
                document.getElementById('inp-resp-name').value = '';
                appState.save();
                ui.renderSettings();
            },
            deleteResponsibleAt(i) { const r = (state.responsibles || [])[i]; if (r) this.deleteResponsible(r); },
            deleteResponsible(r) {
                if(confirm(`Remover o(a) responsável ${r}?`)) {
                    state.responsibles = state.responsibles.filter(x => x !== r);
                    appState.save();
                    ui.renderSettings();
                }
            },
            
            // Templates settings
            addDefaultTask() {
                const c = document.getElementById('inp-dt-cat').value;
                const d = document.getElementById('inp-dt-desc').value;
                const a = document.getElementById('inp-dt-app').value;
                if(!c || !d) return alert("Preencha categoria e descrição.");
                if(!state.defaultTasks) state.defaultTasks = [];
                state.defaultTasks.push({ id: getUUID(), cat: c, desc: d, weight: 1, appFilters: a ? [a] : [] });
                appState.save();
                ui.renderSettings();
            },
            deleteDefaultTask(tid) {
                state.defaultTasks = state.defaultTasks.filter(t => t.id !== tid);
                appState.save();
                ui.renderSettings();
            },
            async editAppFilter(tid) {
                 const t = state.defaultTasks.find(x => x.id === tid);
                 if(!t) return;
                 let filters = t.appFilters || t.apps || [];
                 let current = filters.length ? filters[0] : "Misto / Geral";
                 const res = await uiPrompt("Aplicação da tarefa", "Digite exatamente um dos filtros:\n[ Misto / Geral, Solda Ponto, Solda MIG, Handling, Sealing, Outros ]", current);
                 if(res) {
                     if(res === 'Misto / Geral' || res === 'Geral') t.appFilters = [];
                     else t.appFilters = [res];
                     appState.save();
                     ui.renderSettings();
                 }
            },
            forceSyncDefault() {
                 if(!confirm("Gerar tarefas base de acordo com a APLICAÇÃO do robô (não sobreescreve). Continuar?")) return;
                 const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
                 if(!r) return;
                 let added = 0;
                 if(state.defaultTasks) {
                     state.defaultTasks.forEach(dt => {
                         let filters = dt.appFilters || dt.apps || [];
                         let ok = (filters.length === 0 || filters.includes('Misto / Geral') || filters.includes('Todas'));
                         if(!ok && filters.includes(r.application || 'Misto / Geral')) ok = true;
                         
                         if(ok && !r.tasks.find(t => t.desc === dt.desc)) {
                             r.tasks.push({ id: getUUID(), cat: dt.cat || "Extra", desc: dt.desc, weight: 1, progress:0, status:"Pendente", resp:"Não Atribuído", obs:"" });
                             added++;
                         }
                     });
                 }
                 if(added > 0) { appState.saveProject(activeContext.projectId); ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId); }
                 alert(added + " tarefas foram adicionadas.");
            },
            // BUG-04 FIX: lê o progresso atual do state (não da closure stale do template)
            nudgeProgress(tid, delta) {
                const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
                const t = r ? r.tasks.find(x => x.id === tid) : null;
                if(!t) return;
                const newVal = Math.min(100, Math.max(0, (t.progress || 0) + delta));
                uiActions.openAdvanceModal(tid, newVal);
            },

            // --- Registrar avanço (milestone por usuário, comentário obrigatório <100%) ---
            _advanceTid: null,
            openAdvanceModal(tid, toVal) {
                if (!canEdit()) { ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId); return; }
                const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
                const t = r ? r.tasks.find(x => x.id === tid) : null;
                if (!t) return;
                this._advanceTid = tid;
                const to = Math.min(100, Math.max(0, Number(toVal) || 0));
                document.getElementById('advance-task-name').textContent = t.desc;
                document.getElementById('advance-from').textContent = (t.progress || 0) + '%';
                document.getElementById('advance-to').value = to;
                document.getElementById('advance-comment').value = '';
                this.refreshAdvanceLabel();
                document.getElementById('modal-advance').classList.add('active');
            },
            refreshAdvanceLabel() {
                const to = Number(document.getElementById('advance-to').value);
                document.getElementById('advance-comment-label').textContent =
                    to >= 100 ? 'O que você fez? (opcional ao concluir)' : 'O que você fez? O que falta? (obrigatório)';
            },
            closeAdvanceModal() {
                this._advanceTid = null;
                document.getElementById('modal-advance').classList.remove('active');
                // Reverte o slider pro valor real (o arraste não foi confirmado)
                ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
            },
            confirmAdvance() {
                const tid = this._advanceTid; if (!tid) return;
                const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
                const t = r ? r.tasks.find(x => x.id === tid) : null;
                if (!t) return this.closeAdvanceModal();
                const to = Math.min(100, Math.max(0, Number(document.getElementById('advance-to').value) || 0));
                const comment = document.getElementById('advance-comment').value.trim();
                if (to < 100 && !comment) { alert('Escreva o que você fez e/ou o que falta — obrigatório enquanto a tarefa não chega a 100%.'); return; }
                if (!t.history) t.history = [];
                // Migração preguiçosa: nota antiga (obs) vira 1ª entrada da trilha
                if (t.obs && t.obs.trim() && t.history.length === 0) {
                    t.history.push({ byName: '(nota anterior)', comment: t.obs.trim(), legacy: true });
                    delete t.obs;
                }
                t.history.push({
                    by: window.currentUserId || null,
                    byName: window.currentUserName || 'Desconhecido',
                    ts: new Date().toISOString(),
                    from: t.progress || 0,
                    to: to,
                    comment: comment
                });
                this._advanceTid = null;
                document.getElementById('modal-advance').classList.remove('active');
                // Delegar a transição mantém: auto-status, auto-resp, log S-09 no 100%, saveProject, re-render
                uiActions.updateTask(tid, 'progress', to);
            },
            openTaskHistory(tid) {
                const r = appState.getRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
                const t = r ? r.tasks.find(x => x.id === tid) : null;
                if (!t) return;
                document.getElementById('th-task-name').textContent = t.desc;
                const hist = (t.history || []).slice().reverse(); // mais novo primeiro
                const contribs = [...new Set((t.history || []).map(h => h.byName).filter(Boolean).filter(n => n !== '(nota anterior)'))];
                document.getElementById('th-contribs').innerHTML = contribs.length
                    ? contribs.map(n => `<span class="contrib-chip">${sanitize(n)}</span>`).join('')
                    : '';
                const tl = document.getElementById('th-timeline');
                if (!hist.length) { tl.innerHTML = '<i style="color:var(--text-muted)">Nenhum avanço registrado ainda.</i>'; }
                else {
                    tl.innerHTML = hist.map(h => {
                        const when = h.ts ? new Date(h.ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
                        const delta = (h.from != null && h.to != null) ? `<span class="tl-delta">${h.from}% → ${h.to}%</span>` : '';
                        return `<div class="tl-entry${h.legacy ? ' tl-legacy' : ''}">
                            <div class="tl-head"><b>${sanitize(h.byName || '—')}</b> ${delta} <span class="tl-ts">${sanitize(when)}</span></div>
                            ${h.comment ? `<div class="tl-comment">${sanitize(h.comment)}</div>` : ''}
                        </div>`;
                    }).join('');
                }
                document.getElementById('modal-task-history').classList.add('active');
            }
        };


        function nav(view, id1, id2, id3) {
            const views = document.querySelectorAll('.view');
            views.forEach(v => { v.classList.remove('active'); v.style.animation = 'none'; });
            document.querySelectorAll('.nav-item').forEach(v => v.classList.remove('active'));
            
            setTimeout(() => {
                const vTarget = document.getElementById(`view-${view}`);
                vTarget.classList.add('active'); vTarget.style.animation = ''; 

                // Reset activeContext for safety, then set specific IDs
                activeContext.projectId = null;
                activeContext.cellId = null;
                activeContext.robotId = null;
                // BUG-05 FIX: resetar filtro ao navegar entre telas
                currentTaskFilter = 'T';
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                const _fb = document.querySelector('.filter-btn'); if(_fb) _fb.classList.add('active');

                if (view === 'dashboard') {
                    document.getElementById('nav-dashboard').classList.add('active');
                    ui.renderDashboard();
                } else if (view === 'project') {
                    document.getElementById('nav-dashboard').classList.add('active');
                    activeContext.projectId = id1;
                    ui.renderProject(id1);
                } else if (view === 'cell') {
                    document.getElementById('nav-dashboard').classList.add('active');
                    activeContext.projectId = id1;
                    activeContext.cellId = id2;
                    ui.renderCell(id1, id2);
                } else if (view === 'robot') {
                    document.getElementById('nav-dashboard').classList.add('active');
                    activeContext.projectId = id1;
                    activeContext.cellId = id2;
                    activeContext.robotId = id3;
                    ui.renderRobot(id1, id2, id3);
                } else if (view === 'settings') {
                    document.getElementById('nav-settings').classList.add('active');
                    ui.renderSettings();
                } else if (view === 'report') {
                    const nr = document.getElementById('nav-report'); if (nr) nr.classList.add('active');
                    ui.renderReport();
                } else if (view === 'mytasks') {
                    const nm = document.getElementById('nav-mytasks'); if (nm) nm.classList.add('active');
                    ui.renderMyTasks();
                }
            }, 10);
        }

        // --- END ROUTER ---


        // "Manter conectado": LOCAL persiste entre sessões (padrão), SESSION expira ao
        // fechar o navegador. Define a persistência e SÓ ENTÃO faz o sign-in — mas nunca
        // deixa o login travar: se setPersistence demorar/falhar (ex.: Brave bloqueando
        // IndexedDB), segue mesmo assim após um curto timeout.
        function _persistThen(fn) {
            const rem = document.getElementById('auth-remember');
            const mode = (!rem || rem.checked) ? 'LOCAL' : 'SESSION';
            let done = false;
            const go = () => { if (done) return; done = true; fn().catch(err => _authErr(err.message)); };
            try {
                auth.setPersistence(firebase.auth.Auth.Persistence[mode]).then(go, go);
                setTimeout(go, 1200); // rede de segurança: não bloqueia o login
            } catch (e) { go(); }
        }
        function authLogin() {
            const e = document.getElementById('auth-email').value.trim();
            const p = document.getElementById('auth-pass').value;
            if (!e || !p) return _authErr('Preencha email e senha.');
            _persistThen(() => auth.signInWithEmailAndPassword(e, p));
        }
        function authGoogle() {
            const provider = new firebase.auth.GoogleAuthProvider();
            _persistThen(() => auth.signInWithPopup(provider));
        }
        let authMode = 'login'; // 'login' | 'register'
        function toggleAuthMode() {
            authMode = authMode === 'login' ? 'register' : 'login';
            const reg = authMode === 'register';
            document.getElementById('register-name-wrap').style.display = reg ? 'block' : 'none';
            document.getElementById('btn-primary').textContent = reg ? 'Criar conta' : 'Entrar';
            document.getElementById('btn-toggle').textContent = reg ? 'Já tenho conta — Entrar' : 'Não tem conta? Criar conta';
            document.getElementById('auth-error').style.display = 'none';
        }
        function authSubmit() { authMode === 'register' ? authRegister() : authLogin(); }
        function authRegister() {
            const e = document.getElementById('auth-email').value.trim();
            const p = document.getElementById('auth-pass').value;
            const n = document.getElementById('auth-name').value.trim();
            if (!n) return _authErr('Preencha seu nome.');
            if (!e || !p) return _authErr('Preencha email e senha.');
            if (p.length < 6) return _authErr('Senha mínimo 6 caracteres.');
            _persistThen(() => auth.createUserWithEmailAndPassword(e, p)
                .then(cred => cred.user.updateProfile({ displayName: n })));
        }
        function _authErr(msg) {
            const el = document.getElementById('auth-error');
            el.textContent = msg; el.style.display = 'block';
        }

        function _reRender() {
            const v = document.querySelector('.view.active');
            if (!v) return;
            const id = v.id.replace('view-', '');
            if (id === 'dashboard') ui.renderDashboard();
            else if (id === 'project' && activeContext.projectId) ui.renderProject(activeContext.projectId);
            else if (id === 'cell' && activeContext.cellId) ui.renderCell(activeContext.projectId, activeContext.cellId);
            else if (id === 'robot' && activeContext.robotId) ui.renderRobot(activeContext.projectId, activeContext.cellId, activeContext.robotId);
            else if (id === 'settings') ui.renderSettings();
            else if (id === 'report') ui.renderReport();
            else if (id === 'mytasks') ui.renderMyTasks();
        }

        auth.onAuthStateChanged(async function(user) {
            if (user) {
                window.currentUserId = user.uid;
                window.currentUserName = user.displayName || user.email;
                // BUG-10 FIX: iOS Safari exige visibility+pointerEvents além de display:none
                const _ls = document.getElementById('login-screen');
                _ls.style.display = 'none'; _ls.style.visibility = 'hidden'; _ls.style.pointerEvents = 'none';
                const el = document.getElementById('nav-user-email');
                if (el) el.textContent = '👤 ' + (user.displayName || user.email);
                const hu = document.getElementById('header-user-email');
                if (hu) hu.textContent = '👤 ' + user.email;
                await _loadMyWorkspaces(user);
                const invited = await _consumePendingInvite(user);
                // Workspace inicial: o recém-convidado; senão o próprio; senão o primeiro.
                const start = invited || window.myWorkspaces.find(w => w.id === user.uid) || window.myWorkspaces[0];
                renderWorkspaceSelector();
                subscribeWorkspace(start.id, start.role);
            } else {
                window.currentUserId = null;
                const _ls2 = document.getElementById('login-screen');
                _ls2.style.display = 'flex'; _ls2.style.visibility = 'visible'; _ls2.style.pointerEvents = 'auto';
                _unsubAll();
            }
        });
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
        }

        // ===== SWIPE (mobile) =====
        // Delegação global (sobrevive a re-render): arrastar um card/linha pra esquerda
        // revela as ações (Editar/Excluir nos cards, Excluir nas tarefas).
        (function(){
            const W = 92; // largura de cada botão de ação
            let target = null, delEl = null, editEl = null, base = 0, startX = 0, startY = 0, axis = null, moved = false;
            function findTarget(t){
                if (t.closest('select,input,button,a,.trail-cell,.action-btns,.drag-handle')) return null;
                return t.closest('.swipe-host > .card') || t.closest('#robot-tasks-table tbody tr:not(.cat-row)');
            }
            function closeAll(except){
                document.querySelectorAll('.swiped-left, .swiped-right').forEach(el => {
                    if (el !== except) { el.classList.remove('swiped-left', 'swiped-right'); }
                });
            }
            document.addEventListener('touchstart', function(e){
                // tap num botão de ação: não fecha, deixa o clique agir
                if (e.target.closest('.swipe-del, .swipe-edit, .swipe-del-cell')) { target = null; return; }
                const el = findTarget(e.target);
                if (!el || !(el.classList.contains('swiped-left') || el.classList.contains('swiped-right'))) closeAll(el);
                if (!el) { target = null; return; }
                target = el; axis = null; moved = false;
                const isCard = el.classList.contains('card');
                // Excluir (arrasta p/ esquerda, à direita) e Editar (p/ direita, à esquerda)
                // existem tanto nos cards quanto nas linhas de tarefa.
                delEl  = isCard ? el.parentElement.querySelector('.swipe-del')  : el.querySelector('.swipe-del-cell');
                editEl = isCard ? el.parentElement.querySelector('.swipe-edit') : el.querySelector('.swipe-edit-cell');
                base = el.classList.contains('swiped-left') ? -W : el.classList.contains('swiped-right') ? W : 0;
                startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            }, { passive: true });
            document.addEventListener('touchmove', function(e){
                if (!target) return;
                const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
                if (axis === null) {
                    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
                    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
                    if (axis === 'y') { target = null; return; } // gesto vertical: deixa rolar
                    target.classList.add('dragging');
                    if (delEl) delEl.style.transition = 'none';
                    if (editEl) editEl.style.transition = 'none';
                }
                e.preventDefault(); moved = true;
                let x = base + dx;
                const min = -W, max = editEl ? W : 0; // sem Editar (tarefas), não desliza p/ direita
                if (x < min) x = min + (x - min) * 0.28;      // resistência elástica
                else if (x > max) x = max + (x - max) * 0.28;
                target.style.transform = 'translateX(' + x + 'px)';
                // cada lado surge proporcional ao arraste na sua direção
                if (delEl)  delEl.style.opacity  = x < 0 ? Math.min(1, -x / W) : 0;
                if (editEl) editEl.style.opacity = x > 0 ? Math.min(1,  x / W) : 0;
            }, { passive: false });
            document.addEventListener('touchend', function(e){
                if (!target || axis !== 'x') { if (target) target.classList.remove('dragging'); target = null; return; }
                const x = base + (e.changedTouches[0].clientX - startX);
                const t = target, d = delEl, ed = editEl; target = null;
                t.classList.remove('dragging'); t.style.transform = '';
                if (d)  { d.style.transition = '';  d.style.opacity = ''; }   // deixa o CSS assumir o estado
                if (ed) { ed.style.transition = ''; ed.style.opacity = ''; }
                t.classList.remove('swiped-left', 'swiped-right');
                if (x <= -W * 0.4) t.classList.add('swiped-left');
                else if (ed && x >= W * 0.4) t.classList.add('swiped-right');
                if (moved) { // impede que o arrasto vire clique de navegação —
                    // mas deixa passar taps nos botões revelados (Editar/Excluir da linha)
                    const stop = ev => { if (ev.target.closest('.swipe-del, .swipe-edit')) return; ev.stopPropagation(); ev.preventDefault(); };
                    t.addEventListener('click', stop, true);
                    setTimeout(() => t.removeEventListener('click', stop, true), 350);
                }
            }, { passive: false });
        })();

        // ===== REORDENAR (arrastar a alça ⠿) =====
        // Pointer events unificam mouse e toque. Reordena cards ao vivo e persiste no soltar.
        (function(){
            let dragging = null, container = null, kind = null, moved = false;
            function afterEl(cont, y){
                let best = null, bestOff = -Infinity;
                cont.querySelectorAll(':scope > .swipe-host:not(.dragging-sort)').forEach(el => {
                    const b = el.getBoundingClientRect(); const off = y - (b.top + b.height / 2);
                    if (off < 0 && off > bestOff) { bestOff = off; best = el; }
                });
                return best;
            }
            document.addEventListener('pointerdown', function(e){
                const h = e.target.closest('.drag-handle'); if (!h) return;
                const host = h.closest('.swipe-host'); if (!host || !host.parentElement) return;
                kind = host.parentElement.dataset.reorder; if (!kind) return;
                if (typeof canEdit === 'function' && !canEdit()) return;
                dragging = host; container = host.parentElement; moved = false;
                host.classList.add('dragging-sort');
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });
            document.addEventListener('pointermove', function(e){
                if (!dragging) return;
                e.preventDefault(); moved = true;
                const a = afterEl(container, e.clientY);
                if (a == null) container.appendChild(dragging); else container.insertBefore(dragging, a);
            });
            function endDrag(){
                if (!dragging) return;
                dragging.classList.remove('dragging-sort');
                document.body.style.userSelect = '';
                if (moved) {
                    const ids = [...container.querySelectorAll(':scope > .swipe-host')].map(h => h.dataset.id);
                    uiActions.commitReorder(kind, ids);
                }
                dragging = null; container = null; kind = null;
            }
            document.addEventListener('pointerup', endDrag);
            document.addEventListener('pointercancel', endDrag);
        })();

        // Boot: mostra o dashboard; os dados chegam via Firebase (onAuthStateChanged).
        nav('dashboard');
