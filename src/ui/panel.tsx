import {
  Badge, Button, Column, createTheme, darkTheme, Icon, Input, lightTheme, Progress, Row,
  Scroll, Select, Separator, Switch, Text, TitleBar, ToggleGroup, View, Window, type VNode,
} from "@tarve/core";
import type { HeadsetState } from "../devices/headset-controller";
import type { MouseState } from "../devices/viper";
import { hs80, viper } from "../devices/catalog";
import { validDpi } from "../devices/protocol";
import { sounds, type Preferences } from "../win/preferences";

export type Tab = "headset" | "mouse";
export interface PanelState {
  visible: boolean;
  dark: boolean;
  tab: Tab;
  headset: HeadsetState;
  mouse: MouseState;
  mouseBusy: boolean;
  mouseNotice?: { text: string; error: boolean };
  preferences: Preferences;
  startup: boolean;
  startupPending: boolean;
  startupAvailable: boolean;
  headsetNotice?: string;
  dpi: string;
  rate: string;
}
export interface PanelActions {
  tab(next: Tab): void;
  close(): void;
  lightsOff(enabled: boolean): void;
  startup(enabled: boolean): void;
  sound(key: "onUnmute" | "onMute", sound: number): void;
  preview(sound: number): void;
  unmute(): void;
  refreshMouse(): void;
  editDpi(value: string): void;
  selectRate(value: string): void;
  applyMouse(kind: "dpi" | "polling", value: number): void;
}

const themes = {
  dark: createTheme({ colors: {
    background: "#131313", card: "#191919", foreground: "#f3f3f3", muted: "#272727", mutedForeground: "#b9b9b9",
    input: "#1a1a1a", border: "#353535", primary: "#27b381", primaryForeground: "#061c13", primaryHover: "#3dc291",
    primaryActive: "#179a6b", ring: "#50c89e", success: "#70e2ac", successMuted: "#20382d",
  } }, darkTheme),
  light: createTheme({ colors: {
    background: "#ffffff", card: "#fafafa", foreground: "#181818", muted: "#eeeeee", mutedForeground: "#535353",
    input: "#ffffff", border: "#d9d9d9", primary: "#00864b", primaryForeground: "#ffffff", primaryHover: "#007140",
    primaryActive: "#00653a", ring: "#00864b", success: "#006b40", successMuted: "#e1f3e9",
  } }, lightTheme),
};
const muted = "var(--muted-foreground)";
const soundOptions = sounds.map((label, i) => ({ label, value: String(i) }));
const hz = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const headsetNotices = {
  looking: ["Procurando headset", "O painel está verificando a conexão com o HS80 MAX."],
  disconnected: ["Desconectado", "Ligue o headset com o receptor USB conectado."],
  icue: ["Controle em pausa", "Feche o iCUE para retomar o controle do headset aqui."],
  legacy: ["Controle em uso", "Encerre o controle anterior do HS80 pelo ícone perto do relógio para usar esta versão."],
  "audio-error": ["Microfone indisponível", "Confira se o microfone HS80 MAX está habilitado no Windows."],
} as const;
const mouseNotices = {
  looking: ["Procurando mouse", "O painel está verificando a conexão com o Viper."],
  disconnected: ["Desconectado", "Conecte o receptor sem fio ou o cabo USB e ligue o Viper."],
  waiting: ["Aguardando mouse", "O receptor USB está conectado. Ligue ou mova o Viper para retomar a comunicação."],
  duplicate: ["Mais de um Viper detectado", "Deixe conectado apenas o mouse que você quer configurar."],
  unavailable: ["Sem resposta", "Confira a conexão USB e atualize a leitura."],
} as const;

function Notice({ text, action }: { text: readonly [string, string]; action?: VNode }) {
  return <Row align="start" gap={14} padding={19} style={{ background: "var(--card)", borderWidth: 1, borderColor: "var(--border)", radius: 13 }}>
    <Row align="center" justify="center" style={{ width: 36, height: 36, shrink: 0, background: "var(--muted)", radius: 8 }}>
      <Icon name="info" color={muted} size={18} />
    </Row>
    <Column flex={1} gap={7} style={{ minWidth: 0 }}>
      <Text size={18} weight={600}>{text[0]}</Text>
      <Text size={14} color={muted}>{text[1]}</Text>
      {action ? <Row style={{ margin: { top: 3 } }}>{action}</Row> : null}
    </Column>
  </Row>;
}

