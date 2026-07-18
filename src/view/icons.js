/* =============================================================================
 * VIEW · icons.js
 * Um único helper para desenhar ícones. O sprite <symbol> vive inline no
 * index.html (zero requisição, funciona offline no PWA); aqui só montamos a
 * referência. Cor e espessura de traço vêm por herança via .ic — quem chama
 * não passa cor, passa contexto.
 *
 * Uso:  icon('trash')                  -> ícone padrão (18px)
 *       icon('plus', 'ic-sm')          -> variante menor
 *       icon('x', 'ic-lg minha-classe')
 * ========================================================================== */

const ICONS = [
    'bot', 'overview', 'tasks', 'report', 'printer', 'sliders', 'users', 'user',
    'user-plus', 'download', 'history', 'sun', 'moon', 'logout', 'chevron-down',
    'chevron-up', 'arrow-left', 'arrow-right', 'factory', 'box', 'pencil', 'trash',
    'grip', 'message', 'alert', 'search', 'eye', 'star', 'check', 'check-circle',
    'x', 'x-circle', 'clock', 'refresh', 'plus', 'menu', 'copy', 'inbox'
];

function icon(name, cls) {
    // Nome inválido vira aviso em desenvolvimento em vez de um buraco silencioso
    // no layout: <use> com href inexistente não renderiza nada.
    if (!ICONS.includes(name)) console.warn('[RoboTrack] ícone inexistente:', name);
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false">'
         + '<use href="#i-' + name + '"></use></svg>';
}
