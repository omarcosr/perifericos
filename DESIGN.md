---
name: Periféricos
description: Painel nativo do Windows para consultar e configurar periféricos.
colors:
  dark-primary: "#b3b5ff"
  dark-primary-foreground: "#1a1b33"
  dark-primary-hover: "#c7c8ff"
  dark-primary-active: "#a0a4fa"
  dark-secondary: "#383b61"
  dark-secondary-foreground: "#e3e4ff"
  dark-secondary-hover: "#464a73"
  dark-secondary-active: "#505481"
  dark-ring: "#c0c2ff"
  dark-selection: "#4b4d83"
  dark-background: "#18191d"
  dark-card: "#222328"
  dark-foreground: "#f3f2f6"
  dark-muted: "#373841"
  dark-muted-foreground: "#b8b8c5"
  dark-input: "#2c2d34"
  dark-border: "#3d3e48"
  dark-disabled: "#30313a"
  dark-disabled-foreground: "#9e9daf"
  dark-placeholder: "#aaaabb"
  dark-scrollbar: "#646473"
  dark-success: "#8bd5ad"
  dark-destructive-text: "#ffabaf"
  dark-battery-low: "#efba80"
  light-primary: "#464bb0"
  light-primary-foreground: "#ffffff"
  light-primary-hover: "#393e99"
  light-primary-active: "#2b317c"
  light-secondary: "#e1e1fc"
  light-secondary-foreground: "#383d92"
  light-secondary-hover: "#d5d5f4"
  light-secondary-active: "#c9c9ed"
  light-ring: "#4b50b6"
  light-selection: "#cbcdf9"
  light-background: "#eeedf1"
  light-card: "#fbfafc"
  light-foreground: "#23232d"
  light-muted: "#dfdee7"
  light-muted-foreground: "#555566"
  light-input: "#e7e6ed"
  light-border: "#d3d2dc"
  light-disabled: "#e8e7ee"
  light-disabled-foreground: "#666577"
  light-placeholder: "#616073"
  light-scrollbar: "#8b899b"
  light-success: "#276747"
  light-destructive-text: "#992f42"
  light-battery-low: "#8a4a17"
typography:
  display:
    fontFamily: system-ui
    fontSize: "32px"
    fontWeight: 680
    lineHeight: 1.2
    letterSpacing: "-0.85px"
  headline:
    fontFamily: system-ui
    fontSize: "28px"
    fontWeight: 670
    letterSpacing: "-0.6px"
  title:
    fontFamily: system-ui
    fontSize: "21px"
    fontWeight: 670
    lineHeight: 1.2
    letterSpacing: "-0.35px"
  device-name:
    fontFamily: system-ui
    fontSize: "23px"
    fontWeight: 675
    lineHeight: 1.18
    letterSpacing: "-0.45px"
  section:
    fontFamily: system-ui
    fontSize: "16px"
    fontWeight: 620
  body:
    fontFamily: system-ui
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: system-ui
    fontSize: "13px"
    fontWeight: 500
  reading:
    fontFamily: system-ui
    fontSize: "14px"
    fontWeight: 620
    fontFeature: "'tnum' 1"
rounded:
  tab: "0px"
  battery-track: "2px"
  connection-dot: "3px"
  segment: "4px"
  chrome-action: "6px"
  control: "8px"
  card: "12px"
  dialog: "16px"
spacing:
  half-step: "4px"
  step: "8px"
  switch-gap: "12px"
  card-inset: "16px"
  window-gutter: "24px"
components:
  device-card:
    backgroundColor: "{colors.dark-card}"
    textColor: "{colors.dark-foreground}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-inset}"
  device-card-light:
    backgroundColor: "{colors.light-card}"
    textColor: "{colors.light-foreground}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-inset}"
  photo-mat:
    backgroundColor: "{colors.dark-input}"
    rounded: "{rounded.control}"
  photo-mat-light:
    backgroundColor: "{colors.light-input}"
    rounded: "{rounded.control}"
  navigation-tab:
    rounded: "{rounded.tab}"
    height: "48px"
    padding: "0px"
  battery-track:
    backgroundColor: "{colors.dark-muted}"
    rounded: "{rounded.battery-track}"
    height: "4px"
  battery-track-light:
    backgroundColor: "{colors.light-muted}"
    rounded: "{rounded.battery-track}"
    height: "4px"
  button-primary:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    width: "112px"
    height: "40px"
  button-primary-light:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    width: "112px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.dark-input}"
    textColor: "{colors.dark-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "38px"
    width: "80px"
    padding: "0px"
  dpi-input:
    backgroundColor: "{colors.dark-input}"
    textColor: "{colors.dark-foreground}"
    rounded: "{rounded.control}"
    width: "80px"
    height: "40px"
  polling-segment:
    backgroundColor: "{colors.dark-secondary}"
    textColor: "{colors.dark-secondary-foreground}"
    rounded: "{rounded.segment}"
    height: "32px"
    padding: "0px"
  dialog:
    rounded: "{rounded.dialog}"
    padding: "{spacing.window-gutter}"
    width: "400px"
