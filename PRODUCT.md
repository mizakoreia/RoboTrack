# Product

## Register

product

## Platform

web

## Users

Engenheiros e programadores de comissionamento de robôs industriais (contexto automotivo, ex.: célula de solda VW). Usam a ferramenta no chão de fábrica — celular na mão, às vezes com luva, sob luz forte e irregular de galpão — e também no desktop para planejar e revisar. O trabalho é acompanhar, tarefa por tarefa, o comissionamento de cada robô: verificar segurança, carregar trajetórias, rodar tryout, registrar quem fez o quê e quanto falta. Times pequenos colaboram no mesmo comissionamento; cada dono convida colegas para o seu workspace com permissão de ver ou editar.

## Product Purpose

RoboTrack rastreia o progresso de comissionamento de robôs e células produtivas. A hierarquia Projeto → Célula → Robô → Tarefa consolida o avanço de baixo para cima: o progresso de cada tarefa sobe para o robô, para a célula e para o projeto, dando uma leitura de "quanto falta" em qualquer altura. É um PWA que sincroniza na nuvem (Firebase) entre aparelhos e funciona offline no chão de fábrica. Sucesso é saber, a qualquer momento e de qualquer aparelho, o estado real de cada robô sem planilha paralela.

## Positioning

Checklist de comissionamento feito para o chão de fábrica: consolida progresso tarefa→robô→célula→projeto em tempo real, com trilha de quem concluiu o quê, funcionando no celular mesmo offline.

## Brand Personality

Técnico e confiável. Voz de engenharia: direto, preciso, sem enfeite. A interface deve transmitir controle e seriedade industrial — quem olha confia no dado. Nada de fofo, nada de marketing; a competência aparece na clareza, não na decoração.

## Anti-references

Não deve parecer SaaS genérico de template (grades de cards idênticos, texto em gradiente, eyebrow minúsculo em maiúsculas sobre cada seção). Não deve virar planilha crua sem hierarquia — tabelão cinza ilegível. Nem estética consumer lúdica (pastel, ilustração fofa) nem terminal gamer neon.

## Design Principles

Legibilidade primeiro: o dado tem que ser lido sob luz ruim de galpão, no celular, rápido — contraste e tamanho vencem elegância. Progresso à primeira vista: o quanto-falta de cada nível deve saltar sem exigir leitura de tabela. Usável com o polegar: alvos grandes, ações principais alcançáveis sem menu escondido. Honestidade do estado: o app mostra o que está salvo, sem enfeite que sugira mais completude do que existe. Sem decoração que custe clareza: todo elemento paga o próprio espaço em informação.

## Accessibility & Inclusion

Alvo WCAG AA: contraste de corpo ≥ 4.5:1, foco visível, navegável por teclado. Alto contraste priorizado pelo ambiente de chão de fábrica (luz forte, tela pequena). Alvos de toque grandes para uso com luva. Respeitar `prefers-reduced-motion` — animação é reforço, nunca requisito para ver conteúdo.
