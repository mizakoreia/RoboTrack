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

                grid.innerHTML = state.projects.map(p => `
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
                    
                    let obsWarning = (t.progress > 0 && t.progress < 100 && (!t.obs || t.obs.trim() === '')) 
                        ? `border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.1); box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);` 
                        : ``;
                    let obsPlc = obsWarning ? "⚠️ Obrigatório justificar..." : "";

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
                                <input type="range" style="width:100%" value="${t.progress||0}" step="5" oninput="document.getElementById('disp_p_'+'${t.id}').innerText = this.value + '%'" onchange="uiActions.updateTask('${t.id}', 'progress', this.value)" title="Arraste para definir">
                                <button onclick="uiActions.nudgeProgress('${t.id}', +10)" style="font-size:1.1rem;background:rgba(255,255,255,0.05);border-radius:4px;width:24px">+</button>
                            </div>
                        </div></td>
                        <td style="width: 20%">
                            <select style="${respWarning}" onchange="uiActions.updateTask('${t.id}', 'resp', this.value)">
                                <option value="Não Atribuído" disabled hidden>${t.progress > 0 && (!t.resp || t.resp === 'Não Atribuído') ? '⚠️ Escolha...' : 'Selecione'}</option>
                                ${respOptionsHTML.replace(`value="${t.resp}"`, `value="${t.resp}" selected`)}
                            </select>
                        </td>
                        <td style="width: 20%"><input type="text" style="${obsWarning}" placeholder="${obsPlc}" value="${sanitize(t.obs)}" onchange="uiActions.updateTask('${t.id}', 'obs', this.value)"></td>
                        <td><button class="btn-icon" style="color:var(--danger)" onclick="uiActions.deleteTask('${t.id}')">🗑️</button></td></tr>`;
                });
                tbody.innerHTML = html;
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
