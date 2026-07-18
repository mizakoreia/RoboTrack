/* =============================================================================
 * VIEW · ui.js
 * Renderização: lê 'state' e desenha o DOM. Não muta dados nem trata eventos.
 * Depende de: data.js (state, sanitize, activeContext), store.js (appState).
 * ========================================================================== */

        const ui = {
            buildCircle(pct) {
                const dash = `${pct}, 100`; let color = "var(--warning)";
                if(pct >= 100) color = "var(--success)"; else if (pct > 40) color = "var(--accent)";
                return `<div class="progress-circle"><svg viewBox="0 0 36 36"><path class="bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" /><path class="value" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-dasharray="${dash}" style="stroke:${color};" /></svg><div class="text">${pct}%</div></div>`;
            },
            renderDashboard() {
                const grid = document.getElementById('dashboard-cards');
                const hub = document.getElementById('dashboard-hub');
                
                if(!state.projects || state.projects.length === 0) {
                    hub.style.display = 'none';
                    grid.innerHTML = `<div class="empty-state"><p style="margin-bottom:16px;">Nenhum projeto cadastrado ainda.</p><button class="btn btn-primary" onclick="uiActions.addProject()">+ Novo Projeto</button></div>`; return;
                }
                
                // Analytics Math Global Progress
                let totRobots = 0, totTasks = 0, totDone = 0;
                state.projects.forEach(p => {
                    p.cells.forEach(c => {
                        totRobots += c.robots.length;
                        c.robots.forEach(r => {
                            totTasks += r.tasks.length;
                            totDone += r.tasks.filter(t => t.status === "Concluído").length;
                        });
                    });
                });
                let globalPct = totTasks === 0 ? 0 : Math.round((totDone/totTasks)*100);
                
                hub.style.display = 'block';
                hub.innerHTML = `
                    <div style="background:var(--bg-panel); padding:24px; border-radius:16px; border:1px solid var(--border);">
                        <h3 style="margin-bottom:16px; font-weight:600;">Hub Analítico</h3>
                        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;">
                            <span>Projetos Ativos: <b>${state.projects.length}</b></span>
                            <span>Robôs Analisados: <b>${totRobots}</b></span>
                            <span>Tarefas Processadas: <b><span style="color:var(--success)">${totDone}</span> / ${totTasks}</b></span>
                        </div>
                        <div style="width:100%; height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden;">
                            <div style="height:100%; background:var(--accent); width:${globalPct}%; transition:width 1s;"></div>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted); text-align:right; margin-top:8px;">${globalPct}% Progresso Físico Global</div>
                    </div>
                `;

                // Busca: projeto entra se o nome dele, de uma célula ou de um robô casar
                const q = (dashSearch || '').trim().toLowerCase();
                const visible = !q ? state.projects : state.projects.filter(p =>
                    (p.name||'').toLowerCase().includes(q) ||
                    (p.cells||[]).some(c => (c.name||'').toLowerCase().includes(q) ||
                        (c.robots||[]).some(r => (r.name||'').toLowerCase().includes(q))));
                if (q && !visible.length) { grid.innerHTML = `<div class="empty-state">Nada encontrado para "${sanitize(q)}".</div>`; return; }

                grid.innerHTML = visible.map(p => `
                    <div class="swipe-host">
                    <button class="swipe-del" onclick="event.stopPropagation(); uiActions.deleteProject('${p.id}')"><span class="ico">🗑️</span><span>Excluir</span></button>
                    <div class="card" onclick="nav('project', '${p.id}')">
                        <div class="action-btns">
                            <button class="btn-icon" onclick="uiActions.renameProject(event, '${p.id}')">✏️</button>
                            <button class="btn-icon" style="color:var(--danger);" onclick="event.stopPropagation(); uiActions.deleteProject('${p.id}')">🗑️</button>
                        </div>
                        <div class="card-header" style="flex-wrap:wrap; gap:6px;">
                            <span style="display:flex;align-items:center;gap:6px">🏭 ${sanitize(p.name)}</span>
                            <span class="badge" style="background:transparent; border:1px solid var(--border)">${p.cells.length} Células</span>
                        </div>
                        ${ui.buildCircle(appState.calcProjectProgress(p))}
                        <div class="card-footer"><span>Visão Macro</span> <span>Acessar ➔</span></div>
                    </div>
                    </div>
                `).join('');
            },
            renderProject(pid) {
                const p = appState.getProject(pid);
                if(!p) return;
                activeContext.projectId = pid;
                document.getElementById('project-title').innerText = p.name;
                const grid = document.getElementById('project-cells-cards');
                const hub = document.getElementById('project-hub');

                if(p.cells.length === 0) {
                    hub.style.display = 'none';
                    grid.innerHTML = `<div class="empty-state"><p style="margin-bottom:16px;">Nenhuma célula neste projeto.</p><button class="btn btn-primary" onclick="uiActions.addCell()">+ Nova Célula</button></div>`; return;
                }

                let totRobots = 0, totTasks = 0, totDone = 0;
                p.cells.forEach(c => {
                    totRobots += c.robots.length;
                    c.robots.forEach(r => {
                        totTasks += r.tasks.length;
                        totDone += r.tasks.filter(t => t.status === "Concluído").length;
                    });
                });
                let globalPct = totTasks === 0 ? 0 : Math.round((totDone/totTasks)*100);

                hub.style.display = 'block';
                hub.innerHTML = `
                    <div style="background:var(--bg-panel); padding:24px; border-radius:16px; border:1px solid var(--border);">
                        <h3 style="margin-bottom:16px; font-weight:600;">Hub Analítico do Projeto</h3>
                        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;">
                            <span>Células Config.: <b>${p.cells.length}</b></span>
                            <span>Robôs Analisados: <b>${totRobots}</b></span>
                            <span>Tarefas Processadas: <b><span style="color:var(--success)">${totDone}</span> / ${totTasks}</b></span>
                        </div>
                        <div style="width:100%; height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden;">
                            <div style="height:100%; background:var(--accent); width:${globalPct}%; transition:width 1s;"></div>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted); text-align:right; margin-top:8px;">${globalPct}% Progresso Físico do Projeto</div>
                    </div>
                `;

                grid.innerHTML = p.cells.map(c => `
                    <div class="swipe-host">
                    <button class="swipe-del" onclick="event.stopPropagation(); uiActions.deleteCell('${p.id}', '${c.id}')"><span class="ico">🗑️</span><span>Excluir</span></button>
                    <div class="card" onclick="nav('cell', '${p.id}', '${c.id}')">
                        <div class="action-btns">
                            <button class="btn-icon" onclick="uiActions.renameCell(event, '${p.id}', '${c.id}')">✏️</button>
                            <button class="btn-icon" style="color:var(--danger);" onclick="event.stopPropagation(); uiActions.deleteCell('${p.id}', '${c.id}')">🗑️</button>
                        </div>
                        <div class="card-header" style="flex-wrap:wrap; gap:6px;">
                            <span style="display:flex;align-items:center;gap:6px">📦 ${sanitize(c.name)}</span>
                            <span class="badge" style="background:transparent; border:1px solid var(--border)">${c.robots.length} Robôs</span>
                        </div>
                        ${ui.buildCircle(appState.calcCellProgress(c))}
                        <div class="card-footer"><span>Status Global</span> <span>Acessar ➔</span></div>
                    </div>
                    </div>
                `).join('');
            },
            renderCell(pid, cid) {
                const c = appState.getCell(pid, cid);
                if(!c) return;
                activeContext.projectId = pid; activeContext.cellId = cid;
                document.getElementById('cell-title').innerText = c.name;
                document.getElementById('back-to-project-btn').onclick = () => nav('project', pid);
                
                const grid = document.getElementById('cell-robots-cards');
                const hub = document.getElementById('cell-hub');

                if(c.robots.length === 0) {
                    hub.style.display = 'none';
                    grid.innerHTML = `<div class="empty-state"><p style="margin-bottom:16px;">Nenhum robô adicionado ainda.</p><button class="btn btn-primary" onclick="uiActions.openModalAddRobot()">+ Adicionar Robô</button></div>`; return;
                }

                let totTasks = 0, totDone = 0;
                c.robots.forEach(r => {
                    totTasks += r.tasks.length;
                    totDone += r.tasks.filter(t => t.status === "Concluído").length;
                });
                let globalPct = totTasks === 0 ? 0 : Math.round((totDone/totTasks)*100);

                hub.style.display = 'block';
                hub.innerHTML = `
                    <div style="background:var(--bg-panel); padding:24px; border-radius:16px; border:1px solid var(--border);">
                        <h3 style="margin-bottom:16px; font-weight:600;">Hub Analítico da Célula</h3>
                        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;">
                            <span>Robôs Configurados: <b>${c.robots.length}</b></span>
                            <span>Tarefas Processadas: <b><span style="color:var(--success)">${totDone}</span> / ${totTasks}</b></span>
                        </div>
                        <div style="width:100%; height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden;">
                            <div style="height:100%; background:var(--accent); width:${globalPct}%; transition:width 1s;"></div>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted); text-align:right; margin-top:8px;">${globalPct}% Progresso Físico da Célula</div>
                    </div>
                `;

                grid.innerHTML = c.robots.map(r => `
                    <div class="swipe-host">
                    <button class="swipe-del" onclick="event.stopPropagation(); uiActions.deleteRobot('${pid}', '${c.id}', '${r.id}')"><span class="ico">🗑️</span><span>Excluir</span></button>
                    <div class="card" onclick="nav('robot', '${pid}', '${c.id}', '${r.id}')">
                        <div class="action-btns">
                            <button class="btn-icon" onclick="uiActions.renameRobot(event, '${pid}', '${c.id}', '${r.id}')">✏️</button>
                            <button class="btn-icon" style="color:var(--danger);" onclick="event.stopPropagation(); uiActions.deleteRobot('${pid}', '${c.id}', '${r.id}')">🗑️</button>
                        </div>
                        <div class="card-header" style="flex-wrap:wrap; gap:6px;">
                            <span style="display:flex;align-items:center;gap:6px">⚙️ ${sanitize(r.name)}</span>
                            <span class="badge andamento">${r.application || 'Misto / Geral'}</span>
                        </div>
                        ${ui.buildCircle(appState.calcRobotProgress(r))}
                        <div class="card-footer"><span>${r.tasks ? r.tasks.length : 0} Tarefas</span> <span>Editar ➔</span></div>
                    </div>
                    </div>
                `).join('');
            },
            renderRobot(pid, cid, rid) {
                const r = appState.getRobot(pid, cid, rid);
                if(!r) return;
                activeContext.projectId = pid; activeContext.cellId = cid; activeContext.robotId = rid;
                document.getElementById('robot-title').innerText = `Robô ${r.name}`;
                document.getElementById('robot-app-info').innerText = `Aplicação: ${r.application || 'Misto / Geral'}`;
                document.getElementById('rpct_header').innerText = `${appState.calcRobotProgress(r)}% Progresso`;
                document.getElementById('back-to-cell-btn').onclick = () => nav('cell', pid, cid);
                document.getElementById('btn-add-task').onclick = uiActions.addCustomTask;
                document.getElementById('btn-sync-tasks').onclick = uiActions.forceSyncDefault;

                const tbody = document.getElementById('robot-tasks-table').querySelector('tbody');
                if(!r.tasks || r.tasks.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted)">Nenhuma tarefa.</td></tr>`; return;
                }
                
                const respOptionsHTML = (state.responsibles || ["Não Atribuído"]).map(res => `<option value="${sanitize(res)}">${sanitize(res)}</option>`).join('');
                
                let html = '', curCat = '';
                r.tasks.forEach(t => {
                    if (currentTaskFilter === 'P' && t.status === 'Concluído') return;
                    if (currentTaskFilter === 'C' && t.status !== 'Concluído') return;

                    if(curCat !== t.cat) { curCat = t.cat; html += `<tr class="cat-row"><td colspan="6">${sanitize(curCat)}</td></tr>`; }
                    const bc = appState.getStatusStyle(t.status);
                    
                    // Trilha de avanço: último comentário + aviso quando progresso parcial sem registro
                    const hist = t.history || [];
                    const lastEntry = hist.length ? hist[hist.length - 1] : null;
                    const lastComment = lastEntry && lastEntry.comment ? lastEntry.comment : (t.obs || '');
                    const noTrail = (t.progress > 0 && t.progress < 100 && hist.length === 0 && (!t.obs || t.obs.trim() === ''));
                    const contribs = [...new Set(hist.map(h => h.byName).filter(Boolean).filter(n => n !== '(nota anterior)'))];
                    const contribChips = contribs.map(n => `<span class="contrib-chip">${sanitize(n)}</span>`).join('');

                    let respWarning = (t.progress > 0 && (!t.resp || t.resp === 'Não Atribuído'))
                        ? `border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.1); box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);` 
                        : ``;

                    html += `<tr id="tr_${t.id}">
                        <td style="width: 25%">${sanitize(t.desc)}</td>
                        <td style="width: 15%">
                            <select class="status-select ${bc}" id="sel_${t.id}" onchange="uiActions.updateTask('${t.id}', 'status', this.value)">
                                <option value="Pendente" ${t.status==='Pendente'?'selected':''}>Pendente</option>
                                <option value="Em Andamento" ${t.status==='Em Andamento'?'selected':''}>Em Andamento</option>
                                <option value="Concluído" ${t.status==='Concluído'?'selected':''}>Concluído</option>
                                <option value="N/A" ${t.status==='N/A'?'selected':''}>N/A</option>
                            </select>
                        </td>
                        <td style="width: 20%"><div class="slider-cont" style="display:flex; flex-direction:column; gap:8px;">
                            <span style="font-family:monospace;width:30px; font-weight:700" id="disp_p_${t.id}">${t.progress||0}%</span>
                            <div style="display:flex; width:100%; gap:8px;">
                                <button onclick="uiActions.nudgeProgress('${t.id}', -10)" style="font-size:1.1rem;background:rgba(255,255,255,0.05);border-radius:4px;width:24px">-</button>
                                <input type="range" style="width:100%" value="${t.progress||0}" step="5" oninput="document.getElementById('disp_p_'+'${t.id}').innerText = this.value + '%'" onchange="uiActions.openAdvanceModal('${t.id}', this.value)" title="Arraste e solte para registrar avanço">
                                <button onclick="uiActions.nudgeProgress('${t.id}', +10)" style="font-size:1.1rem;background:rgba(255,255,255,0.05);border-radius:4px;width:24px">+</button>
                            </div>
                        </div></td>
                        <td style="width: 20%">
                            <select style="${respWarning}" onchange="uiActions.updateTask('${t.id}', 'resp', this.value)">
                                <option value="Não Atribuído" disabled hidden>${t.progress > 0 && (!t.resp || t.resp === 'Não Atribuído') ? '⚠️ Escolha...' : 'Selecione'}</option>
                                ${respOptionsHTML.replace(`value="${t.resp}"`, `value="${t.resp}" selected`)}
                            </select>
                            ${contribChips ? `<div class="contrib-row">${contribChips}</div>` : ''}
                        </td>
                        <td style="width: 20%">
                            <div class="trail-cell${noTrail ? ' trail-missing' : ''}" onclick="uiActions.openTaskHistory('${t.id}')" title="${sanitize(lastComment)}">
                                <span class="trail-last">${noTrail ? '⚠️ Registre o avanço...' : (lastComment ? sanitize(lastComment) : '<i>Sem registros</i>')}</span>
                                <button class="btn-icon trail-btn" onclick="event.stopPropagation(); uiActions.openTaskHistory('${t.id}')">💬 ${hist.length}</button>
                            </div>
                        </td>
                        <td><button class="btn-icon" style="color:var(--danger)" onclick="uiActions.deleteTask('${t.id}')">🗑️</button></td>
                        <td class="swipe-del-cell"><button class="swipe-del" onclick="event.stopPropagation(); uiActions.deleteTask('${t.id}')"><span class="ico">🗑️</span><span>Excluir</span></button></td></tr>`;
                });
                tbody.innerHTML = html;
            },
            renderMyTasks() {
                const el = document.getElementById('mytasks-list');
                const me = window.currentUserName;
                if (!me) { el.innerHTML = '<div class="empty-state">Faça login.</div>'; return; }
                const rows = [];
                (state.projects||[]).forEach(p => (p.cells||[]).forEach(c => (c.robots||[]).forEach(r => (r.tasks||[]).forEach(t => {
                    if (t.resp === me && t.status !== 'Concluído' && t.status !== 'N/A')
                        rows.push({ p, c, r, t });
                }))));
                if (!rows.length) { el.innerHTML = '<div class="empty-state">🎉 Nenhuma tarefa pendente atribuída a você.</div>'; return; }
                el.innerHTML = `<div class="panel"><table><thead><tr><th>Tarefa</th><th>Robô</th><th>Célula · Projeto</th><th>Status</th><th style="text-align:right">%</th></tr></thead><tbody>` +
                    rows.map(x => `<tr style="cursor:pointer" onclick="nav('robot','${x.p.id}','${x.c.id}','${x.r.id}')">
                        <td>${sanitize(x.t.desc)}</td>
                        <td>${sanitize(x.r.name)}</td>
                        <td>${sanitize(x.c.name)} · ${sanitize(x.p.name)}</td>
                        <td><span class="badge ${appState.getStatusStyle(x.t.status)}">${sanitize(x.t.status)}</span></td>
                        <td style="text-align:right; font-family:monospace; font-weight:700">${x.t.progress||0}%</td>
                    </tr>`).join('') + `</tbody></table></div>`;
            },
            // ===== RELATÓRIO: protocolo industrial de aceite =====
            renderReport() {
                // Seletor de escopo (preserva seleção entre re-renders)
                const sel = document.getElementById('report-scope');
                const prev = sel.value || 'all';
                sel.innerHTML = `<option value="all">Todos os projetos</option>` +
                    (state.projects || []).map(p => `<option value="${p.id}">${sanitize(p.name)}</option>`).join('');
                sel.value = [...sel.options].some(o => o.value === prev) ? prev : 'all';
                const scope = sel.value;
                const projects = scope === 'all' ? (state.projects || []) : (state.projects || []).filter(p => p.id === scope);

                const SYM = { 'Concluído':'✓', 'Em Andamento':'◐', 'N/A':'—', 'Pendente':'○' };
                const CLS = { 'Concluído':'ok', 'Em Andamento':'part', 'N/A':'na', 'Pendente':'pend' };
                const now = new Date();
                const docId = 'RT-' + now.toISOString().slice(0,10).replace(/-/g,'') + '-' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0');

                // Métricas globais do escopo
                let nCells=0, nRobots=0, nTasks=0, dist={ 'Concluído':0,'Em Andamento':0,'Pendente':0,'N/A':0 };
                const conclusions = [];
                projects.forEach(p => (p.cells||[]).forEach(c => { nCells++; (c.robots||[]).forEach(r => { nRobots++; (r.tasks||[]).forEach(t => {
                    nTasks++; dist[t.status] = (dist[t.status]||0)+1;
                    if (t.status === 'Concluído') {
                        const done = (t.history||[]).filter(h => h.to === 100).pop();
                        conclusions.push({ desc:t.desc, robot:r.name, cell:c.name, by:(done&&done.byName)||t.resp||'—', ts:(done&&done.ts)||null });
                    }
                }); }); }));
                const pct = projects.length ? Math.round(projects.reduce((s,p)=>s+appState.calcProjectProgress(p),0)/projects.length) : 0;
                const stampCls = pct === 100 ? 'ok' : (pct > 0 ? 'part' : 'pend');
                const stampTxt = pct === 100 ? 'CONCLUÍDO' : (pct > 0 ? 'EM ANDAMENTO' : 'PENDENTE');
                const fmtTs = ts => ts ? new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
                const bar = (v) => `<div class="rpt-prog"><div class="rpt-bar"><div class="rpt-bar-fill" style="width:${v}%"></div></div><b>${v}%</b></div>`;

                let html = `
                <div class="rpt-doc">
                    <table class="rpt-head"><tr>
                        <td class="rpt-head-title">
                            <div class="rpt-doc-type">PROTOCOLO DE COMISSIONAMENTO</div>
                            <div class="rpt-doc-name">${sanitize(state.wsName || 'RoboTrack')}</div>
                        </td>
                        <td class="rpt-stamp-cell"><div class="rpt-stamp ${stampCls}"><span class="rpt-stamp-pct">${pct}%</span><span class="rpt-stamp-lbl">${stampTxt}</span></div></td>
                    </tr></table>
                    <table class="rpt-meta">
                        <tr><td>Escopo</td><td>${scope==='all' ? 'Todos os projetos ('+projects.length+')' : sanitize(projects[0] ? projects[0].name : '—')}</td><td>Documento</td><td class="rpt-mono">${docId}</td></tr>
                        <tr><td>Emitido em</td><td>${now.toLocaleString('pt-BR')}</td><td>Gerado por</td><td>${sanitize(window.currentUserName || '—')}</td></tr>
                        <tr><td>Estrutura</td><td colspan="3">${projects.length} projeto(s) · ${nCells} célula(s) · ${nRobots} robô(s) · ${nTasks} tarefa(s)</td></tr>
                    </table>
                    <table class="rpt-dist"><tr>
                        <td class="ok">✓ Concluído <b>${dist['Concluído']}</b></td>
                        <td class="part">◐ Em andamento <b>${dist['Em Andamento']}</b></td>
                        <td class="pend">○ Pendente <b>${dist['Pendente']}</b></td>
                        <td class="na">— N/A <b>${dist['N/A']}</b></td>
                    </tr></table>`;

                if (!projects.length) html += `<div class="rpt-empty">Nenhum projeto no escopo selecionado.</div>`;

                projects.forEach(p => {
                    html += `<section class="rpt-project"><div class="rpt-sec"><h2>${sanitize(p.name)}</h2>${bar(appState.calcProjectProgress(p))}</div>`;
                    (p.cells||[]).forEach(c => {
                        html += `<div class="rpt-cell-h"><h3>Célula · ${sanitize(c.name)}</h3>${bar(appState.calcCellProgress(c))}</div>`;
                        (c.robots||[]).forEach(r => {
                            html += `<div class="rpt-robot"><div class="rpt-robot-h"><h4>⚙ ${sanitize(r.name)} <span class="rpt-app">${sanitize(r.application||'Misto / Geral')}</span></h4>${bar(appState.calcRobotProgress(r))}</div>
                            <table class="rpt-tasks"><thead><tr><th></th><th>Tarefa</th><th>Status</th><th class="rpt-r">%</th><th>Responsável</th></tr></thead><tbody>`;
                            (r.tasks||[]).forEach(t => {
                                const cls = CLS[t.status]||'pend';
                                html += `<tr class="rpt-t-${cls}"><td class="rpt-sym ${cls}">${SYM[t.status]||'○'}</td><td>${sanitize(t.desc)}</td><td class="rpt-st ${cls}">${sanitize(t.status)}</td><td class="rpt-r rpt-mono">${t.progress||0}</td><td>${sanitize(t.resp||'—')}</td></tr>`;
                                (t.history||[]).forEach(h => {
                                    if (h.legacy && !h.comment) return;
                                    const delta = (h.from!=null&&h.to!=null) ? `${h.from}→${h.to}%` : '';
                                    html += `<tr class="rpt-ms"><td></td><td colspan="4"><span class="rpt-mono">${fmtTs(h.ts)}</span> · <b>${sanitize(h.byName||'—')}</b>${delta?` · <span class="rpt-mono">${delta}</span>`:''}${h.comment?` · ${sanitize(h.comment)}`:''}</td></tr>`;
                                });
                            });
                            html += `</tbody></table></div>`;
                        });
                    });
                    html += `</section>`;
                });

                if (conclusions.length) {
                    html += `<section class="rpt-project"><div class="rpt-sec"><h2>Conclusões</h2><span class="rpt-mono">${conclusions.length} tarefa(s) a 100%</span></div>
                    <table class="rpt-tasks"><thead><tr><th></th><th>Tarefa</th><th>Robô / Célula</th><th>Concluído por</th><th>Quando</th></tr></thead><tbody>` +
                    conclusions.map(cc => `<tr><td class="rpt-sym ok">✓</td><td>${sanitize(cc.desc)}</td><td>${sanitize(cc.robot)} · ${sanitize(cc.cell)}</td><td>${sanitize(cc.by)}</td><td class="rpt-mono">${fmtTs(cc.ts)}</td></tr>`).join('') +
                    `</tbody></table></section>`;
                }

                html += `
                    <section class="rpt-sign">
                        <div class="rpt-sign-box"><div class="rpt-sign-line"></div><div>Comissionador</div><div class="rpt-mono">Nome / Data</div></div>
                        <div class="rpt-sign-box"><div class="rpt-sign-line"></div><div>Cliente / Aceite</div><div class="rpt-mono">Nome / Data</div></div>
                    </section>
                    <div class="rpt-foot">${docId} · Gerado pelo RoboTrack em ${now.toLocaleString('pt-BR')} · Trilha de avanços registrada por usuário autenticado</div>
                </div>`;

                document.getElementById('report-sheet').innerHTML = html;
            },
            renderSettings() {
                const tt = document.getElementById('tbl-manage-tasks').querySelector('tbody');
                const rl = document.getElementById('responsibles-list');
                
                if(state.responsibles) {
                    rl.innerHTML = state.responsibles.map((r, i) => `
                        <div class="resp-tag">${sanitize(r)} ${r !== 'Não Atribuído' ? `<button onclick="uiActions.deleteResponsibleAt(${i})" style="color:var(--danger)">X</button>` : ''}</div>
                    `).join('');
                }

                if(!state.defaultTasks) return;
                tt.innerHTML = state.defaultTasks.map(t => {
                    const filters = t.appFilters || t.apps || [];
                    const l = (filters.length > 0) ? filters.join(', ') : 'Geral (Todos)';
                    return `<tr><td style="color:var(--accent); font-weight:bold">${sanitize(t.cat)}</td><td>${sanitize(t.desc)}</td>
                    <td style="text-align:left"><button class="btn" style="padding:4px 8px; font-size:0.75rem; background:rgba(255,255,255,0.1); border-color:transparent;" onclick="uiActions.editAppFilter('${t.id}')">✏️ ${sanitize(l)}</button></td>
                    <td style="text-align:right"><button class="btn-icon" style="color:var(--danger)" onclick="uiActions.deleteDefaultTask('${t.id}')">🗑️</button></td></tr>`;
                }).join('');
            }
        };

        // --- ROUTER ---

        function renderWorkspaceSelector() {
            const sel = document.getElementById('ws-selector');
            if (sel) {
                const list = window.myWorkspaces || [];
                sel.innerHTML = list.map(w => `<option value="${w.id}" ${w.id===window.currentWsId?'selected':''}>${sanitize(w.name)}${w.role==='owner'?' (meu)':''}</option>`).join('');
                const wrap = document.getElementById('ws-selector-wrap');
                if (wrap) wrap.style.display = list.length > 1 ? 'flex' : 'none';
            }
            const badge = document.getElementById('ws-role-badge');
            if (badge) {
                const r = window.currentRole;
                badge.style.display = 'inline-block';
                if (r === 'view') { badge.textContent = '👁️ Somente leitura'; badge.style.background = 'rgba(245,158,11,0.15)'; badge.style.color = 'var(--warning)'; }
                else if (r === 'edit') { badge.textContent = '✏️ Editor'; badge.style.background = 'rgba(59,130,246,0.15)'; badge.style.color = 'var(--accent)'; }
                else { badge.textContent = '★ Dono'; badge.style.background = 'rgba(16,185,129,0.15)'; badge.style.color = 'var(--success)'; }
            }
        }
