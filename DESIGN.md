# Design

Sistema visual do RoboTrack, capturado do código. Tokens são CSS custom properties
em `:root` (`assets/css/styles.css`) com override em `body[data-theme="light"]`.

## Theme

Escuro por padrão (navy quase-preto), com tema claro alternável pelo menu da conta.
O escuro é o modo primário — é o que se lê sob luz de galpão — e **de propósito não
seguimos `prefers-color-scheme`**: o claro só entra quando a pessoa pede. A escolha
persiste em `localStorage` (`rt-theme`) e o `<meta name="theme-color">` acompanha,
para a barra de status do PWA não destoar.

## Color

Paleta em HEX/rgba (não OKLCH). Os papéis originais seguem intactos:

| Papel | Escuro | Claro |
|---|---|---|
| `--bg-main` (fundo) | `#0a0f1d` | `#f1f5f9` |
| `--bg-nav` (sidebar/topbar) | `rgba(7,11,22,0.82)` | `rgba(255,255,255,0.88)` |
| `--bg-panel` (superfície) | `rgba(18,26,47,0.7)` | `rgba(255,255,255,0.9)` |
| `--bg-menu` (menus/modais) | `rgba(16,23,42,0.97)` | `rgba(255,255,255,0.98)` |
| `--bg-sunken` (campos, cabeçalho de tabela) | `rgba(0,0,0,0.28)` | `rgba(15,23,42,0.04)` |
| `--bg-raised` | `rgba(255,255,255,0.04)` | `rgba(15,23,42,0.03)` |
| `--border` / `--border-soft` | `rgba(255,255,255,.1)` / `.06` | `rgba(0,0,0,.15)` / `rgba(15,23,42,.08)` |
| `--text-main` | `#f8fafc` | `#0f172a` |
| `--text-muted` | `#94a3b8` | `#475569` |
| `--accent` | `#3b82f6` | `#2563eb` |
| `--track` | `rgba(255,255,255,0.09)` | `rgba(15,23,42,0.12)` |

Status (semântico, nunca decoração): `--success #10b981`, `--warning #f59e0b`,
`--accent` (em andamento), `--danger #ef4444`, `#a1a1aa` (N/A).
Estratégia: **restrained** — neutros tintados de azul + um accent azul.

### Tinta e preenchimento: a mesma cor em dois papéis

A cor de status tem **três variantes**, e escolher a errada quebra contraste:

- **`--success` / `--warning` / `--danger` / `--accent`** — a cor cheia. Use em
  `background`, `border-color`, `stroke`, anéis de progresso.
- **`--*-ink`** — a cor **quando ela vira texto** sobre a própria pílula tingida.
  A pílula tinge o fundo (verde 15% sobre branco desce para `rgb(213,213,214)`),
  então a tinta precisa de mais um degrau do que parece. No claro elas escurecem
  (`#065f46`, `#92400e`, `#991b1b`, `#1e40af`); no escuro azul e vermelho
  *clareiam* (`#60a5fa`, `#f87171`) porque ali a pílula escurece o fundo.
- **`--accent-solid` / `--danger-solid`** — a cor **quando ela vira fundo de texto
  branco**. `#3b82f6` com branco em cima dá 3.68:1 e `#ef4444` dá 3.76:1: os dois
  reprovam em AA. Usadas em `.btn-primary`, `.filter-btn.active` e nos botões de
  swipe.

Medido em `dashboard`, `mytasks`, `settings` e `robot`, nos dois temas: nenhum
texto abaixo do mínimo AA.

## Luz ambiente ("liquid glass")

Uma **única fonte de luz** em coordenadas de viewport, publicada em `--lx` / `--ly`
(registradas com `@property` como `<length>`). Três camadas a consomem:

1. **`.ambient`** — halo fixo atrás de todo o conteúdo (dois radiais de accent).
2. **`.glass-sheen::before`** — brilho que atravessa a superfície. Só nas peças
   grandes: sidebar, topbar, hub, painéis, menus.
3. **`.glass::after`** — borda de 1px que acende do lado voltado para o cursor
   (gradiente + `mask-composite: exclude`). Vai em todas as superfícies, cards
   inclusive.

O truque que amarra tudo: `background-attachment: fixed` nos gradientes das
superfícies. O gradiente resolve em espaço de viewport, então **todas** leem a
mesma posição e a luz atravessa o app como um corpo só — em vez de cada card ter
seu próprio brilho local.

**Custo e limites.** Escrever `--lx/--ly` invalida toda superfície de vidro de
uma vez, então o JS grava no máximo a ~32ms (30fps); a inércia da luz esconde a
diferença. O efeito é gated por `@media (hover: hover) and (pointer: fine)`:
no toque não existe cursor e o custo não se paga — sobra só o halo de fundo.
Com `prefers-reduced-motion` a luz **existe mas fica parada** na posição de
repouso; o visual segue completo, só não se move. `body[data-glow="off"]` desliga
tudo. Medido com 24 cards em tela a 1x de CPU: p50 igual à linha de base.

`backdrop-filter` fica só onde de fato há conteúdo por baixo para borrar
(sidebar, topbar, menus, overlay de modal). Em card e painel ele custava caro e
não borrava nada — o fundo ali é liso.

## Typography

Família única em pesos múltiplos: **Inter** (300–700), via Google Fonts. Sem par de
fontes — hierarquia por peso e tamanho, que é o padrão certo para UI de produto.
Escala fixa em rem, não fluida: `.title` 1.65rem/700 (−0.02em), `.modal-title`
1.22rem/600, `panel-header` 0.92rem/600, corpo 14px, rótulos e badges 0.68–0.78rem.
Números (progresso, %, contadores) usam `font-variant-numeric: tabular-nums` para
não dançar; `.mono` só onde há alinhamento de coluna.