function Battery({ level, charging, dark }: { level?: number; charging?: boolean; dark: boolean }) {
  return <Column gap={9}>
    <Row justify="between">
      <Text weight={500}>Bateria</Text>
      <Text weight={500}>{level === undefined ? "Sem leitura" : `${level}%`}</Text>
    </Row>
    {level !== undefined ? <Progress label="Bateria" value={level} style={{ height: 6,
      ...(level <= 20 ? { foreground: dark ? "#edbd62" : "#93640f" } : {}) }} /> : null}
    {charging ? <Text size={13} color={muted}>Carregando via USB</Text> : null}
  </Column>;
}

function Connected({ children }: { children: string }) {
  return <Row><Badge style={{ background: "var(--success-muted)", foreground: "var(--success)", radius: 6 }}>{children}</Badge></Row>;
}

function SoundChoice({ id, label, value, choose, preview }: { id: string; label: string; value: number; choose: (v: number) => void; preview: () => void }) {
  return <Column gap={6}>
    <Text weight={500}>{label}</Text>
    <Row gap={8}>
      <Select id={id} value={String(value)} options={soundOptions} onValueChange={v => choose(Number(v))} style={{ flex: 1 }} />
      <Button id={`${id}-preview`} variant="outline" disabled={!value}
        control={{ role: "button", label: `Ouvir aviso ${label.toLowerCase()}` }} onClick={preview}>Ouvir</Button>
    </Row>
  </Column>;
}

function HeadsetPanel({ state, actions }: { state: PanelState; actions: PanelActions }) {
  const device = state.headset;
  const preferences = state.preferences;
  if (device.status !== "connected") return <Notice text={headsetNotices[device.status]} />;
  const mic = device.hardwareMuted ? "Silenciado pela haste" : device.windowsMuted ? "Silenciado no Windows" : "Ativo";
  return <>
    <Column gap={7}>
      <Row justify="between" gap={10}><Text weight={500}>Microfone</Text><Text>{mic}</Text></Row>
      <Text size={14} color={muted}>{device.hardwareMuted ? "Abaixe a haste para falar." : "Levante a haste para silenciar o microfone."}</Text>
      {!device.hardwareMuted && device.windowsMuted ? <Row><Button size="sm" variant="outline" onClick={actions.unmute}>Reativar no Windows</Button></Row> : null}
    </Column>
    <Separator />
    <Battery level={device.battery} dark={state.dark} />
    <Column gap={11}>
      <Text size={18} weight={600}>Preferências</Text>
      <Column gap={5}>
        <Switch id="leds" label="Manter LEDs apagados" checked={preferences.lightsOff} onCheckedChange={actions.lightsOff} />
        <Text size={13} color={muted} style={{ margin: { left: 44 } }}>Logotipos e luz na ponta do microfone.</Text>
      </Column>
      <Column gap={5}>
        <Switch id="startup" label="Iniciar com o Windows" checked={state.startup}
          disabled={!state.startupAvailable || state.startupPending} onCheckedChange={actions.startup} />
        <Text size={13} color={muted} style={{ margin: { left: 44 } }}>{state.startupAvailable ? "Aplica as preferências ao entrar na sua conta." : "Disponível no executável da pasta dist."}</Text>
      </Column>
    </Column>
    <Column gap={12}>
      <Text size={18} weight={600}>Sons do microfone</Text>
      <SoundChoice id="sound-active" label="Ao ativar" value={preferences.onUnmute} choose={value => actions.sound("onUnmute", value)} preview={() => actions.preview(preferences.onUnmute)} />
      <SoundChoice id="sound-muted" label="Ao silenciar" value={preferences.onMute} choose={value => actions.sound("onMute", value)} preview={() => actions.preview(preferences.onMute)} />
      <Text size={13} color={muted}>Os avisos acompanham a haste e o mudo do Windows.</Text>
    </Column>
    {state.headsetNotice ? <Text size={13} color="var(--destructive-text)">{state.headsetNotice}</Text> : null}
  </>;
}