---

# Periféricos

## Overview

**Direção visual — painel de dispositivos**

A visão geral funciona como uma galeria dos dispositivos. A foto identifica o produto, e o nome, a conexão e a bateria ficam disponíveis no mesmo cartão. A configuração aproveita a identidade e a telemetria do modelo para situar os controles de cada dispositivo.

A interface usa grafite e índigo no tema escuro e superfícies claras de tom frio no tema claro. A navegação faz parte da barra de título do Windows.

**Características**

- Fotos dos modelos com proporções preservadas.
- Leitura de conexão e carga por texto, símbolo e cor.
- Configuração agrupada em seções de uma coluna.

## Colors

O índigo primário marca a aba atual, ações disponíveis, foco e leituras de bateria em estado padrão. A variante secundária tonal aparece em seleções e ações contextuais. Fundo, cartões, áreas de foto, campos, trilhos e divisórias formam a escala de superfícies de cada tema.

O verde acompanha a conexão estabelecida e a bateria em carregamento. O âmbar sinaliza bateria em 20% ou menos com o carregamento inativo. Erros usam `destructive-text` no texto e, na entrada de DPI, no contorno. Os temas seguem a aparência do Windows.

## Typography

O painel herda `system-ui` do Tarve. A hierarquia parte do título da galeria (32 px), passa pelo título da aba (28 px) e pelo modelo (18–23 px, conforme o espaço), e chega aos títulos de seção (16 px). Estados e texto de apoio usam 12–14 px. Porcentagens, DPI e polling usam algarismos tabulares.

## Layout

A janela abre em 944 × 584 px e pode encolher até 464 × 504 px. O conteúdo rola na vertical e fica centralizado até 1.200 px. O ritmo usa passos de 8 px e meios passos de 4 px. Cartões e seções usam recuo de 16 px. As margens do conteúdo passam de 24 para 16 px com largura de viewport abaixo de 600 px.

Na galeria, a largura útil após as margens determina a grade. Abaixo de 560 px, os cartões ficam em uma coluna com foto lateral. A partir de 560 px, há duas colunas. A partir de 840 px, há até três. Nos detalhes, com dispositivo conectado e viewport a partir de 760 px, a identidade e a telemetria ficam em um cartão de 272 px à esquerda da coluna de controles. Em larguras menores, o cartão e as seções de configuração se sucedem verticalmente. O seletor de polling ocupa sua própria linha acima do botão de aplicação quando o painel de controles está compacto.

## Elevation & Depth

O painel usa superfícies planas com separação tonal e contornos de 1 px. O cartão de identidade, a área da foto e as seções dos controles se distinguem pela cor de fundo e pelas divisórias. Os estados interativos são expressos por cor e contorno.

## Shapes

Os cartões têm cantos de 12 px. Campos e áreas de foto usam 8 px. Opções segmentadas usam 4 px e ações da barra de título usam 6 px. O trilho de bateria mede 4 px de altura com cantos de 2 px. Diálogos usam 16 px de raio.

## Components

- **Abas** — Visão geral, Headset e Mouse ocupam a barra de título de 48 px. Um traço inferior de 2 px e texto mais forte marcam a aba ativa. Em viewport abaixo de 600 px, as abas mantêm os rótulos e o traço em um formato textual.
- **Cartão de dispositivo** — Foto centralizada com encaixe proporcional, nome, seta e estado de conexão. Para dispositivos conectados, o cartão também acomoda a leitura da bateria. O cartão inteiro abre a configuração do modelo. O contorno muda para índigo ao passar o ponteiro.
- **Telemetria** — A conexão usa um ponto de 6 px acompanhado do estado. A bateria combina ícone, rótulo e percentual. Quando a leitura está indisponível, mostra “Sem leitura”. O trilho aparece quando há percentual.
- **Configuração** — O headset agrupa microfone, LEDs e avisos sonoros. O mouse agrupa sensibilidade e taxa de polling. A sensibilidade combina controle deslizante e entrada numérica. Polling usa opções segmentadas. O botão de aplicar recebe o preenchimento primário quando há uma alteração válida disponível para envio.

## Do's and Don'ts

- Use foto do modelo reconhecido e o ícone genérico quando a identificação do mouse estiver ausente.
- Mantenha o foco visível e os estados de conexão, carga e erro legíveis em texto.
- Use superfícies tonais, contornos e divisórias para organizar a interface.