## Spacing, raio e elevação

Raio em escala: `--r-xs 6` · `--r-sm 8` · `--r-md 12` · `--r-lg 16` · `--r-xl 20` ·
`--r-pill`. Sombra em três degraus (`--sh-1/2/3`). Espaçamento em múltiplos de 4/8.
Grade de cards: `repeat(auto-fill, minmax(260px, 1fr))` — 1 coluna até 768px,
2 no tablet, 3–5 no desktop. Empilhamento **semântico**, nunca 999:
`--z-ambient 0 → content 1 → sticky 20 → sidebar 30 → dropdown 60 → modal 90 → login 200`.

## Ícones

Sprite SVG inline no `index.html` (`<symbol id="i-*">`), consumido por
`<svg class="ic"><use href="#i-nome">` ou pelo helper `icon(name, cls)` em
`src/view/icons.js`. Zero requisição, funciona offline no PWA. Traço e preenchimento
vêm **por herança** (`.ic { stroke: currentColor }`), então um ícone dentro de
qualquer componente já sai na cor certa — os `<symbol>` não fixam cor. Tamanhos:
`.ic` 18px, `.ic-sm` 15px, `.ic-lg` 22px. **Não há emoji na interface**; os únicos
glifos restantes (`✓ ◐ ○ —`) são símbolos tipográficos do relatório A4 impresso.

## Navegação e IA

- **Sidebar** — só destinos do app: Visão Geral, Minhas Tarefas, Relatório.
  Estado ativo por preenchimento tintado + ícone em accent (nunca faixa lateral).
- **Rodapé da sidebar** — indicador de gravação + card de usuário (nome sobre
  e-mail) que abre o menu **Edição e visualização**: tarefas/equipe/filtros,
  logs & histórico, backup.
- **Topo direito** — gatilho da conta que abre: adicionar usuário, alternar tema,
  sair. O contexto do workspace (seletor + papel) fica à esquerda na mesma barra.
- **Menus** são filhos diretos do `<body>` com `position: fixed`, posicionados pelo
  JS a partir do retângulo do gatilho. Isso é deliberado: `absolute` dentro do
  `.main` (que tem `overflow-y: auto`) seria recortado. Medem-se com `.measuring`
  antes de abrir para decidir se sobem ou descem, e fecham em clique fora, Esc,
  scroll do conteúdo, resize ou escolha de item.

## Components

- **Card** (`.card`): superfície + `.entity-ic` (selo de ícone em quadrado tintado)
  + título + `.card-meta` (badge em linha própria) + anel + rodapé. O badge tem
  linha própria de propósito: junto do título ele quebrava em um card e não em
  outro, desalinhando os anéis da grade. Cards da mesma linha têm altura igual
  (`height: 100%` + rodapé em `margin-top: auto`).
  O selo usa **um só tom** (accent): verde/âmbar/azul continuam significando
  *status*, não *tipo de entidade*.
- **Hub analítico** (`.hub`): rótulo pequeno sobre valor grande, barra de progresso
  embaixo. A barra cresce por `transform: scaleX()`, não por `width` — mesma leitura,
  sem layout no meio da animação.
- **Progress circle**: anel SVG `<path>` (por isso o CSS mira `.progress-circle path`).
  A 0% o traço é omitido, senão `stroke-linecap: round` deixa um ponto que sugere
  avanço inexistente.
- **Panel + table**: tabela de tarefas; no mobile reflui para cartões empilhados.
- **Filtros** (`.filter-bar`): controle segmentado em pílula.
- **Status select** (`.status-wrap` > `.status-select` + `.status-caret`): pílula
  tintada que **é um `<select>`**. Como `appearance: none` apaga a seta nativa, a
  pílula ficava idêntica ao `.badge` estático da mesma tabela e ninguém descobria
  que era clicável — por isso o chevron do sprite é obrigatório aqui, com
  `pointer-events: none` e `padding-right` reservando o espaço. A seta herda a
  tinta do status via `.status-select.<variante> ~ .status-caret`. Regra geral:
  **badge é rótulo, select é controle — os dois nunca podem se parecer.**
- **Badge**, **chips** (`.assignee-chip`, `.contrib-chip`,
  `.resp-tag`): pílulas tintadas *estáticas*, texto sempre em `--*-ink`.
- **Modal**: `.modal-overlay` com blur + `.modal-content`; `.modal-bar` para
  título + fechar, `.modal-foot` para ações.
- **Save indicator**: `_ind('saving'|'saved'|'error')` — ícone do sprite + classe
  de cor, honestidade do estado de persistência.

## Motion

Entrada de view (`viewEnter`, fade + 8px), `menuIn` nos dropdowns, `modalPop`,
`successPulse` ao concluir tarefa, hover de card elevando 3px. Curvas de saída
exponencial (`--ease`, `--ease-out`), 150–320ms, sem bounce. `prefers-reduced-motion`
zera animações e transições globalmente.

## Accessibility

Alvo WCAG AA (ver PRODUCT.md) — **atingido e medido** nos dois temas. Foco visível
em tudo que recebe teclado via `:focus-visible` (o `button { outline: none }` global
saiu). Menus navegáveis por setas, fecham com Esc devolvendo o foco ao gatilho.
Alvos de toque ≥ 32px nos botões de ícone. Ícones decorativos marcados
`aria-hidden`; botões só-ícone têm `aria-label`. Barras de progresso com
`role="progressbar"` e anéis com `role="img"` + rótulo.