function MousePanel({ state, actions }: { state: PanelState; actions: PanelActions }) {
  const mouse = state.mouse;
  const refresh = <Button size="sm" variant="outline" disabled={state.mouseBusy} onClick={actions.refreshMouse}>Atualizar</Button>;
  if (mouse.status !== "connected") return <Notice text={mouseNotices[mouse.status]} action={refresh} />;
  const nextDpi = Number(state.dpi);
  const nextRate = Number(state.rate);
  const dpi = mouse.dpi;
  const dpiEnabled = !!dpi && !state.mouseBusy && /^\d+$/.test(state.dpi) && validDpi(nextDpi) && (nextDpi !== dpi.x || nextDpi !== dpi.y);
  const rates = mouse.rates ?? [];
  const rateEnabled = !!mouse.polling && !state.mouseBusy && rates.includes(nextRate) && nextRate !== mouse.polling;
  return <>
    <Row justify="between" gap={10}><Connected>{mouse.wireless ? "Conectado sem fio" : "Conectado via USB"}</Connected>{refresh}</Row>
    <Battery level={mouse.battery} charging={mouse.charging} dark={state.dark} />
    <Separator />
    <Column gap={8}>
      <Row justify="between" gap={10}>
        <Text weight={500}>Sensibilidade</Text>
        <Text>{!dpi ? "Sem leitura" : dpi.x === dpi.y ? `${dpi.x} DPI` : `X ${dpi.x} / Y ${dpi.y}`}</Text>
      </Row>
      {dpi ? <>
        <Row gap={8}>
          <Input id="dpi" type="number" value={state.dpi} placeholder="DPI" maxLength={5} disabled={state.mouseBusy}
            style={{ flex: 1 }} onChange={actions.editDpi}
            onSubmit={() => { if (dpiEnabled) actions.applyMouse("dpi", nextDpi); }} />
          <Button variant="outline" disabled={!dpiEnabled} onClick={() => actions.applyMouse("dpi", nextDpi)}>Aplicar DPI</Button>
        </Row>
        <Text size={13} color={muted}>100 a 35.000 DPI. O valor vale para os dois eixos.</Text>
      </> : null}
    </Column>
    <Column gap={8}>
      <Row justify="between" gap={10}><Text weight={500}>Taxa de polling</Text><Text>{mouse.polling ? `${hz(mouse.polling)} Hz` : "Sem leitura"}</Text></Row>
      {mouse.polling ? <>
        <ToggleGroup id="polling" value={rates.includes(nextRate) ? state.rate : ""} disabled={state.mouseBusy}
          items={rates.map(value => ({ value: String(value), label: hz(value) }))}
          onValueChange={value => { if (typeof value === "string" && value) actions.selectRate(value); }} />
        <Row justify="end"><Button size="sm" variant="outline" disabled={!rateEnabled} onClick={() => actions.applyMouse("polling", nextRate)}>Aplicar taxa</Button></Row>
      </> : <Text size={13} color={muted}>Use Atualizar para consultar a taxa do mouse.</Text>}
    </Column>
    {state.mouseNotice ? <Text size={13} color={state.mouseNotice.error ? "var(--destructive-text)" : muted}>{state.mouseNotice.text}</Text> : null}
  </>;
}

export function Panel({ state, actions, width = 560, height = 744 }: { state: PanelState; actions: PanelActions; width?: number; height?: number }) {
  const headset = state.tab === "headset";
  const device = headset ? hs80 : viper;
  const connected = (headset ? state.headset : state.mouse).status === "connected";
  const nav = <Row gap={3} style={{ padding: { right: 8 } }}>
    {([['headset', 'Headset'], ['mouse', 'Mouse']] as const).map(([id, label]) =>
      <Button key={id} id={`tab-${id}`} size="sm" variant={state.tab === id ? "secondary" : "ghost"}
        onClick={() => actions.tab(id)}>{label}</Button>)}
  </Row>;
  return <Window title="Periféricos Tarve" width={width} height={height} minWidth={460} minHeight={500} position="center"
    theme={state.dark ? themes.dark : themes.light} onCloseRequest={event => { event.preventDefault(); actions.close(); }}>
    <TitleBar height={42} actions={nav} style={{ background: "var(--background)" }}>
      <Row gap={7}><Icon name="settings" size={14} color={muted} /><Text color={muted} weight={500} size={13}>Periféricos</Text></Row>
    </TitleBar>
    {state.visible ? <Scroll key={`${device.id}-${connected ? "data" : "notice"}`} flex={1}>
      <Column padding={28} gap={headset && connected ? 15 : 18} style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
        <Column gap={10}>
          <Text size={30} weight={600}>{device.label}</Text>
          {headset && connected ? <Connected>Conectado</Connected> : null}
        </Column>
        {headset ? <HeadsetPanel state={state} actions={actions} /> : <MousePanel state={state} actions={actions} />}
      </Column>
    </Scroll> : <View flex={1} />}
  </Window>;
}
