/* =============================================================================
 * VIEW · ui.js
 * Renderização: lê 'state' e desenha o DOM. Não muta dados nem trata eventos.
 * Depende de: icons.js (icon), data.js (state, sanitize, activeContext),
 *             store.js (appState).
 * ========================================================================== */

        const ui = {
            buildCircle(pct) {
                const dash = `${pct}, 100`; let color = "var(--warning)";
                if(pct >= 100) color = "var(--success)"; else if (pct > 40) color = "var(--accent)";
                const ring = 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';
                // A 0% o traço é omitido: com stroke-linecap:round um dash de
                // comprimento zero vira um ponto, sugerindo avanço que não existe.
                const value = pct > 0
                    ? `<path class="value" d="${ring}" stroke-dasharray="${dash}" style="stroke:${color};" />`
                    : '';
                return `<div class="progress-circle" role="img" aria-label="${pct}% concluído"><svg viewBox="0 0 36 36" aria-hidden="true"><path class="bg" d="${ring}" />${value}</svg><div class="text">${pct}%</div></div>`;
            },

            // Hub analítico: os mesmos números de sempre, agora com hierarquia —
            // valor grande, rótulo pequeno, barra de progresso embaixo.
            buildHub(title, stats, pct, footLabel) {
                const cells = stats.map(s => `
                    <div class="hub-stat">
                        <span class="hub-stat-k">${s.k}</span>
                        <span class="hub-stat-v">${s.v}</span>
                    </div>`).join('');
                return `
                    <div class="hub glass glass-sheen">
                        <div class="hub-title">${title}</div>
                        <div class="hub-stats">${cells}</div>
                        <div class="hub-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                            <div class="hub-bar-fill" style="transform:scaleX(${pct / 100})"></div>
                        </div>
                        <div class="hub-foot">${pct}% ${footLabel}</div>
                    </div>`;
            },

            // Card de entidade (projeto / célula / robô). Um só molde: o que muda
            // é o ícone, o badge e o rodapé.
            buildCard(o) {
                return `
                    <div class="swipe-host" data-id="${o.id}">
                    <button class="swipe-edit" onclick="event.stopPropagation(); ${o.onEdit}">${icon('pencil')}<span>Editar</span></button>
                    <button class="swipe-del" onclick="event.stopPropagation(); ${o.onDelete}">${icon('trash')}<span>Excluir</span></button>
                    <div class="card glass" onclick="${o.onOpen}">
                        <div class="card-header">
                            <div class="card-head-main">
                                <span class="drag-handle" onclick="event.stopPropagation()" title="Arraste para reordenar" aria-hidden="true">${icon('grip')}</span>
                                <span class="entity-ic">${icon(o.iconName)}</span>
                                <span class="card-title">${sanitize(o.name)}</span>
                            </div>
                            <div class="action-btns">
                                <button class="btn-icon" title="${o.editLabel}" aria-label="${o.editLabel}" onclick="event.stopPropagation(); ${o.onEdit}">${icon('pencil')}</button>
                                <button class="btn-icon btn-icon-danger" title="${o.delLabel}" aria-label="${o.delLabel}" onclick="event.stopPropagation(); ${o.onDeleteInline}">${icon('trash')}</button>
                            </div>
                        </div>
                        <div class="card-meta"><span class="badge ${o.badgeClass || ''}">${sanitize(o.badge)}</span></div>
                        ${ui.buildCircle(o.pct)}
                        <div class="card-footer"><span>${o.foot}</span> <span class="card-go">${o.cta} ${icon('arrow-right')}</span></div>
                    </div>
                    </div>`;
            },

            buildEmpty(iconName, text, action) {
                return `<div class="empty-state">${icon(iconName)}<p>${text}</p>${action || ''}</div>`;
            },

            renderDashboard() {
                const grid = document.getElementById('dashboard-cards');
                const hub = document.getElementById('dashboard-hub');

                if(!state.projects || state.projects.length === 0) {
                    hub.style.display = 'none';
                    grid.innerHTML = ui.buildEmpty('factory', 'Nenhum projeto cadastrado ainda.',
                        `<button class="btn btn-primary edit-only" onclick="uiActions.addProject()">${icon('plus')} Novo Projeto</button>`);
                    return;
                }

                // Analytics Math Global Progress
                let totRobots = 0, totTasks = 0, totDone = 0;
                state.projects.forEach(p => {
                    (p.cells || []).forEach(c => {
                        totRobots += (c.robots || []).length;
                        (c.robots || []).forEach(r => {
                            totTasks += (r.tasks || []).length;
                            totDone += (r.tasks || []).filter(t => t.status === "Concluído").length;
                        });
                    });
                });
                let globalPct = totTasks === 0 ? 0 : Math.round((totDone/totTasks)*100);

                hub.style.display = 'block';
                hub.innerHTML = ui.buildHub('Hub analítico', [
                    { k: 'Projetos ativos', v: state.projects.length },
                    { k: 'Robôs analisados', v: totRobots },
                    { k: 'Tarefas concluídas', v: `<span class="ink-success">${totDone}</span> / ${totTasks}` }
                ], globalPct, 'de progresso físico global');

                // Busca: projeto entra se o nome dele, de uma célula ou de um robô casar
                const q = (dashSearch || '').trim().toLowerCase();
                const visible = !q ? state.projects : state.projects.filter(p =>
                    (p.name||'').toLowerCase().includes(q) ||
                    (p.cells||[]).some(c => (c.name||'').toLowerCase().includes(q) ||
                        (c.robots||[]).some(r => (r.name||'').toLowerCase().includes(q))));
                if (q && !visible.length) {
                    grid.innerHTML = ui.buildEmpty('search', `Nada encontrado para "${sanitize(q)}".`);
                    return;
                }

                grid.dataset.reorder = 'project';
                grid.innerHTML = visible.map(p => ui.buildCard({
                    id: p.id, iconName: 'factory', name: p.name,
                    badge: `${(p.cells||[]).length} ${(p.cells||[]).length === 1 ? 'célula' : 'células'}`,
                    pct: appState.calcProjectProgress(p),
                    foot: 'Visão macro', cta: 'Acessar',
                    editLabel: 'Renomear projeto', delLabel: 'Excluir projeto',
                    onOpen: `nav('project', '${p.id}')`,
                    onEdit: `uiActions.renameProject(event, '${p.id}')`,
                    onDelete: `uiActions.deleteProject('${p.id}', true)`,
                    onDeleteInline: `uiActions.deleteProject('${p.id}')`
                })).join('');
            },

            renderProject(pid) {
                const p = appState.getProject(pid);
                if(!p) return;
                activeContext.projectId = pid;
                document.getElementById('project-title').innerText = p.name;
                const grid = document.getElementById('project-cells-cards');
                const hub = document.getElementById('project-hub');

                if(!p.cells) p.cells = [];
                if(p.cells.length === 0) {
                    hub.style.display = 'none';
                    grid.innerHTML = ui.buildEmpty('box', 'Nenhuma célula neste projeto.',
                        `<button class="btn btn-primary" onclick="uiActions.addCell()">${icon('plus')} Nova Célula</button>`);
                    return;
                }

                let totRobots = 0, totTasks = 0, totDone = 0;
                (p.cells || []).forEach(c => {
                    totRobots += (c.robots || []).length;
                    (c.robots || []).forEach(r => {
                        totTasks += (r.tasks || []).length;
                        totDone += (r.tasks || []).filter(t => t.status === "Concluído").length;
                    });
                });
                let globalPct = totTasks === 0 ? 0 : Math.round((totDone/totTasks)*100);

                hub.style.display = 'block';
                hub.innerHTML = ui.buildHub('Hub analítico do projeto', [
                    { k: 'Células configuradas', v: p.cells.length },
                    { k: 'Robôs analisados', v: totRobots },
                    { k: 'Tarefas concluídas', v: `<span class="ink-success">${totDone}</span> / ${totTasks}` }
                ], globalPct, 'de progresso físico do projeto');

                grid.dataset.reorder = 'cell';
                grid.innerHTML = p.cells.map(c => ui.buildCard({
                    id: c.id, iconName: 'box', name: c.name,
                    badge: `${(c.robots||[]).length} ${(c.robots||[]).length === 1 ? 'robô' : 'robôs'}`,
                    pct: appState.calcCellProgress(c),
                    foot: 'Status global', cta: 'Acessar',
                    editLabel: 'Renomear célula', delLabel: 'Excluir célula',
                    onOpen: `nav('cell', '${p.id}', '${c.id}')`,
                    onEdit: `uiActions.renameCell(event, '${p.id}', '${c.id}')`,
                    onDelete: `uiActions.deleteCell('${p.id}', '${c.id}', true)`,
                    onDeleteInline: `uiActions.deleteCell('${p.id}', '${c.id}')`
                })).join('');
            },

            renderCell(pid, cid) {
                const c = appState.getCell(pid, cid);
                if(!c) return;
                activeContext.projectId = pid; activeContext.cellId = cid;
                document.getElementById('cell-title').innerText = c.name;
                document.getElementById('back-to-project-btn').onclick = () => nav('project', pid);

                const grid = document.getElementById('cell-robots-cards');
                const hub = document.getElementById('cell-hub');

                if(!c.robots) c.robots = [];
                if(c.robots.length === 0) {
                    hub.style.display = 'none';
                    grid.innerHTML = ui.buildEmpty('bot', 'Nenhum robô adicionado ainda.',
                        `<button class="btn btn-primary" onclick="uiActions.openModalAddRobot()">${icon('plus')} Adicionar Robô</button>`);
                    return;
                }

                let totTasks = 0, totDone = 0;
                (c.robots || []).forEach(r => {
                    totTasks += (r.tasks || []).length;
                    totDone += (r.tasks || []).filter(t => t.status === "Concluído").length;
                });
                let globalPct = totTasks === 0 ? 0 : Math.round((totDone/totTasks)*100);

                hub.style.display = 'block';
                hub.innerHTML = ui.buildHub('Hub analítico da célula', [
                    { k: 'Robôs configurados', v: c.robots.length },
                    { k: 'Tarefas concluídas', v: `<span class="ink-success">${totDone}</span> / ${totTasks}` }
                ], globalPct, 'de progresso físico da célula');

                grid.dataset.reorder = 'robot';
                grid.innerHTML = c.robots.map(r => ui.buildCard({
                    id: r.id, iconName: 'bot', name: r.name,
                    badge: r.application || 'Misto / Geral', badgeClass: 'andamento',
                    pct: appState.calcRobotProgress(r),
                    foot: `${r.tasks ? r.tasks.length : 0} tarefas`, cta: 'Abrir',
                    editLabel: 'Renomear robô', delLabel: 'Excluir robô',
                    onOpen: `nav('robot', '${pid}', '${c.id}', '${r.id}')`,
                    onEdit: `uiActions.renameRobot(event, '${pid}', '${c.id}', '${r.id}')`,
                    onDelete: `uiActions.deleteRobot('${pid}', '${c.id}', '${r.id}', true)`,
                    onDeleteInline: `uiActions.deleteRobot('${pid}', '${c.id}', '${r.id}')`
                })).join('');
            },

            renderRobot(pid, cid, rid) {
                const r = appState.getRobot(pid, cid, rid);
                if(!r) return;
                activeContext.projectId = pid; activeContext.cellId = cid; activeContext.robotId = rid;
                document.getElementById('robot-title').innerText = `Robô ${r.name}`;
                document.getElementById('robot-app-info').innerText = `Aplicação: ${r.application || 'Misto / Geral'}`;
                document.getElementById('rpct_header').innerText = `${appState.calcRobotProgress(r)}%`;
                document.getElementById('back-to-cell-btn').onclick = () => nav('cell', pid, cid);
                document.getElementById('btn-add-task').onclick = uiActions.addCustomTask;
                document.getElementById('btn-sync-tasks').onclick = uiActions.forceSyncDefault;

                const tbody = document.getElementById('robot-tasks-table').querySelector('tbody');
                if(!r.tasks || r.tasks.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6">${ui.buildEmpty('tasks', 'Nenhuma tarefa neste robô.')}</td></tr>`;
                    return;
                }

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

                    const people = taskPeople(t);
                    const needsResp = (t.progress > 0 && people.length === 0);

                    html += `<tr id="tr_${t.id}">
                        <td style="width: 25%">${sanitize(t.desc)}</td>
                        <td style="width: 15%">
                            <span class="status-wrap">
                                <select class="status-select ${bc}" id="sel_${t.id}" aria-label="Status da tarefa" onchange="uiActions.updateTask('${t.id}', 'status', this.value)">
                                    <option value="Pendente" ${t.status==='Pendente'?'selected':''}>Pendente</option>
                                    <option value="Em Andamento" ${t.status==='Em Andamento'?'selected':''}>Em Andamento</option>
                                    <option value="Concluído" ${t.status==='Concluído'?'selected':''}>Concluído</option>
                                    <option value="N/A" ${t.status==='N/A'?'selected':''}>N/A</option>
                                </select>${icon('chevron-down', 'ic-sm status-caret')}
                            </span>
                        </td>
                        <td style="width: 20%"><div class="slider-cont" style="flex-direction:column; align-items:flex-start; gap:8px;">
                            <span class="pct-readout" id="disp_p_${t.id}">${t.progress||0}%</span>
                            <div style="display:flex; width:100%; gap:8px; align-items:center;">
                                <button class="nudge-btn" aria-label="Diminuir 10%" onclick="uiActions.nudgeProgress('${t.id}', -10)">&minus;</button>
                                <input type="range" style="width:100%" value="${t.progress||0}" step="5" aria-label="Progresso da tarefa" oninput="document.getElementById('disp_p_'+'${t.id}').innerText = this.value + '%'" onchange="uiActions.openAdvanceModal('${t.id}', this.value)" title="Arraste e solte para registrar avanço">
                                <button class="nudge-btn" aria-label="Aumentar 10%" onclick="uiActions.nudgeProgress('${t.id}', +10)">+</button>
                            </div>
                        </div></td>
                        <td style="width: 20%">
                            <div class="assignee-cell${needsResp ? ' assignee-missing' : ''}" onclick="uiActions.openAssignModal('${t.id}')" title="Atribuir responsáveis">
                                ${people.length
                                    ? people.map(n => `<span class="assignee-chip">${sanitize(n)}</span>`).join('')
                                    : `<span class="assignee-empty">${needsResp ? icon('alert', 'ic-sm') + ' Atribuir…' : icon('user-plus', 'ic-sm') + ' Atribuir'}</span>`}
                            </div>
                            ${contribChips ? `<div class="contrib-row">${contribChips}</div>` : ''}
                        </td>
                        <td style="width: 20%">
                            <div class="trail-cell${noTrail ? ' trail-missing' : ''}" onclick="uiActions.openTaskHistory('${t.id}')" title="${sanitize(lastComment)}">
                                <span class="trail-last">${noTrail ? icon('alert', 'ic-sm') + ' Registre o avanço…' : (lastComment ? sanitize(lastComment) : '<i>Sem registros</i>')}</span>
                                <button class="btn-icon trail-btn" aria-label="Ver histórico da tarefa" onclick="event.stopPropagation(); uiActions.openTaskHistory('${t.id}')">${icon('message')} ${hist.length}</button>
                            </div>
                        </td>
                        <td class="task-actions" style="white-space:nowrap"><button class="btn-icon" title="Editar tarefa" aria-label="Editar tarefa" onclick="uiActions.renameTask('${t.id}')">${icon('pencil')}</button><button class="btn-icon btn-icon-danger" title="Excluir tarefa" aria-label="Excluir tarefa" onclick="uiActions.deleteTask('${t.id}')">${icon('trash')}</button></td>
                        <td class="swipe-edit-cell"><button class="swipe-edit" onclick="event.stopPropagation(); uiActions.renameTask('${t.id}')">${icon('pencil')}<span>Editar</span></button></td>
                        <td class="swipe-del-cell"><button class="swipe-del" onclick="event.stopPropagation(); uiActions.deleteTask('${t.id}', true)">${icon('trash')}<span>Excluir</span></button></td></tr>`;
                });
                tbody.innerHTML = html;
            },

            renderMyTasks() {
                const el = document.getElementById('mytasks-list');
                const me = window.currentUserName;
                if (!me) { el.innerHTML = ui.buildEmpty('user', 'Faça login para ver suas tarefas.'); return; }
                const rows = [];
                (state.projects||[]).forEach(p => (p.cells||[]).forEach(c => (c.robots||[]).forEach(r => (r.tasks||[]).forEach(t => {
                    if (taskPeople(t).includes(me) && t.status !== 'Concluído' && t.status !== 'N/A')
                        rows.push({ p, c, r, t });
                }))));
                if (!rows.length) { el.innerHTML = ui.buildEmpty('check-circle', 'Nenhuma tarefa pendente atribuída a você.'); return; }
                el.innerHTML = `<div class="panel glass glass-sheen"><table><thead><tr><th>Tarefa</th><th>Robô</th><th>Célula · Projeto</th><th>Status</th><th style="text-align:right">%</th></tr></thead><tbody>` +
                    rows.map(x => `<tr class="row-link" onclick="nav('robot','${x.p.id}','${x.c.id}','${x.r.id}')">
                        <td>${sanitize(x.t.desc)}</td>
                        <td>${sanitize(x.r.name)}</td>
                        <td>${sanitize(x.c.name)} · ${sanitize(x.p.name)}</td>
                        <td><span class="badge ${appState.getStatusStyle(x.t.status)}">${sanitize(x.t.status)}</span></td>
                        <td style="text-align:right" class="pct-readout">${x.t.progress||0}%</td>
                    </tr>`).join('') + `</tbody></table></div>`;
            },

            // ===== NOTIFICAÇÕES: badge do sininho + lista do menu =====
            renderNotifs() {
                const badge = document.getElementById('notif-badge');
                const list = document.getElementById('notif-list');
                if (!badge || !list) return;
                const notifs = state.myNotifs || [];
                const unread = notifs.filter(n => !n.read).length;
                badge.style.display = unread ? 'flex' : 'none';
                badge.textContent = unread > 9 ? '9+' : unread;
                const icoByType = { assign: 'user-plus', progress: 'history', done: 'check-circle' };
                const ago = n => {
                    const ms = (n.ts && n.ts.toMillis) ? n.ts.toMillis() : null;
                    if (!ms) return n.tsLocal || '';
                    const m = Math.round((Date.now() - ms) / 60000);
                    if (m < 1) return 'agora';
                    if (m < 60) return `há ${m} min`;
                    const h = Math.round(m / 60);
                    if (h < 24) return `há ${h} h`;
                    return `há ${Math.round(h / 24)} d`;
                };
                list.innerHTML = !notifs.length
                    ? '<div class="notif-empty">Nenhuma notificação por aqui.</div>'
                    : notifs.slice(0, 20).map(n => `
                        <button type="button" class="notif-item${n.read ? '' : ' unread'}" role="menuitem" onclick="uiActions.openNotif('${n.id}')">
                            <svg class="ic ic-sm"><use href="#i-${icoByType[n.type] || 'bell'}"></use></svg>
                            <span class="notif-body">
                                <span class="notif-msg">${sanitize(n.msg)}</span>
                                <span class="notif-when">${sanitize(ago(n))}</span>
                            </span>
                            ${n.read ? '' : '<span class="notif-dot" aria-hidden="true"></span>'}
                        </button>`).join('');
                // Oferece ativar alertas do sistema só enquanto a permissão está pendente
                const perm = document.getElementById('notif-perm-wrap');
                if (perm) perm.style.display = (typeof Notification !== 'undefined' && Notification.permission === 'default') ? 'block' : 'none';
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
                        conclusions.push({ desc:t.desc, robot:r.name, cell:c.name, by:(done&&done.byName)||taskPeople(t).join(', ')||'—', ts:(done&&done.ts)||null });
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
                            html += `<div class="rpt-robot"><div class="rpt-robot-h"><h4>${icon('bot')} ${sanitize(r.name)} <span class="rpt-app">${sanitize(r.application||'Misto / Geral')}</span></h4>${bar(appState.calcRobotProgress(r))}</div>
                            <table class="rpt-tasks"><thead><tr><th></th><th>Tarefa</th><th>Status</th><th class="rpt-r">%</th><th>Responsável</th></tr></thead><tbody>`;
                            (r.tasks||[]).forEach(t => {
                                const cls = CLS[t.status]||'pend';
                                html += `<tr class="rpt-t-${cls}"><td class="rpt-sym ${cls}">${SYM[t.status]||'○'}</td><td>${sanitize(t.desc)}</td><td class="rpt-st ${cls}">${sanitize(t.status)}</td><td class="rpt-r rpt-mono">${t.progress||0}</td><td>${sanitize(taskPeople(t).join(', ')||'—')}</td></tr>`;
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
                        <span class="resp-tag">${sanitize(r)} ${r !== 'Não Atribuído'
                            ? `<button class="btn-icon" title="Remover ${sanitize(r)}" aria-label="Remover ${sanitize(r)}" onclick="uiActions.deleteResponsibleAt(${i})">${icon('x', 'ic-sm')}</button>`
                            : ''}</span>
                    `).join('');
                }

                if(!state.defaultTasks) return;
                tt.innerHTML = state.defaultTasks.map(t => {
                    const filters = t.appFilters || t.apps || [];
                    const l = (filters.length > 0) ? filters.join(', ') : 'Geral (Todos)';
                    return `<tr><td class="cat-cell">${sanitize(t.cat)}</td><td>${sanitize(t.desc)}</td>
                    <td><button class="btn" style="padding:5px 10px; font-size:0.76rem;" onclick="uiActions.editAppFilter('${t.id}')">${icon('sliders', 'ic-sm')} ${sanitize(l)}</button></td>
                    <td style="text-align:right"><button class="btn-icon btn-icon-danger" title="Excluir tarefa padrão" aria-label="Excluir tarefa padrão" onclick="uiActions.deleteDefaultTask('${t.id}')">${icon('trash')}</button></td></tr>`;
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
                badge.style.display = 'inline-flex';
                // A classe carrega a cor; nada de estilo inline por papel.
                badge.className = 'role-badge ' + (r === 'view' ? 'role-view' : r === 'edit' ? 'role-edit' : 'role-owner');
                badge.innerHTML = r === 'view' ? icon('eye') + '<span>Somente leitura</span>'
                                : r === 'edit' ? icon('pencil') + '<span>Editor</span>'
                                : icon('star') + '<span>Dono</span>';
            }
        }
