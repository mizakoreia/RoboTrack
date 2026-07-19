/* =============================================================================
 * MODEL · firebase.js
 * Backend de dados: inicialização do Firebase, referências db/auth, papéis de
 * permissão, gestão de workspaces e consumo de convites. Alimenta o "state"
 * (data.js) via onSnapshot e notifica a View pela ponte _reRender (controller).
 * ========================================================================== */

// ===== FIREBASE RUNTIME (V9) =====
const firebaseConfig = {
    apiKey: "AIzaSyBStBuPNFcErDhuNtUs_aOgczv-0mEgPcQ",
    authDomain: "robotrack-miza.firebaseapp.com",
    projectId: "robotrack-miza",
    storageBucket: "robotrack-miza.firebasestorage.app",
    messagingSenderId: "183892562388",
    appId: "1:183892562388:web:c65ab780dd0704f42dc641"
};
firebase.initializeApp(firebaseConfig);
// ===== APP CHECK (reCAPTCHA v3) =====
// Protege o backend contra abuso de terceiros. Enquanto o enforcement estiver
// "Unenforced" no console, os tokens só alimentam o monitor — não bloqueiam nada.
try {
    firebase.appCheck().activate('6LcvDlotAAAAAL9MCqfxs1WgpAVtJmQgzrKQBYoQ', true);
    console.log('[RoboTrack] ✅ App Check ativado');
} catch (e) {
    console.warn('[RoboTrack] App Check não pôde ser ativado:', e);
}
const db = firebase.firestore();
const auth = firebase.auth();
// Persistência LOCAL no boot: mantém a sessão entre recarregamentos. Se o navegador
// bloquear o armazenamento (Brave com shields, modo privado, "limpar ao sair"), o
// Firebase cai em memória e o usuário volta pro login ao atualizar — avisamos no console.
try {
    var _P = firebase.auth.Auth && firebase.auth.Auth.Persistence;
    if (_P && typeof auth.setPersistence === 'function') {
        auth.setPersistence(_P.LOCAL).catch(function(e){
            console.warn('[RoboTrack] ⚠️ Persistência de login indisponível — o navegador está bloqueando o armazenamento do site. Você será deslogado ao atualizar. Verifique cookies/armazenamento (ex.: Brave Shields / limpar ao sair).', e && e.code);
        });
    }
} catch (e) { console.warn('[RoboTrack] setPersistence não disponível:', e && e.message); }
// Enable offline persistence so writes resolve locally even with slow/blocked server
db.enablePersistence({ synchronizeTabs: true })
  .then(() => console.log('[RoboTrack] ✅ Persistência offline ativada'))
  .catch(err => console.warn('[RoboTrack] Persistência offline não disponível:', err.code));
// Expose as window globals so appState.save() can access safely
window._fbDB = db;
window._fbAuth = auth;
window.currentUserId = null;
window.currentWsId = null;      // workspace atualmente aberto (doc id = uid do dono)
window.currentRole = 'owner';   // 'owner' | 'edit' | 'view'
window.myWorkspaces = [];        // [{ id, name, role }]
let _fsUnsub = null;
let _fsUnsub2 = null;
let _fsUnsub3 = null;
let _notifSeen = null; // ids já vistos: a 1ª snapshot não dispara alertas de sistema
let _migrating = false;
function _unsubAll(){ if(_fsUnsub){_fsUnsub();_fsUnsub=null;} if(_fsUnsub2){_fsUnsub2();_fsUnsub2=null;} if(_fsUnsub3){_fsUnsub3();_fsUnsub3=null;} _notifSeen = null; }
// Guarda o token do convite (se veio na URL) antes do fluxo de login.
try { const _t = new URLSearchParams(location.search).get('convite'); if (_t) sessionStorage.setItem('rt_invite', _t); } catch(e){}

function canEdit(){ return window.currentRole === 'owner' || window.currentRole === 'edit'; }
function isOwner(){ return window.currentRole === 'owner'; }
function requireEdit(){ if(!canEdit()){ alert('Você tem permissão apenas de visualização neste workspace.'); return false; } return true; }
function genToken(){ try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g,''); } catch(e){} return (getUUID()+getUUID()+Date.now().toString(36)).replace(/[^a-z0-9]/gi,''); }
function _applyRole(){ document.body.dataset.role = window.currentRole; }

