/* =============================================================================
 * MODEL · data.js
 * Estado central da aplicação, constantes de domínio e utilitários puros.
 * Não conhece o DOM. É a única fonte de verdade dos dados em memória.
 * ========================================================================== */

const getUUID = () => 'uid_' + Math.random().toString(36).substr(2, 9);
const sanitize = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let activeContext = { projectId: null, cellId: null, robotId: null };
const ALLOWED_APPS = ["Misto / Geral", "Solda Ponto", "Solda MIG", "Handling", "Sealing", "Outros"];

const defaultTemplates = [
    { id: getUUID(), cat: "A. Hardware", desc: "Power On", appFilters: [] },
    { id: getUUID(), cat: "A. Hardware", desc: "Mastering Check", appFilters: [] },
    { id: getUUID(), cat: "A. Hardware", desc: "Montagem de Ferramenta", appFilters: [] },
    { id: getUUID(), cat: "A. Hardware", desc: "Check de Ferramenta/Umbilical", appFilters: [] },
    { id: getUUID(), cat: "B. Rede", desc: "Config. Endereço de IP", appFilters: [] },
    { id: getUUID(), cat: "B. Rede", desc: "Rede Principal", appFilters: [] },
    { id: getUUID(), cat: "B. Rede", desc: "Sub Rede", appFilters: [] },
    { id: getUUID(), cat: "C. Segurança", desc: "Definir Cubos e esferas de segurança", appFilters: [] },
    { id: getUUID(), cat: "C. Segurança", desc: "Self Check de segurança do Robo", appFilters: [] },
    { id: getUUID(), cat: "D. Processo", desc: "TCP Check", appFilters: [] },
    { id: getUUID(), cat: "D. Processo", desc: "Calibração de Frame", appFilters: [] },
    { id: getUUID(), cat: "D. Processo", desc: "Payload", appFilters: [] },
    { id: getUUID(), cat: "D. Processo", desc: "Calibração de Cola", appFilters: ["Sealing"] },
    { id: getUUID(), cat: "D. Processo", desc: "Check sinais de Gripper", appFilters: ["Handling", "Solda Ponto"] },
    { id: getUUID(), cat: "E. Trajetórias", desc: "Carregar OLP", appFilters: [] },
    { id: getUUID(), cat: "E. Trajetórias", desc: "Teach Traj. Sem Peça", appFilters: [] },
    { id: getUUID(), cat: "E. Trajetórias", desc: "Teach Traj. Com Peça", appFilters: [] },
    { id: getUUID(), cat: "E. Trajetórias", desc: "Carregar Parâmetros", appFilters: [] },
    { id: getUUID(), cat: "E. Trajetórias", desc: "Traj, de Descarte", appFilters: [] },
    { id: getUUID(), cat: "E. Trajetórias", desc: "Manutenção", appFilters: [] },
    { id: getUUID(), cat: "F. Interlocks", desc: "PLC-ROB interlocks/Sinais", appFilters: [] },
    { id: getUUID(), cat: "G. Tryout", desc: "Dryrun Baixa velocidade ate 100%", appFilters: [] },
    { id: getUUID(), cat: "G. Tryout", desc: "Dryrun Diferentes velocidades", appFilters: [] },
    { id: getUUID(), cat: "G. Tryout", desc: "Automatico baixa velocidade", appFilters: [] },
    { id: getUUID(), cat: "G. Tryout", desc: "Speed up", appFilters: [] },
    { id: getUUID(), cat: "H. Otimização", desc: "Medição de Tempo de Ciclo Com peça", appFilters: [] },
    { id: getUUID(), cat: "H. Otimização", desc: "Otimização de Trajetoria", appFilters: [] },
    { id: getUUID(), cat: "I. Aceitação", desc: "Check de aceitação interna", appFilters: [] },
    { id: getUUID(), cat: "I. Aceitação", desc: "Check de aceitação do cliente", appFilters: [] },
    { id: getUUID(), cat: "I. Aceitação", desc: "Treinamento ao cliente", appFilters: [] },
    { id: getUUID(), cat: "I. Aceitação", desc: "Acompanhamento", appFilters: [] }
].map(t => ({ ...t, weight: 1 }));

let state = {
    version: 8,
    projects: [],
    defaultTasks: [...defaultTemplates],
    responsibles: ["Não Atribuído"],
    logs: []
};
let currentTaskFilter = 'T'; // T: Todos, P: Pendentes, C: Concluídos
