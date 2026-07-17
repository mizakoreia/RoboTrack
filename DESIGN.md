# Design

Sistema visual atual do RoboTrack, capturado do código (`index.html`). Documenta o que existe hoje para que futuras variações fiquem on-brand. Tokens são CSS custom properties em `:root` com override em `body[data-theme="light"]`.

## Theme

Escuro por padrão (navy quase-preto), com tema claro alternável (botão "🌓 Escuro / Claro"). O escuro é o modo primário: legível sob luz de galpão, foco nos dados, estética de painel de controle industrial. Superfícies usam vidro fosco leve (`backdrop-filter: blur`) sobre o fundo navy.

## Color

Paleta em HEX/rgba (não OKLCH ainda). Papéis:

| Papel | Escuro | Claro |
|---|---|---|
| `--bg-main` (fundo) | `#0a0f1d` | `#f1f5f9` |
| `--bg-panel` (superfície) | `rgba(18,26,47,0.7)` | `rgba(255,255,255,0.9)` |
| `--bg-hover` | `rgba(30,41,59,0.8)` | `rgba(226,232,240,0.8)` |
| `--border` | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.15)` |
| `--text-main` (tinta) | `#f8fafc` | `#0f172a` |
| `--text-muted` | `#94a3b8` | `#475569` |
| `--accent` (azul) | `#3b82f6` | `#2563eb` |
| `--accent-glow` | `rgba(59,130,246,0.4)` | `rgba(37,99,235,0.2)` |

Cores de status (semânticas, fixas entre temas): `--success #10b981` (concluído/verde), `--warning #f59e0b` (pendente/âmbar), `--accent #3b82f6` (em andamento/azul), `#a1a1aa` (N/A/cinza), `--danger #ef4444` (excluir/erro). Estratégia: **restrained** — neutros tintados de azul + um accent azul; status carrega a cor com significado, nunca decoração.

**Nota de acessibilidade (dívida conhecida):** `--text-muted #94a3b8` sobre `--bg-main #0a0f1d` fica no limite para corpo pequeno (< 4.5:1). Para texto de corpo, puxar para a tinta; muted só em rótulos grandes/secundários.

## Typography

Família única em pesos múltiplos: **Inter** (300–700), via Google Fonts. Sem par de fontes — hierarquia por peso e tamanho. Títulos `.title` ~1.8rem/700; card-header ~1.1rem/600; corpo 14px base; rótulos e badges 0.65–0.8rem em maiúsculas para metadados (status, categoria). Números de progresso em `font-family: monospace` para alinhamento.

## Spacing & Radius

Cantos: 6–8px em controles, 12–16px em painéis/cards, pílulas (20px+) em filtros e itens de menu mobile. Espaçamento em múltiplos de 4/8. Grid de cards responsivo: `repeat(auto-fill, minmax(300px, 1fr))`, colapsa para 1 coluna ≤ 800px.

## Components

- **Sidebar / topbar**: navegação lateral no desktop; no mobile vira barra superior com logo + botão ☰ (hambúrguer) que abre menu vertical.
- **Card** (`.card`): superfície de vidro, usada para projeto/célula na visão geral; hover eleva (`translateY(-4px)`) com glow do accent.
- **Progress circle**: anel SVG (`stroke` accent sobre trilha translúcida) com % no centro — leitura de progresso à primeira vista.
- **Panel + table**: tabela de tarefas do robô (descrição, status, progresso, responsável, obs). No mobile reflui para cartões empilhados (sem rolagem lateral).
- **Status select** (`.status-select`): dropdown colorido por estado (pendente/andamento/concluído/na).
- **Badge / resp-tag / filter-btn**: pílulas pequenas para metadados e filtros.
- **Modal** (`.modal-overlay` + `.modal-content`): novo robô, logs, convite; `backdrop-filter` no overlay, `modalPop` na entrada.
- **Save indicator**: "⏳ Salvando / ✅ Salvo / ❌ Erro" — honestidade do estado de persistência.

## Motion

Entrada de views com `viewEnter` (fade + scale sutil, curva ease-out). `successPulse` ao concluir tarefa (100%). Hover de card eleva. Sem bounce/elastic. **Pendência:** falta o par `@media (prefers-reduced-motion: reduce)` para as animações — adicionar crossfade/instantâneo.

## Accessibility

Meta viewport presente; tema claro/escuro; alvos de toque ampliados no mobile. Dívidas a fechar: contraste do muted em corpo pequeno, `prefers-reduced-motion`, e foco visível consistente por teclado. Alvo declarado: WCAG AA (ver PRODUCT.md).
