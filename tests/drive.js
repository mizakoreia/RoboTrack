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

  // 3. Criar projeto (prompt stub)
  await p.evaluate(()=>{ window.prompt=()=> 'Projeto VW'; window.confirm=()=>true; window.alert=()=>{}; });
  await p.evaluate(()=>uiActions.addProject());
  await p.waitForTimeout(200);
  ok('projeto no state', await p.evaluate(()=>state.projects.length===1 && state.projects[0].name==='Projeto VW'));
  ok('projeto gravado no Firestore (subcoleção projects)', await p.evaluate(()=>[...window.__fs.store.keys()].some(k=>/workspaces\/uidOwner\/projects\//.test(k))));
  ok('projeto renderizado no dashboard', await p.evaluate(()=>document.getElementById('dashboard-cards').innerHTML.includes('Projeto VW')));

  // 4. Entrar no projeto, criar célula
  const pid = await p.evaluate(()=>state.projects[0].id);
  await p.evaluate(id=>nav('project', id), pid);
  await p.waitForTimeout(80);
  await p.evaluate(()=>{ window.prompt=()=>'Célula LD'; });
  await p.evaluate(()=>uiActions.addCell());
  await p.waitForTimeout(150);
  ok('célula criada', await p.evaluate(()=>state.projects[0].cells.length===1));

  // 5. Entrar na célula, criar robô (modal)
  const cid = await p.evaluate(()=>state.projects[0].cells[0].id);
  await p.evaluate(a=>nav('cell', a.pid, a.cid), {pid,cid});
  await p.waitForTimeout(80);
  await p.evaluate(()=>{
    document.getElementById('inp-robot-name').value='R01 KUKA';
    document.getElementById('sel-robot-app').value='Solda Ponto';
    uiActions.confirmAddRobot();
  });
  await p.waitForTimeout(150);
  ok('robô criado com tarefas do template', await p.evaluate(()=>{ const r=state.projects[0].cells[0].robots[0]; return r && r.name==='R01 KUKA' && r.tasks.length>0; }));

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

  // 9b. RELATÓRIO (protocolo)
  await p.evaluate(()=>{ window.currentRole='owner'; document.body.dataset.role='owner'; nav('report'); });
  await p.waitForTimeout(120);
  ok('relatório renderiza protocolo', await p.evaluate(()=>document.getElementById('report-sheet').innerHTML.includes('PROTOCOLO DE COMISSIONAMENTO')));
  ok('carimbo de status presente', await p.evaluate(()=>!!document.querySelector('.rpt-stamp')));
  ok('milestones aparecem como evidência', await p.evaluate(()=>document.getElementById('report-sheet').innerHTML.includes('Teach 1-4')));
  ok('bloco de assinaturas', await p.evaluate(()=>!!document.querySelector('.rpt-sign')));
  ok('conclusões listadas', await p.evaluate(()=>document.getElementById('report-sheet').innerHTML.includes('Conclusões')));
  ok('escopo filtra por projeto', await p.evaluate(()=>{ const s=document.getElementById('report-scope'); s.value=state.projects[0].id; ui.renderReport(); return document.querySelectorAll('#report-sheet .rpt-project').length >= 1; }));

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
