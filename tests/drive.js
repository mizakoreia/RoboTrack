// Suite de integração do RoboTrack: roda os módulos reais contra um Firestore
// falso em memória (fb-stub.js). Local: node tests/drive.js (usa o Chromium do
// harness se existir). CI: playwright completo instalado pelo workflow.
const fs = require('fs');
const path = require('path');
let chromium, exe;
try { ({ chromium } = require('playwright')); }
catch (e) {
  ({ chromium } = require('playwright-core'));
  exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
}
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const stub = fs.readFileSync(__dirname + '/fb-stub.js', 'utf8');
const R = []; const ok=(n,c)=>R.push([c?'PASS':'FAIL',n]);

(async () => {
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // CDN firebase -> stub (1º define tudo; demais vazios)
  let served = false;
  await p.route(/gstatic\.com\/firebasejs/, route => {
    const body = served ? ';' : stub; served = true;
    route.fulfill({ status:200, contentType:'application/javascript', body });
  });
  await p.goto(APP, { waitUntil:'networkidle' }).catch(()=>{});
  await p.waitForTimeout(400);

  // 1. Estado deslogado -> login visível
  ok('login visível ao abrir', await p.evaluate(()=>getComputedStyle(document.getElementById('login-screen')).display!=='none'));

  // 2. Login como dono
  await p.evaluate(()=>window.__login('uidOwner','rafael@vw.com','Rafael'));
  await p.waitForTimeout(300);
  ok('login some após autenticar', await p.evaluate(()=>getComputedStyle(document.getElementById('login-screen')).display==='none'));
  ok('email no header', await p.evaluate(()=>document.getElementById('header-user-email').textContent.includes('rafael@vw.com')));
  ok('papel = Dono', await p.evaluate(()=>document.body.dataset.role==='owner'));

  // 3. Criar projeto (via modal uiPrompt — substitui o prompt() nativo)
  await p.evaluate(()=>{ window.confirm=()=>true; window.alert=()=>{}; });
  const fillPrompt = async (val) => { await p.waitForTimeout(60); await p.evaluate(v=>{ document.getElementById('prompt-input').value=v; document.getElementById('prompt-ok').click(); }, val); };
  await p.evaluate(()=>{ uiActions.addProject(); });
  await fillPrompt('Projeto VW');
  await p.waitForTimeout(200);
  ok('projeto no state', await p.evaluate(()=>state.projects.length===1 && state.projects[0].name==='Projeto VW'));
  ok('projeto gravado no Firestore (subcoleção projects)', await p.evaluate(()=>[...window.__fs.store.keys()].some(k=>/workspaces\/uidOwner\/projects\//.test(k))));
  ok('projeto renderizado no dashboard', await p.evaluate(()=>document.getElementById('dashboard-cards').innerHTML.includes('Projeto VW')));

  // 4. Entrar no projeto, criar célula
  const pid = await p.evaluate(()=>state.projects[0].id);
  await p.evaluate(id=>nav('project', id), pid);
  await p.waitForTimeout(80);
  await p.evaluate(()=>{ uiActions.addCell(); });
  await fillPrompt('Célula LD');
  await p.waitForTimeout(150);
  ok('célula criada', await p.evaluate(()=>state.projects[0].cells.length===1));

  // 5. Entrar na célula, criar robô (modal)
  const cid = await p.evaluate(()=>state.projects[0].cells[0].id);
  await p.evaluate(a=>nav('cell', a.pid, a.cid), {pid,cid});
  await p.waitForTimeout(80);
  // Fluxo 2 passos: define quantidade+aplicação, gera campos, nomeia, cadastra
  await p.evaluate(()=>{
    uiActions.openModalAddRobot();
    document.getElementById('inp-robot-qty').value='1';
    document.getElementById('sel-robot-app').value='Solda Ponto';
    uiActions.robotStep2();
    document.querySelectorAll('#robot-names .robot-name-inp')[0].value='R01 KUKA';
    uiActions.confirmAddRobot();
  });
  await p.waitForTimeout(150);
  ok('robô criado com tarefas do template', await p.evaluate(()=>{ const r=state.projects[0].cells[0].robots[0]; return r && r.name==='R01 KUKA' && r.tasks.length>0; }));

  // 5b. Vários robôs de uma vez (qty gera N campos; ignora vazios/duplicados)
  await p.evaluate(()=>{
    uiActions.openModalAddRobot();
    document.getElementById('inp-robot-qty').value='3';
    document.getElementById('sel-robot-app').value='Handling';
    uiActions.robotStep2();
    const ins=document.querySelectorAll('#robot-names .robot-name-inp');
    ins[0].value='R02 Handling'; ins[1].value='R03 Sealing'; ins[2].value='R03 Sealing';
    uiActions.confirmAddRobot();
  });
  await p.waitForTimeout(150);
  ok('gera N campos e cria múltiplos robôs (sem duplicar)', await p.evaluate(()=>{ const rs=state.projects[0].cells[0].robots.map(r=>r.name); return rs.includes('R02 Handling') && rs.includes('R03 Sealing') && rs.filter(n=>n==='R03 Sealing').length===1 && rs.length===3; }));

  // 6. Entrar no robô, concluir 1ª tarefa -> progresso + log + save
  const rid = await p.evaluate(()=>state.projects[0].cells[0].robots[0].id);
  await p.evaluate(a=>nav('robot', a.pid, a.cid, a.rid), {pid,cid,rid});
  await p.waitForTimeout(80);
  const tid = await p.evaluate(()=>state.projects[0].cells[0].robots[0].tasks[0].id);
  await p.evaluate(id=>uiActions.updateTask(id,'progress',100), tid);
  await p.waitForTimeout(150);
  ok('tarefa concluída persistida', await p.evaluate(()=>state.projects[0].cells[0].robots[0].tasks[0].status==='Concluído'));
  ok('log append-only gravado', await p.evaluate(()=>[...window.__fs.store.keys()].some(k=>/workspaces\/uidOwner\/logs\//.test(k))));
  ok('progresso do robô calculado', await p.evaluate(()=>appState.calcRobotProgress(state.projects[0].cells[0].robots[0])>0));
  // Editar tarefa: botão ✏️ presente e renomeia a descrição via modal
  ok('tarefa tem botões editar + excluir', await p.evaluate(()=>{ const h=document.getElementById('robot-tasks-table').innerHTML; return h.includes('renameTask') && h.includes('deleteTask'); }));
  await p.evaluate(id=>{ uiActions.renameTask(id); }, tid);
  await fillPrompt('Base instalada (revisada)');
  await p.waitForTimeout(150);
  ok('editar tarefa altera a descrição', await p.evaluate(()=>state.projects[0].cells[0].robots[0].tasks[0].desc==='Base instalada (revisada)'));

  // 7. Abrir modal de logs -> lê coleção
  await p.evaluate(()=>uiActions.openLogsModal());
  await p.waitForTimeout(200);
  ok('modal de logs mostra registro', await p.evaluate(()=>document.getElementById('logs-list').innerHTML.includes('concluiu')));

  // 7b. MILESTONES: modal de avanço, comentário obrigatório, multiusuário
  await p.evaluate(()=>{ window.__lastAlert=null; window.alert=m=>{window.__lastAlert=m;}; });
  const tid2 = await p.evaluate(()=>state.projects[0].cells[0].robots[0].tasks[1].id);
  // legacy obs presente -> deve migrar
  await p.evaluate(id=>{ const t=state.projects[0].cells[0].robots[0].tasks.find(x=>x.id===id); t.obs='nota antiga'; }, tid2);
  await p.evaluate(id=>uiActions.openAdvanceModal(id, 40), tid2);
  ok('modal de avanço abre', await p.evaluate(()=>document.getElementById('modal-advance').classList.contains('active')));
  // sem comentário e <100 -> bloqueia
  await p.evaluate(()=>uiActions.confirmAdvance());
  ok('sem comentário <100 bloqueia (alerta + modal aberto)', await p.evaluate(()=>window.__lastAlert!==null && document.getElementById('modal-advance').classList.contains('active')));
  ok('nada gravado no bloqueio', await p.evaluate(()=>{ const t=state.projects[0].cells[0].robots[0].tasks[1]; return !t.history || t.history.length===0; }));
  // com comentário -> grava milestone + migra legado
  await p.evaluate(()=>{ document.getElementById('advance-comment').value='Teach 1-4 feito; falta descarte.'; });
  await p.evaluate(()=>uiActions.confirmAdvance());
  await p.waitForTimeout(150);
  ok('milestone gravada com autor', await p.evaluate(()=>{ const h=state.projects[0].cells[0].robots[0].tasks[1].history; return h && h.length===2 && h[1].byName==='Rafael' && h[1].to===40 && h[1].comment.includes('Teach'); }));
  ok('obs legado virou 1ª entrada', await p.evaluate(()=>{ const h=state.projects[0].cells[0].robots[0].tasks[1].history; return h[0].legacy===true && h[0].comment==='nota antiga'; }));
  ok('progresso aplicado (40%)', await p.evaluate(()=>state.projects[0].cells[0].robots[0].tasks[1].progress===40));
  // segundo usuário avança o MESMO item
  await p.evaluate(()=>{ window.currentUserId='uidAna'; window.currentUserName='Ana'; });
  await p.evaluate(id=>uiActions.openAdvanceModal(id, 60), tid2);
  await p.evaluate(()=>{ document.getElementById('advance-comment').value='Descarte teachado, falta validar.'; });
  await p.evaluate(()=>uiActions.confirmAdvance());
  await p.waitForTimeout(150);
  ok('2º usuário: entrada própria', await p.evaluate(()=>{ const h=state.projects[0].cells[0].robots[0].tasks[1].history; return h.length===3 && h[2].byName==='Ana' && h[2].from===40 && h[2].to===60; }));
  ok('chips mostram os 2 contributors', await p.evaluate(()=>{ const html=document.getElementById('robot-tasks-table').innerHTML; return html.includes('Rafael') && html.includes('Ana'); }));
  ok('preview mostra último comentário', await p.evaluate(()=>document.getElementById('robot-tasks-table').innerHTML.includes('Descarte teachado')));
  // avanço a 100 sem comentário -> permitido
  await p.evaluate(id=>uiActions.openAdvanceModal(id, 100), tid2);
  await p.evaluate(()=>uiActions.confirmAdvance());
  await p.waitForTimeout(150);
  ok('100% sem comentário permitido', await p.evaluate(()=>{ const t=state.projects[0].cells[0].robots[0].tasks[1]; return t.progress===100 && t.status==='Concluído' && t.history.length===4; }));
  // timeline modal
  await p.evaluate(id=>uiActions.openTaskHistory(id), tid2);
  ok('timeline lista autores e deltas', await p.evaluate(()=>{ const h=document.getElementById('th-timeline').innerHTML; return h.includes('Ana') && h.includes('40% → 60%'); }));
  await p.evaluate(()=>document.getElementById('modal-task-history').classList.remove('active'));
  // volta identidade
  await p.evaluate(()=>{ window.currentUserId='uidOwner'; window.currentUserName='Rafael'; });

  // 8. Convite: cria invite doc + link único
  await p.evaluate(()=>{ document.getElementById('inp-invite-email').value='ana@vw.com'; document.getElementById('sel-invite-role').value='view'; });
  await p.evaluate(()=>uiActions.createInvite());
  await p.waitForTimeout(200);
  ok('convite gravado em invites', await p.evaluate(()=>[...window.__fs.store.keys()].some(k=>/^invites\//.test(k))));
  ok('link único gerado com ?convite=', await p.evaluate(()=>{ const v=document.getElementById('invite-link-input').value; return v.includes('?convite='); }));

  // 8b. GESTÃO DE EQUIPE (membros + convites pendentes)
  await p.evaluate(()=>window.__fs.store.set('workspaces/uidOwner/members/uidAna', { email:'ana@vw.com', role:'view', inviteToken:'tk' }));
  await p.evaluate(()=>uiActions.loadTeam());
  await p.waitForTimeout(200);
  ok('lista membros mostra Ana', await p.evaluate(()=>document.getElementById('ws-members-list').innerHTML.includes('ana@vw.com')));
  ok('lista convites pendentes mostra e-mail', await p.evaluate(()=>document.getElementById('ws-invites-list').innerHTML.includes('ana@vw.com')));
  await p.evaluate(()=>uiActions.setMemberRole('uidAna','edit'));
  await p.waitForTimeout(150);
  ok('trocar papel grava edit', await p.evaluate(()=>window.__fs.store.get('workspaces/uidOwner/members/uidAna').role==='edit'));
  await p.evaluate(()=>uiActions.removeMember('uidAna'));
  await p.waitForTimeout(150);
  ok('remover membro apaga doc', await p.evaluate(()=>!window.__fs.store.has('workspaces/uidOwner/members/uidAna')));
  const invTok = await p.evaluate(()=>[...window.__fs.store.keys()].find(k=>k.startsWith('invites/')).split('/')[1]);
  await p.evaluate(t=>uiActions.revokeInvite(t), invTok);
  await p.waitForTimeout(150);
  ok('revogar convite apaga doc', await p.evaluate(()=>![...window.__fs.store.keys()].some(k=>k.startsWith('invites/'))));

  // 9. Permissão VIEW: força papel view e tenta editar -> bloqueado (nada grava)
  await p.evaluate(()=>{ window.currentRole='view'; document.body.dataset.role='view'; });
  const before = await p.evaluate(()=>window.__fs.log.length);
  await p.evaluate(id=>uiActions.updateTask(id,'status','Pendente'), tid);
  await p.waitForTimeout(120);
  const after = await p.evaluate(()=>window.__fs.log.length);
  ok('VIEW não grava (updateTask bloqueado)', before===after);
  ok('VIEW esconde botões de edição (CSS)', await p.evaluate(()=>{ const bt=document.getElementById('btn-add-task'); return bt? getComputedStyle(bt).display==='none' : true; }));
  await p.evaluate(id=>uiActions.openAdvanceModal(id, 80), tid);
  ok('VIEW não abre modal de avanço', await p.evaluate(()=>!document.getElementById('modal-advance').classList.contains('active')));
  await p.evaluate(id=>uiActions.openTaskHistory(id), tid2);
  ok('VIEW consegue ver histórico', await p.evaluate(()=>document.getElementById('modal-task-history').classList.contains('active')));
  await p.evaluate(()=>document.getElementById('modal-task-history').classList.remove('active'));

  // 9a2. BUSCA + MINHAS TAREFAS
  await p.evaluate(()=>{ document.querySelectorAll('.modal-overlay.active').forEach(m=>m.classList.remove('active')); });
  await p.evaluate(()=>{ window.currentRole='owner'; document.body.dataset.role='owner'; nav('dashboard'); });
  await p.waitForTimeout(120);
  await p.evaluate(()=>{ dashSearch='inexistente-xyz'; ui.renderDashboard(); });
  ok('busca sem match mostra vazio', await p.evaluate(()=>document.getElementById('search-results').innerHTML.includes('Nada encontrado')));
  await p.evaluate(()=>{ dashSearch='KUKA'; ui.renderDashboard(); });
  ok('busca por robô lista o ROBÔ como resultado', await p.evaluate(()=>{ const h=document.getElementById('search-results').innerHTML; return h.includes('R01 KUKA') && h.includes('Robô ·'); }));
  // Digitação REAL no campo + doc de projeto incompleto não pode quebrar o render.
  await p.evaluate(()=>{ state.projects.push({ id:'incompleto', name:'Doc Incompleto' }); dashSearch=''; });
  await p.fill('#dash-search', '');
  await p.type('#dash-search', 'KUKA');
  await p.waitForTimeout(150);
  ok('digitar lista resultados mesmo com doc incompleto no state', await p.evaluate(()=>{ const h=document.getElementById('search-results').innerHTML; return dashSearch==='KUKA' && h.includes('R01 KUKA') && !h.includes('Doc Incompleto'); }));
  // Botão Buscar aplica; clicar num resultado navega até o robô
  await p.evaluate(()=>{ document.getElementById('dash-search').value='Célula LD'; });
  await p.click('#dash-search-go');
  await p.waitForTimeout(150);
  ok('botão Buscar lista a célula', await p.evaluate(()=>document.getElementById('search-results').innerHTML.includes('Célula ·')));
  await p.evaluate(()=>{ document.getElementById('dash-search').value='KUKA'; });
  await p.click('#dash-search-go');
  await p.waitForTimeout(150);
  await p.click('#search-results .search-item');
  await p.waitForTimeout(150);
  ok('clicar no resultado navega pra view do robô', await p.evaluate(()=>document.getElementById('view-robot').classList.contains('active')));
  await p.evaluate(()=>{ nav('dashboard'); });
  await p.waitForTimeout(120);
  // Limpar restaura o dashboard normal (cards de volta)
  await p.click('#dash-search-clear');
  await p.waitForTimeout(150);
  ok('limpar busca restaura os cards', await p.evaluate(()=>dashSearch==='' && document.getElementById('dashboard-cards').innerHTML.includes('Projeto VW') && document.getElementById('search-results').style.display==='none'));
  await p.evaluate(()=>{ state.projects = state.projects.filter(x=>x.id!=='incompleto'); dashSearch=''; ui.renderDashboard(); });
  await p.evaluate(()=>{ const t=state.projects[0].cells[0].robots[0].tasks[2]; t.resp='Rafael'; t.status='Em Andamento'; t.progress=30; nav('mytasks'); });
  await p.waitForTimeout(120);
  ok('minhas tarefas lista atribuída a mim', await p.evaluate(()=>document.getElementById('mytasks-list').innerHTML.includes('R01 KUKA')));
  ok('minhas tarefas exclui concluídas', await p.evaluate(()=>{ const html=document.getElementById('mytasks-list').innerHTML; const done=state.projects[0].cells[0].robots[0].tasks[1].desc; return !html.includes(done); }));

  // 9a2b. ATRIBUIÇÃO MÚLTIPLA (várias pessoas na mesma tarefa)
  await p.evaluate(()=>{ window.currentRole='owner'; state.responsibles=['Não Atribuído','Rafael','Bruna','Carlos']; const pj=state.projects[0]; nav('robot',pj.id,pj.cells[0].id,pj.cells[0].robots[0].id); });
  await p.waitForTimeout(120);
  const t0 = await p.evaluate(()=>state.projects[0].cells[0].robots[0].tasks[2].id);
  await p.evaluate(id=>uiActions.openAssignModal(id), t0);
  await p.waitForTimeout(40);
  ok('modal de atribuição lista as pessoas', await p.evaluate(()=>document.querySelectorAll('#assign-list .assign-cb').length===3));
  await p.evaluate(()=>{ document.querySelectorAll('#assign-list .assign-cb').forEach(cb=>{ cb.checked = (cb.value==='Bruna'||cb.value==='Carlos'); }); uiActions.confirmAssign(); });
  await p.waitForTimeout(120);
  ok('atribui múltiplos responsáveis à tarefa', await p.evaluate(()=>{ const a=state.projects[0].cells[0].robots[0].tasks[2].assignees||[]; return a.includes('Bruna')&&a.includes('Carlos')&&a.length===2; }));
  ok('linha mostra chips dos responsáveis', await p.evaluate(()=>{ const h=document.getElementById('robot-tasks-table').innerHTML; return h.includes('assignee-chip')&&h.includes('Bruna')&&h.includes('Carlos'); }));
  ok('minhas tarefas vê a pessoa entre vários', await p.evaluate(()=>{ window.currentUserName='Carlos'; nav('mytasks'); return true; }));
  await p.waitForTimeout(120);
  ok('atribuído entre vários aparece em Minhas Tarefas', await p.evaluate(()=>document.getElementById('mytasks-list').innerHTML.includes('R01 KUKA')));
  await p.evaluate(()=>{ window.currentUserName='Rafael'; });

  // 9a2c. NOTIFICAÇÕES (sininho)
  // A atribuição de Bruna+Carlos (9a2b, feita por Rafael) deve ter criado 1 doc por alvo.
  ok('atribuir cria notificações p/ os novos responsáveis', await p.evaluate(()=>{
    const ns=[...window.__fs.store.entries()].filter(([k])=>/workspaces\/uidOwner\/notifications\//.test(k)).map(([,v])=>v);
    return ns.some(n=>n.target==='Bruna'&&n.type==='assign') && ns.some(n=>n.target==='Carlos'&&n.type==='assign');
  }));
  ok('quem atribui não é notificado', await p.evaluate(()=>{
    const ns=[...window.__fs.store.entries()].filter(([k])=>/notifications\//.test(k)).map(([,v])=>v);
    return !ns.some(n=>n.target==='Rafael'&&n.type==='assign');
  }));
  // Avanço registrado por outra pessoa notifica os responsáveis (progress e done)
  await p.evaluate(()=>{ const pj=state.projects[0]; nav('robot',pj.id,pj.cells[0].id,pj.cells[0].robots[0].id); });
  await p.waitForTimeout(120);
  await p.evaluate(()=>{ const t=state.projects[0].cells[0].robots[0].tasks[2]; uiActions.updateTask(t.id,'progress',60); });
  await p.waitForTimeout(120);
  ok('avanço gera notificação progress', await p.evaluate(()=>{
    const ns=[...window.__fs.store.entries()].filter(([k])=>/notifications\//.test(k)).map(([,v])=>v);
    return ns.some(n=>n.type==='progress'&&(n.target==='Bruna'||n.target==='Carlos'));
  }));
  await p.evaluate(()=>{ const t=state.projects[0].cells[0].robots[0].tasks[2]; uiActions.updateTask(t.id,'progress',100); });
  await p.waitForTimeout(120);
  ok('conclusão gera notificação done', await p.evaluate(()=>{
    const ns=[...window.__fs.store.entries()].filter(([k])=>/notifications\//.test(k)).map(([,v])=>v);
    return ns.some(n=>n.type==='done');
  }));
  // Badge + marcar como lida: cria uma notificação PARA Rafael (autor: Bruna)
  await p.evaluate(()=>{ window.currentUserName='Bruna';
    appState.notify(['Rafael'],'assign','Bruna atribuiu você à tarefa "Teste sino"',{pid:state.projects[0].id});
    window.currentUserName='Rafael'; });
  await p.waitForTimeout(250);
  ok('sininho recebe a notificação em tempo real', await p.evaluate(()=>(state.myNotifs||[]).some(n=>n.msg.includes('Teste sino'))));
  ok('badge mostra não-lidas', await p.evaluate(()=>{ const b=document.getElementById('notif-badge'); return b && b.style.display!=='none' && parseInt(b.textContent)>=1; }));
  ok('abrir notificação marca como lida', await p.evaluate(()=>{
    const n=(state.myNotifs||[]).find(x=>x.msg.includes('Teste sino'));
    uiActions.openNotif(n.id);
    const doc=[...window.__fs.store.entries()].find(([k])=>k.endsWith('notifications/'+n.id));
    return n.read===true && doc && doc[1].read===true;
  }));

  // 9a3. SWIPE-PARA-EXCLUIR (fiação; a física de toque é validada manualmente)
  await p.evaluate(()=>{ const p=state.projects[0],c=p.cells[0],r=c.robots[0]; nav('robot',p.id,c.id,r.id); });
  await p.waitForTimeout(120);
  ok('swipe: linhas de tarefa têm célula de exclusão', await p.evaluate(()=>document.getElementById('robot-tasks-table').innerHTML.includes('swipe-del-cell')));
  await p.evaluate(()=>{ nav('dashboard'); });
  await p.waitForTimeout(120);
  ok('swipe: cards do dashboard têm ações Editar + Excluir', await p.evaluate(()=>{ const h=document.getElementById('dashboard-cards').innerHTML; return h.includes('swipe-host') && h.includes('swipe-edit') && h.includes('swipe-del'); }));
  ok('swipe-del remove o card e recalcula (some do total)', await p.evaluate(()=>{
    const before = state.projects.length;
    state.projects.push({ id:'tmp_del', name:'ZZ Temp Swipe', cells:[] });
    ui.renderDashboard();
    const host = [...document.querySelectorAll('.swipe-host')].find(h=>h.innerHTML.includes('ZZ Temp Swipe'));
    host.querySelector('.swipe-del').click(); // window.confirm=>true
    return state.projects.length===before && !document.getElementById('dashboard-cards').innerHTML.includes('ZZ Temp Swipe');
  }));

  // 9a4. REORDENAR (drag & drop) — testa a fiação commitReorder + persistência _ord
  ok('cards têm alça de arraste + data-id', await p.evaluate(()=>{ const h=document.getElementById('dashboard-cards'); return h.dataset.reorder==='project' && h.innerHTML.includes('drag-handle') && !!h.querySelector('.swipe-host[data-id]'); }));
  ok('reordenar aplica nova ordem e persiste _ord', await p.evaluate(()=>{
    window.currentRole='owner';
    const saved = []; const origSave = appState.saveProject; appState.saveProject = id => saved.push(id); // isola do sync do stub
    const origProjects = state.projects; // preserva o estado real p/ os testes seguintes
    state.projects=[{id:'ra',name:'A',cells:[],_ord:0},{id:'rb',name:'B',cells:[],_ord:1},{id:'rc',name:'C',cells:[],_ord:2}];
    uiActions.commitReorder('project', ['rc','ra','rb']); // nova ordem: C, A, B
    const ord = state.projects.map(p=>p.id).join(',');
    const ords = state.projects.map(p=>p._ord).join(',');
    appState.saveProject = origSave; state.projects = origProjects;
    return ord==='rc,ra,rb' && ords==='0,1,2' && saved.includes('rc') && saved.includes('ra') && saved.includes('rb');
  }));

  // 9b. RELATÓRIO (protocolo)
  await p.evaluate(()=>{ window.currentRole='owner'; document.body.dataset.role='owner'; nav('report'); });
  await p.waitForTimeout(120);
  ok('relatório renderiza protocolo', await p.evaluate(()=>document.getElementById('report-sheet').innerHTML.includes('PROTOCOLO DE COMISSIONAMENTO')));
  ok('carimbo de status presente', await p.evaluate(()=>!!document.querySelector('.rpt-stamp')));
  ok('milestones aparecem como evidência', await p.evaluate(()=>document.getElementById('report-sheet').innerHTML.includes('Teach 1-4')));
  ok('bloco de assinaturas', await p.evaluate(()=>!!document.querySelector('.rpt-sign')));
  ok('conclusões listadas', await p.evaluate(()=>document.getElementById('report-sheet').innerHTML.includes('Conclusões')));
  ok('escopo filtra por projeto', await p.evaluate(()=>{ const s=document.getElementById('report-scope'); s.value=state.projects[0].id; ui.renderReport(); return document.querySelectorAll('#report-sheet .rpt-project').length >= 1; }));

  // 9c. MATRIZ robôs × tarefas
  ok('buildMatrixData agrupa por categoria e marca N/A', await p.evaluate(()=>{
    const m = ui.buildMatrixData([{ name:'P', cells:[{ name:'C', robots:[
      { name:'R1', application:'Solda', tasks:[
        { cat:'Fase A', desc:'T1', status:'Concluído', progress:100 },
        { cat:'Fase A', desc:'T2', status:'N/A', progress:0 },
        { cat:'Fase B', desc:'T3', status:'Em Andamento', progress:40 } ] },
      { name:'R2', application:'Handling', tasks:[
        { cat:'Fase A', desc:'T1', status:'Pendente', progress:0 } ] } ] }] }]);
    const c = m[0];
    return m.length===1 && c.cats.length===2 && c.cats[0].tasks.length===2
      && c.rows.length===2 && c.rows[0].vals['Fase A T2'].na===true
      && c.rows[0].vals['Fase B T3'].pct===40 && !c.rows[1].vals['Fase B T3'];
  }));
  await p.evaluate(()=>{ uiActions.setReportMode('matrix'); });
  await p.waitForTimeout(120);
  ok('modo Matriz renderiza a tabela com robô e categoria', await p.evaluate(()=>{
    const h=document.getElementById('report-matrix').innerHTML;
    return document.getElementById('report-matrix').style.display!=='none' && h.includes('mx-table') && h.includes('R01 KUKA');
  }));
  ok('botão Exportar Excel só no modo Matriz', await p.evaluate(()=>{
    const x=document.getElementById('btn-report-xlsx').style.display!=='none';
    const pr=document.getElementById('btn-report-print').style.display==='none';
    uiActions.setReportMode('proto');
    const back=document.getElementById('btn-report-xlsx').style.display==='none';
    return x && pr && back;
  }));

  // 10. Logout -> login volta
  await p.evaluate(()=>{ window.currentRole='owner'; firebase.auth().signOut(); });
  await p.waitForTimeout(200);
  ok('logout traz login de volta', await p.evaluate(()=>getComputedStyle(document.getElementById('login-screen')).display!=='none'));

  console.log('\n=== RESULTADOS ===');
  R.forEach(([s,n])=>console.log(s==='PASS'?'✅':'❌', n));
  console.log('\nPASS '+R.filter(r=>r[0]==='PASS').length+'/'+R.length);
  const realErrs = errs.filter(e=>!/firebase is not defined|auth is not defined/.test(e));
  console.log('erros JS inesperados:', JSON.stringify(realErrs.slice(0,6)));
  await b.close();
  process.exit(R.some(r=>r[0]==='FAIL')||realErrs.length ? 1 : 0);
})();
