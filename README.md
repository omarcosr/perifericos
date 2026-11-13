# Periféricos Tarve

Abra `dist/Perifericos.exe` no Windows x64. Esta versão usa Tarve 0.11.1 com txiki.js e QuickJS-ng. O código do app está em TypeScript e TSX. As chamadas a HID e Core Audio passam pela FFI para as bibliotecas do Windows.

- **Headset** controla os LEDs, sincroniza o mudo da haste com o Windows, lê a bateria e reproduz os avisos escolhidos para ativar e silenciar o microfone do Corsair HS80 MAX.
- **Mouse** mostra conexão, bateria, DPI e polling do Razer Viper V3 Pro. Os ajustes são relidos do mouse depois do envio.
- **Bandeja** mostra a porcentagem dentro de cada ícone de bateria. O HS80 MAX aparece em azul e o Viper V3 Pro em verde. Carga baixa aparece em âmbar, e um traço indica bateria sem leitura. Passe o cursor sobre o ícone para ver o nome do dispositivo. Se o Windows guardar os indicadores em `^`, arraste-os de lá para perto do relógio.
- **Menu do indicador azul** reabre o painel e encerra o controle. `--run` inicia na bandeja, `--mouse` abre a aba Mouse, `--hide` oculta o painel e `--stop` encerra a instância.

Para usar o controle do HS80 nesta versão, encerre o controlador em C pelo ícone perto do relógio. Quando o iCUE está aberto, o Tarve pausa o controle do headset. Para transferir a inicialização com o Windows, desative a opção na versão em C e ative-a pelo executável Tarve. A tarefa do Tarve inicia o app 15 segundos após entrar na conta. As preferências do Tarve ficam em `%LOCALAPPDATA%\PerifericosTarve\preferencias.ini`.

Na primeira execução, `PERIFERICOS_IMPORT_INI` pode apontar para o `hs80.ini` da versão em C para trazer LEDs e sons.

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

Com o checkout local do Tarve, a compilação em QuickJS também pode usar a CLI do repositório.

```powershell
bun A:/tarve/packages/core/cli.ts build src/main.tsx --runtime txiki --native-features core --outfile dist/Perifericos.exe
```

O build distribui um `.exe`. O Tarve extrai sua biblioteca nativa embutida para o cache local na primeira execução. `src/devices/catalog.ts` define as interfaces HID reconhecidas, e os módulos `hs80.ts` e `viper.ts` concentram os comandos de cada família.