function subscribeWorkspace(wsId, role) {
    _unsubAll();
    window.currentWsId = wsId;
    window.currentRole = role || 'view';
    _applyRole();
    // Zera estado ao (re)abrir um workspace, evitando vazar dados do anterior.
    state.projects = []; state.logs = []; state.defaultTasks = [...defaultTemplates]; state.responsibles = ['Não Atribuído'];
    state.myNotifs = [];
    if (window.currentUserName && !state.responsibles.includes(window.currentUserName)) state.responsibles.push(window.currentUserName);
    const wref = window._fbDB.collection('workspaces').doc(wsId);
    // Listener 1: configurações do workspace (sem os projetos).
    _fsUnsub = wref.onSnapshot(function(doc) {
        if (doc.exists) {
            const d = doc.data();
            if (Array.isArray(d.defaultTasks) && d.defaultTasks.length > 0) state.defaultTasks = d.defaultTasks;
            if (Array.isArray(d.responsibles) && d.responsibles.length > 0) state.responsibles = d.responsibles;
            if (d.name) state.wsName = d.name;
            // Auto-inscreve o próprio nome na lista COMPARTILHADA de responsáveis, para
            // que quem convida (e a equipe) possa atribuir tarefas a essa pessoa. Só
            // editores/dono conseguem gravar; a snapshot seguinte já traz o nome, sem loop.
            if (window.currentUserName && canEdit() && !(state.responsibles || []).includes(window.currentUserName)) {
                state.responsibles = [...(state.responsibles || ['Não Atribuído']), window.currentUserName];
                try { appState.saveSettings(); } catch (e) {}
            }
            // Migração única: projetos (S-05) e logs (S-09) legados inline -> subcoleções. Só o dono grava.
            const _hasLegacy = (Array.isArray(d.projects) && d.projects.length) || (Array.isArray(d.logs) && d.logs.length);
            if (_hasLegacy && !_migrating && window.currentRole === 'owner') {
                _migrating = true;
                const batch = window._fbDB.batch();
                (d.projects || []).forEach((p, i) => batch.set(wref.collection('projects').doc(p.id || getUUID()),
                    { name: p.name || 'Projeto', cells: p.cells || [], _ord: i, _migrated: true }));
                (d.logs || []).forEach(l => batch.set(wref.collection('logs').doc(),
                    { msg: (l && l.msg) || String(l), tsLocal: (l && l.ts) || '', ts: firebase.firestore.FieldValue.serverTimestamp(), _migrated: true }));
                batch.update(wref, { projects: firebase.firestore.FieldValue.delete(), logs: firebase.firestore.FieldValue.delete() });
                batch.commit().then(() => { console.log('[RoboTrack] migração p/ subcoleções OK'); _migrating = false; })
                    .catch(e => { console.error('[RoboTrack] migração falhou', e); _migrating = false; });
            }
        }
        _reRender();
    }, err => {
        console.error('[RoboTrack] listener workspace:', err);
        // Acesso revogado (dono removeu este membro): sai do workspace e volta pro próprio.
        if (err && err.code === 'permission-denied' && wsId !== window.currentUserId) {
            window.myWorkspaces = (window.myWorkspaces || []).filter(w => w.id !== wsId);
            try { window._fbDB.collection('users').doc(window.currentUserId).set({ workspaces: window.myWorkspaces }, { merge: true }); } catch(e){}
            alert('Seu acesso a este workspace foi removido.');
            const own = (window.myWorkspaces || []).find(w => w.id === window.currentUserId);
            if (own) { subscribeWorkspace(own.id, own.role); renderWorkspaceSelector(); }
        }
    });
    // Listener 2: projetos, cada um em seu documento (concorrência isolada).
    // Normaliza na chegada: docs incompletos (ex.: criados manualmente no console,
    // sem 'cells') quebravam todos os renders com "undefined.forEach".
    _fsUnsub2 = wref.collection('projects').orderBy('_ord').onSnapshot(function(snap) {
        state.projects = snap.docs.map(doc => {
            const p = Object.assign({ id: doc.id }, doc.data());
            if (!Array.isArray(p.cells)) p.cells = [];
            p.cells.forEach(c => {
                if (!Array.isArray(c.robots)) c.robots = [];
                c.robots.forEach(r => { if (!Array.isArray(r.tasks)) r.tasks = []; });
            });
            return p;
        });
        _reRender();
    }, err => console.error('[RoboTrack] listener projects:', err));
    // Listener 3: minhas notificações (endereçadas por nome, como os assignees).
    // Sem orderBy no servidor (evita índice composto) — ordena no cliente.
    if (window.currentUserName) {
        _fsUnsub3 = wref.collection('notifications').where('target', '==', window.currentUserName)
            .onSnapshot(function(snap) {
                const docs = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
                docs.sort((a, b) => {
                    const ta = (a.ts && a.ts.toMillis) ? a.ts.toMillis() : 0;
                    const tb = (b.ts && b.ts.toMillis) ? b.ts.toMillis() : 0;
                    return tb - ta;
                });
                state.myNotifs = docs.slice(0, 50);
                // Alerta de sistema só para docs NOVOS (não na carga inicial).
                if (_notifSeen === null) {
                    _notifSeen = new Set(docs.map(d => d.id));
                } else {
                    docs.filter(d => !d.read && !_notifSeen.has(d.id)).forEach(d => {
                        _notifSeen.add(d.id);
                        try {
                            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                                const n = new Notification('RoboTrack', { body: d.msg, icon: 'icon-192.png', tag: d.id });
                                n.onclick = () => { try { window.focus(); if (d.ctx && d.ctx.pid) nav('robot', d.ctx.pid, d.ctx.cid, d.ctx.rid); } catch(e){} n.close(); };
                            }
                        } catch(e){}
                    });
                    docs.forEach(d => _notifSeen.add(d.id));
                }
                if (typeof ui !== 'undefined' && ui.renderNotifs) ui.renderNotifs();
            }, err => console.warn('[RoboTrack] listener notifications:', err && err.message));
    }
}

