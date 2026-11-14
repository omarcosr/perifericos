# Periféricos Tarve

Abra `dist/Perifericos.exe` no Windows x64. Esta versão usa Tarve 0.12.0 com txiki.js e QuickJS-ng. O código do app está em TypeScript e TSX. As chamadas a HID e Core Audio passam pela FFI para as bibliotecas do Windows.

- **Headset** controla os LEDs, sincroniza o mudo da haste com o Windows, lê a bateria e o estado de carga e reproduz os avisos escolhidos para ativar e silenciar o microfone do Corsair HS80 MAX.
- **Mouse** lê automaticamente conexão, bateria, carga, DPI e polling do Razer Viper V3 Pro e do MCHOSE K7 Ultra original. Quando os dois modelos são detectados, escolha qual configurar em **Dispositivo**. Use o slider ou digite o valor e pressione **Aplicar DPI**. Os ajustes são relidos do mouse depois do envio.
- **Bandeja** mostra a porcentagem do HS80 MAX em azul e a do mouse selecionado em verde. Carga baixa aparece em âmbar, e um traço indica bateria sem leitura. Passe o cursor sobre o ícone para ver o nome e se o dispositivo está carregando. Se o Windows guardar os indicadores em `^`, arraste-os de lá para perto do relógio.
- **Menu do indicador azul** reabre o painel, oferece a instalação quando há uma atualização e encerra o controle. `--run` inicia na bandeja, `--mouse` abre a aba Mouse, `--updates` abre Atualizações, `--hide` oculta o painel e `--stop` encerra a instância.

Para usar o controle do HS80 nesta versão, encerre o controlador em C pelo ícone perto do relógio. Quando o iCUE está aberto, o Tarve pausa o controle do headset. Para transferir a inicialização com o Windows, desative a opção na versão em C e ative-a pelo executável Tarve. A tarefa do Tarve inicia o app 15 segundos após entrar na conta. As preferências do Tarve ficam em `%LOCALAPPDATA%\PerifericosTarve\preferencias.ini`.

Na primeira execução, `PERIFERICOS_IMPORT_INI` pode apontar para o `hs80.ini` da versão em C para trazer LEDs e sons.

O driver do K7 Ultra original reconhece o receptor 2,4 GHz `3837:1001` e o cabo USB `3837:4150`. A leitura foi testada em ambas as conexões com o firmware 5.28.5.0. Na versão 0.4.1, o DPI gravado pelo painel permaneceu no mouse após desligá-lo e religá-lo no modo 2,4 GHz. [Capturas do K7 Ultra](https://github.com/aipno/mchose-linux/blob/main/docs/PROTOCOL.md)

## Atualizações

A partir da v0.5.2, o app consulta a release pública mais recente do GitHub ao iniciar e a cada seis horas. O ícone de download na barra de título e a opção **Atualização disponível** na bandeja aparecem quando há uma versão mais nova. Abra o popup, clique em **Instalar e reiniciar** e acompanhe o download. [Releases do Periféricos Tarve](https://github.com/omarcosr/perifericos-tarve/releases)

O Tarve verifica a assinatura do manifesto, o tamanho e o SHA-256 do arquivo baixado. Após reiniciar, ele carrega o pacote incremental `.tarve` quando o runtime instalado é compatível. Uma versão que exija outro runtime ou outra biblioteca nativa usa o executável completo da release.

## Medição neste PC

Amostras de seis segundos por estado, com o HS80 MAX em uso pelo controlador correspondente. A medição do Tarve foi feita na versão 0.1.0. A CPU é normalizada pelo total de processadores lógicos. A RAM residente e a memória privada são indicadores diferentes.

| Estado | RAM residente | Memória privada | CPU total |
| --- | ---: | ---: | ---: |
| C/CUI na bandeja | 14,87 MiB | 2,10 MiB | 0,03% |
| Tarve aberto | 52,81 MiB | 92,48 MiB | 0,04% |
| Tarve na bandeja | 42,22 MiB | 66,62 MiB | 0,04% |

## Desenvolvimento

Execute estes comandos na pasta do projeto com Bun e txiki.js instalados. O modo Node usa Node.js 26.10 ou posterior com FFI experimental.

```powershell
bun install
bun run check
bun run test
bun run dev
bun run dev:node
bun run build
```

Para reproduzir a revisão visual, rode `bun tests/panel.visual.tsx headset dark normal` ou `bun tests/panel.visual.tsx mouse light compact`. O teste verifica os alinhamentos e gera uma imagem da janela e as coordenadas do layout. Ele usa dados simulados.

## Publicação de versões

O workflow **Publicar versão** roda quando `package.json` é alterado em um push na `main`. Altere o campo `version` para a próxima versão estável, por exemplo `0.5.3`. Se ela for nova, o workflow verifica o TypeScript, executa os testes e anexa o executável, o pacote incremental e o manifesto assinado à release. A release é publicada como a mais recente depois que os três arquivos são enviados.

Para ativar a assinatura no GitHub Actions, cadastre uma vez a chave existente como secret do repositório. Na máquina que guarda a chave, com o GitHub CLI autenticado, rode o seguinte comando. [Secrets do GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)

```powershell
$keyPath = Join-Path $env:LOCALAPPDATA 'PerifericosTarve\assinatura\tarve-update.key'
Get-Content -LiteralPath $keyPath -Raw | gh secret set TARVE_UPDATE_PRIVATE_KEY --repo omarcosr/perifericos-tarve
```

Guarde uma cópia protegida da chave fora do Git. Use a mesma chave para manter a compatibilidade com os apps instalados. O repositório precisa estar público para que o app consiga consultar as releases. Para publicar a versão atual ou reexecutar após corrigir a configuração, abra **Actions → Publicar versão** e selecione **Run workflow** na `main`. Se o envio dos arquivos foi interrompido, reexecute o workflow original para concluir o rascunho do mesmo commit.

Para gerar os arquivos localmente, use o comando abaixo. Em outra máquina, defina `TARVE_UPDATE_PRIVATE_KEY` com o caminho da mesma chave ou seu valor em base64.

```powershell
bun run release --notes 'Resumo da versão'
```

O comando gera os três arquivos em `releases/<versão>`. [Atualizações no Tarve](https://tarve.dev/docs/updates)

Para testar com outro servidor, defina `PERIFERICOS_UPDATE_URL` com a URL completa do manifesto. Mantenha os artefatos relativos ao endereço do manifesto ou gere a release com `--base-url`.

O build distribui um `.exe`. O Tarve extrai sua biblioteca nativa embutida para o cache local na primeira execução e guarda os pacotes instalados no AppData. `src/devices/catalog.ts` define as interfaces HID reconhecidas, e os módulos `hs80.ts`, `viper.ts` e `mchose.ts` concentram os comandos de cada família.

O painel segue o tema claro ou escuro do Windows ao abrir. As imagens incorporadas no executável são dos fabricantes. [Corsair HS80 MAX](https://www.corsair.com/us/en/p/gaming-headsets/ca-9011295-na/hs80-max-wireless-gaming-headset-steel-gray-ca-9011295-na) · [Razer Viper V3 Pro](https://www.razer.com/gaming-mice/razer-viper-v3-pro/RZ01-05120100-R3U1) · [MCHOSE K7 Ultra](https://www.mchose.store/products/mchose-k7-ultra-lightweight-wireless-gaming-mouse)