function switchWorkspace(wsId) {
    const w = (window.myWorkspaces || []).find(x => x.id === wsId);
    if (!w) return;
    subscribeWorkspace(w.id, w.role);
    renderWorkspaceSelector();
}

async function _loadMyWorkspaces(user) {
    const uref = window._fbDB.collection('users').doc(user.uid);
    let snap = null;
    try { snap = await uref.get(); } catch(e){ console.warn('users get falhou', e && e.message); }
    let list = (snap && snap.exists && Array.isArray(snap.data().workspaces)) ? snap.data().workspaces.slice() : [];
    if (!list.find(w => w.id === user.uid)) {
        const ownName = 'Workspace de ' + (user.displayName || (user.email||'usuário').split('@')[0]);
        list.unshift({ id: user.uid, name: ownName, role: 'owner' });
        try { await uref.set({ email: (user.email||'').toLowerCase(), workspaces: list }, { merge: true }); } catch(e){ console.warn('seed users falhou', e && e.message); }
    }
    window.myWorkspaces = list;
}

async function _consumePendingInvite(user) {
    const token = sessionStorage.getItem('rt_invite') || new URLSearchParams(location.search).get('convite');
    if (!token) return null;
    sessionStorage.removeItem('rt_invite');
    try {
        const iref = window._fbDB.collection('invites').doc(token);
        const isnap = await iref.get();
        if (!isnap.exists) { alert('Convite inválido ou já utilizado.'); return null; }
        const inv = isnap.data();
        if (inv.used) { alert('Este convite já foi utilizado.'); return null; }
        if (inv.expiresAt && Date.now() > inv.expiresAt) { alert('Este convite expirou. Peça um novo.'); return null; }
        const myEmail = (user.email||'').toLowerCase();
        if ((inv.email||'').toLowerCase() !== myEmail) { alert('Este convite é para outro e-mail: ' + inv.email); return null; }
        // Cria a associação e marca o convite como usado (batch = atômico).
        const batch = window._fbDB.batch();
        const mref = window._fbDB.collection('workspaces').doc(inv.wsId).collection('members').doc(user.uid);
        batch.set(mref, { role: inv.role, email: myEmail, name: user.displayName || myEmail, inviteToken: token });
        batch.update(iref, { used: true, usedAt: new Date().toISOString(), usedBy: user.uid });
        await batch.commit();
        const entry = { id: inv.wsId, name: inv.wsName || 'Workspace convidado', role: inv.role };
        window.myWorkspaces = (window.myWorkspaces || []).filter(w => w.id !== inv.wsId);
        window.myWorkspaces.push(entry);
        try { await window._fbDB.collection('users').doc(user.uid).set({ email: myEmail, workspaces: window.myWorkspaces }, { merge: true }); } catch(e){}
        alert('Você entrou no workspace "' + entry.name + '" como ' + (inv.role === 'edit' ? 'Editor' : 'Somente leitura') + '.');
        return entry;
    } catch(e) {
        console.error('Erro ao aceitar convite', e);
        alert('Não foi possível aceitar o convite: ' + (e && e.message));
        return null;
    }
}
