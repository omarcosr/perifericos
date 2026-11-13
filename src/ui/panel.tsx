import {
  Button, Column, Icon, Image, Input, Progress, Row, Scroll, Switch, Text, TitleBar, View,
  Window, viewport, type Style, type SvgNode, type VNode,
} from "@tarve/core";
import type { HeadsetState } from "../devices/headset-controller";
import type { MouseState } from "../devices/viper";
import { hs80, viper } from "../devices/catalog";
import { validDpi } from "../devices/protocol";
import { sounds, type Preferences } from "../win/preferences";
import { panelTheme } from "./panel-theme";
import headsetPhoto from "./assets/hs80-max.webp" with { type: "file" };
import mousePhoto from "./assets/viper-v3-pro.webp" with { type: "file" };

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

const muted = "var(--muted-foreground)";
const accent = "var(--primary)";
const border = "var(--border)";
const secondary = "var(--secondary)";
const card: Style = { background: "var(--card)", borderWidth: 1, borderColor: border, radius: 14 };
const fixedButton: Style = { shrink: 0, radius: 8 };
const numbers = { fontFeatureSettings: "'tnum' 1" };
const soundOptions = sounds.map((label, i) => ({ label, value: String(i) }));
const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const glyphs = {
  app: [["path", { d: "M4 17V7m8 13V4m8 13V7M2 13h4m4-5h4m4 6h4" }]],
  headset: [["path", { d: "M3 14v-2a9 9 0 0 1 18 0v2m-18 0h3a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2zm18 0h-3a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h2a2 2 0 0 0 2-2z" }]],
  mouse: [["rect", { x: 6, y: 3, width: 12, height: 18, rx: 6 }], ["path", { d: "M12 7v3" }]],
  battery: [["rect", { x: 2.5, y: 7, width: 17, height: 10, rx: 2 }], ["path", { d: "M22 10v4M6 12h5" }]],
  mic: [["rect", { x: 9, y: 3, width: 6, height: 12, rx: 3 }], ["path", { d: "M5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-3 0h6" }]],
  micOff: [["path", { d: "M3 3l18 18M9 9v3a3 3 0 0 0 5 2m1-4V6a3 3 0 0 0-5-2M5 11v1a7 7 0 0 0 12 5m2-5v-1M12 19v3m-3 0h6" }]],
  refresh: [["path", { d: "M20 7v5h-5m-11 5v-5h5m10.5-3.5a8 8 0 0 0-13-2M4.5 15.5a8 8 0 0 0 13 2" }]],
  linkOff: [["path", { d: "M3 3l18 18M9 7l2-2a5 5 0 0 1 7 7l-2 2M8 10l-2 2a5 5 0 0 0 7 7l2-2" }]],
  dpi: [["circle", { cx: 12, cy: 12, r: 7 }], ["path", { d: "M12 2v5m0 10v5M2 12h5m10 0h5" }]],
  polling: [["path", { d: "M2 12h5l3-7 4 14 3-7h5" }]],
} satisfies Record<string, readonly SvgNode[]>;

const devices = {
  headset: { ...hs80, photo: headsetPhoto, tabLabel: "Headset" },
  mouse: { ...viper, photo: mousePhoto, tabLabel: "Mouse" },
};

const headsetNotices = {
  looking: ["Procurando headset", "Aguarde a leitura do receptor USB."],
  disconnected: ["Headset desconectado", "Ligue o headset e confira se o receptor USB está conectado."],
  icue: ["Controle em pausa", "Feche o iCUE para controlar o headset aqui."],
  legacy: ["Controle em uso", "Encerre o controle anterior do HS80 pelo ícone perto do relógio."],
  "audio-error": ["Microfone indisponível", "Confira se o microfone HS80 MAX está habilitado no Windows."],
} as const;
const mouseNotices = {
  looking: ["Procurando mouse", "Aguarde a leitura do receptor ou do cabo USB."],
  disconnected: ["Mouse desconectado", "Conecte o receptor sem fio ou o cabo USB e ligue o Viper."],
  waiting: ["Aguardando mouse", "O receptor está conectado. Ligue ou mova o Viper para retomar a comunicação."],
  duplicate: ["Mais de um Viper detectado", "Deixe conectado apenas o mouse que você quer configurar."],
  unavailable: ["Sem resposta do mouse", "Confira a conexão USB e atualize a leitura."],
} as const;

function RefreshMouse({ busy, refresh }: { busy: boolean; refresh: () => void }) {
  return <Button id="refresh-mouse" variant="outline" size="sm" disabled={busy}
    style={{ ...fixedButton, height: 34, background: "var(--card)" }} onClick={refresh}>
    <Row align="center" gap={7}><Icon iconNode={glyphs.refresh} size={14} /><Text>{busy ? "Consultando…" : "Atualizar"}</Text></Row>
  </Button>;
}

function Connection({ text }: { text: string }) {
  return <Row id="device-connection" align="center" gap={7} padding={{ left: 9, right: 10, top: 4, bottom: 4 }}
    style={{ alignSelf: "start", background: "var(--success-muted)", radius: 20 }}>
    <View style={{ width: 6, height: 6, radius: 3, background: "var(--success)", shrink: 0 }} />
    <Text color="var(--success)" size={12} weight={600}>{text}</Text>
  </Row>;
}

function Battery({ level, charging, warning }: { level?: number; charging?: boolean; warning: string }) {
  const low = level !== undefined && level <= 20;
  return <Column id="device-battery" gap={8} style={{ width: "100%", maxWidth: 255 }}>
    <Row align="center" justify="between" gap={12}>
      <Row align="center" gap={7}>
        <Icon iconNode={glyphs.battery} size={16} color={muted} />
        <Text size={13} weight={500} color={muted}>Bateria</Text>
      </Row>
      <Text id="battery-reading" size={level === undefined ? 13 : 25} weight={650}
        style={{ ...numbers, lineHeight: 1.1, letterSpacing: -0.5 }} color={low ? warning : undefined}>
        {level === undefined ? "Sem leitura" : `${level}%`}
      </Text>
    </Row>
    {level !== undefined ? <Progress label="Bateria" value={level} style={{
      height: 5, radius: 3, background: "var(--muted)", foreground: low ? warning : accent,
    }} /> : null}
    {charging ? <Text size={12} color={muted}>Carregando via USB</Text>
      : low ? <Text size={12} weight={500} color={warning}>Carga baixa</Text> : null}
  </Column>;
}

function DevicePhoto({ tab, dark, compact }: { tab: Tab; dark: boolean; compact: boolean }) {
  const paint = panelTheme[tab];
  const tint = dark ? paint.photoDark : paint.photoLight;
  return <Column id="device-photo" align="center" justify="center" style={{
    width: compact ? 127 : 195, alignSelf: "stretch", minHeight: compact ? 145 : 176, shrink: 0,
    background: `radial-gradient(ellipse at 50% 43%, ${tint}, ${dark ? "#18212c" : "#ecf1f8"})`,
    borderWidth: { left: 1 }, borderColor: border,
  }}>
    <Image id="product-image" src={devices[tab].photo} fit="contain"
      width={compact ? 105 : 165} height={compact ? 120 : 153} />
  </Column>;
}

function DeviceOverview({ state, actions, compact }: { state: PanelState; actions: PanelActions; compact: boolean }) {
  const headset = state.tab === "headset";
  const device = headset ? state.headset : state.mouse;
  const headsetStatus = state.headset.status;
  const mouseStatus = state.mouse.status;
  const notice = headset
    ? (headsetStatus === "connected" ? undefined : headsetNotices[headsetStatus])
    : (mouseStatus === "connected" ? undefined : mouseNotices[mouseStatus]);
  const warning = state.dark ? "#f3bf76" : "#885000";
  const connection = headset ? "Conectado" : state.mouse.wireless ? "Conectado sem fio" : "Conectado via USB";
  const refresh = !headset ? <RefreshMouse busy={state.mouseBusy} refresh={actions.refreshMouse} /> : null;
  const heading = <Text id="device-name" size={compact ? 26 : 34} weight={670}
    style={{ lineHeight: 1.14, letterSpacing: compact ? -0.55 : -0.95 }}>{devices[state.tab].label}</Text>;

  return <Row id="device-overview" align="stretch" style={{ ...card, overflow: "hidden" }}>
    <Column flex={1} gap={14} justify="center" padding={compact ? 16 : 21} style={{ minWidth: 0 }}>
      {heading}
      {!notice ? <>
        <Row gap={9} align="center" style={{ wrap: true, rowGap: 7 }}>
          <Connection text={connection} />{refresh}
        </Row>
        <Battery level={device.battery} charging={!headset && state.mouse.charging} warning={warning} />
      </> : <Column gap={8}>
          <Row gap={8} align="center">
            <Icon iconNode={glyphs.linkOff} size={17} color={muted} />
            <Text id="device-notice" size={16} weight={630}>{notice[0]}</Text>
          </Row>
          <Text size={14} color={muted} style={{ lineHeight: 1.4, maxWidth: 400 }}>{notice[1]}</Text>
          {refresh ? <Row style={{ margin: { top: 5 } }}>{refresh}</Row> : null}
        </Column>}
    </Column>
    <DevicePhoto tab={state.tab} dark={state.dark} compact={compact} />
  </Row>;
}

function SoundChoice({ id, label, value, choose, preview, compact }: {
  id: string; label: string; value: number; choose: (value: number) => void; preview: () => void; compact: boolean;
}) {
  const Layout = compact ? Row : Column;
  return <Layout gap={compact ? 12 : 6} align={compact ? "center" : "stretch"} style={{ minWidth: 0 }} flex={compact ? undefined : 1}>
    <label htmlFor={id} style={compact ? { width: 76, shrink: 0 } : undefined}>
      <span style={{ fontSize: 13, fontWeight: 580, color: muted }}>{label}</span>
    </label>
    <Row gap={8} align="center" flex={compact ? 1 : undefined} style={{ minWidth: 0 }}>
      <select id={id} value={String(value)} onValueChange={value => choose(Number(value))} style={{ flex: 1, minWidth: 0 }}>
        {soundOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <Button id={`${id}-preview`} variant="outline" disabled={!value} style={fixedButton}
        control={{ role: "button", label: `Ouvir aviso ${label.toLowerCase()}` }} onClick={preview}>
        <Row align="center" gap={6}><Icon name="play" size={12} /><Text>Ouvir</Text></Row>
      </Button>
    </Row>
  </Layout>;
}

function HeadsetControls({ state, actions, compact }: { state: PanelState; actions: PanelActions; compact: boolean }) {
  const device = state.headset;
  const { preferences } = state;
  const micMuted = device.hardwareMuted || device.windowsMuted;
  const micStatus = device.hardwareMuted ? "Silenciado pela haste" : device.windowsMuted ? "Silenciado no Windows" : "Microfone ativo";
  const micHelp = device.hardwareMuted ? "Abaixe a haste para falar."
    : device.windowsMuted ? "Você pode reativar a entrada aqui." : "Levante a haste para silenciar.";
  const SoundLayout = compact ? Column : Row;

  return <>
    <Row id="microphone-status" align="center" justify="between" gap={10} padding={compact ? 12 : 14}
      style={{ ...card, wrap: true }}>
      <Row gap={11} align="center" flex={1} style={{ minWidth: 154 }}>
        <Row align="center" justify="center" style={{ width: 36, height: 36, shrink: 0, radius: 10, background: micMuted ? "var(--muted)" : secondary }}>
          <Icon iconNode={micMuted ? glyphs.micOff : glyphs.mic} size={19} color={micMuted ? muted : accent} />
        </Row>
        <Column gap={2} style={{ minWidth: 0 }}>
          <Text size={15} weight={630}>{micStatus}</Text>
          <Text size={13} color={muted}>{micHelp}</Text>
        </Column>
      </Row>
      {!device.hardwareMuted && device.windowsMuted ? <Button id="unmute" variant="outline" size="sm" style={fixedButton}
        control={{ role: "button", label: "Reativar microfone no Windows" }} onClick={actions.unmute}>
        Reativar
      </Button> : null}
    </Row>

    <Column gap={8}>
      <Text size={17} weight={640}>Controle do headset</Text>
      <Column style={card}>
        <Column gap={1} padding={{ left: 14, right: 14, top: 7, bottom: 8 }}>
          <Switch id="leds" label="Manter LEDs apagados" checked={preferences.lightsOff} onCheckedChange={actions.lightsOff} />
          <Text size={12} color={muted} style={{ margin: { left: 45 } }}>Logotipos e luz na ponta do microfone.</Text>
        </Column>
        <Column gap={1} padding={{ left: 14, right: 14, top: 7, bottom: 8 }}
          style={{ borderWidth: { top: 1 }, borderColor: border }}>
          <Switch id="startup" label="Iniciar com o Windows" checked={state.startup}
            disabled={!state.startupAvailable || state.startupPending} onCheckedChange={actions.startup} />
          {!state.startupAvailable || state.startupPending ? <Text size={12} color={muted} style={{ margin: { left: 45 } }}>
            {state.startupPending ? "Salvando…" : "Disponível no executável da pasta dist."}
          </Text> : null}
        </Column>
      </Column>
    </Column>

    <Column gap={8}>
      <Text size={17} weight={640}>Sons do microfone</Text>
      <SoundLayout gap={compact ? 8 : 20} padding={14} style={card}>
        <SoundChoice id="sound-active" label="Ao ativar" value={preferences.onUnmute} compact={compact}
          choose={value => actions.sound("onUnmute", value)} preview={() => actions.preview(preferences.onUnmute)} />
        <SoundChoice id="sound-muted" label="Ao silenciar" value={preferences.onMute} compact={compact}
          choose={value => actions.sound("onMute", value)} preview={() => actions.preview(preferences.onMute)} />
      </SoundLayout>
    </Column>
  </>;
}

function MouseControls({ state, actions, compact }: { state: PanelState; actions: PanelActions; compact: boolean }) {
  const { mouse, mouseBusy } = state;
  const dpi = mouse.dpi;
  const nextDpi = Number(state.dpi);
  const nextRate = Number(state.rate);
  const rates = mouse.rates ?? [];
  const dpiEnabled = !!dpi && !mouseBusy && /^\d+$/.test(state.dpi) && validDpi(nextDpi) && (nextDpi !== dpi.x || nextDpi !== dpi.y);
  const rateEnabled = !!mouse.polling && !mouseBusy && rates.includes(nextRate) && nextRate !== mouse.polling;
  const currentDpi = !dpi ? "Sem leitura" : dpi.x === dpi.y ? `${formatNumber(dpi.x)} DPI`
    : `X ${formatNumber(dpi.x)} / Y ${formatNumber(dpi.y)}`;
  const RateLayout = compact ? Column : Row;

  return <Column gap={10}>
    <Text size={17} weight={640}>Ajustes do mouse</Text>
    <Column style={card}>
      <Column gap={10} padding={16}>
        <Row gap={8} align="center" justify="between">
          <Row gap={9} align="center"><Icon iconNode={glyphs.dpi} size={17} color={accent} />
            {dpi ? <label htmlFor="dpi"><span style={{ fontSize: 15, fontWeight: 620 }}>Sensibilidade</span></label>
              : <Text size={15} weight={620}>Sensibilidade</Text>}
          </Row>
          <Text id="current-dpi" size={14} weight={600} style={numbers}>{currentDpi}</Text>
        </Row>
        {dpi ? <>
          <Row gap={8} align="center">
            <Input id="dpi" type="number" value={state.dpi} placeholder="DPI" maxLength={5} disabled={mouseBusy}
              style={{ flex: 1, minWidth: 0, fontFeatureSettings: numbers.fontFeatureSettings }}
              onChange={actions.editDpi} onSubmit={() => { if (dpiEnabled) actions.applyMouse("dpi", nextDpi); }} />
            <Button id="apply-dpi" variant={dpiEnabled ? "default" : "outline"} disabled={!dpiEnabled}
              style={fixedButton} onClick={() => actions.applyMouse("dpi", nextDpi)}>Aplicar DPI</Button>
          </Row>
          <Text size={12} color={muted}>100 a 35.000 DPI para os dois eixos.</Text>
        </> : null}
      </Column>
      <Column gap={10} padding={16} style={{ borderWidth: { top: 1 }, borderColor: border }}>
        <Row gap={8} align="center" justify="between">
          <Row gap={9} align="center"><Icon iconNode={glyphs.polling} size={17} color={accent} /><Text size={15} weight={620}>Taxa de polling</Text></Row>
          <Text id="current-rate" size={14} weight={600} style={numbers}>
            {mouse.polling ? `${formatNumber(mouse.polling)} Hz` : "Sem leitura"}
          </Text>
        </Row>
        {mouse.polling ? <RateLayout gap={10} align={compact ? "stretch" : "center"} justify="between">
          <Row id="polling" gap={4} padding={4}
            style={{ flex: compact ? undefined : 1, minWidth: 0, wrap: true, background: "var(--muted)", radius: 9 }}>
            {rates.map(rate => {
              const selected = nextRate === rate;
              return <Button key={rate} id={`polling-item-${rate}`} size="sm" variant={selected ? "secondary" : "ghost"} disabled={mouseBusy}
                control={{ role: "radio", label: `${rate} Hz`, checked: selected }}
                style={{ height: 31, minWidth: 42, grow: 1, radius: 6, padding: { left: 7, right: 7 }, ...numbers }}
                onClick={() => actions.selectRate(String(rate))}>{formatNumber(rate)}</Button>;
            })}
          </Row>
          <Button id="apply-rate" variant={rateEnabled ? "default" : "outline"} disabled={!rateEnabled}
            style={{ ...fixedButton, alignSelf: compact ? "end" : "center" }} onClick={() => actions.applyMouse("polling", nextRate)}>
            Aplicar taxa
          </Button>
        </RateLayout> : <Text size={12} color={muted}>Use Atualizar para consultar a taxa do mouse.</Text>}
      </Column>
    </Column>
  </Column>;
}

function Navigation({ tab, select, compact }: { tab: Tab; select: (tab: Tab) => void; compact: boolean }) {
  return <Row id="device-tabs" gap={3} padding={3}
    style={{ background: "var(--muted)", radius: 10, margin: { right: 8 } }}>
    {(["headset", "mouse"] as const).map(next => {
      const selected = next === tab;
      return <Button key={next} id={`tab-${next}`} variant={selected ? "secondary" : "ghost"} size="sm"
        control={{ role: "tab", selected, label: devices[next].tabLabel }}
        onClick={() => select(next)} style={{
          height: 30, radius: 7, padding: { left: compact ? 8 : 11, right: compact ? 8 : 11 },
        }}>
        <Row align="center" gap={6}>
          <Icon iconNode={glyphs[next]} size={15} color={selected ? accent : muted} />
          <Text size={13} weight={selected ? 640 : 520}>{devices[next].tabLabel}</Text>
        </Row>
      </Button>;
    })}
  </Row>;
}

export function Panel({ state, actions, width = 660, height = 680 }: {
  state: PanelState; actions: PanelActions; width?: number; height?: number;
}) {
  const headset = state.tab === "headset";
  const connected = (headset ? state.headset : state.mouse).status === "connected";
  const currentWidth = viewport().width || width;
  const compact = currentWidth < 560;
  const theme = panelTheme[state.tab][state.dark ? "dark" : "light"];
  const notice = headset ? state.headsetNotice : state.mouseNotice?.text;
  const noticeError = headset || !!state.mouseNotice?.error;

  return <Window title="Periféricos Tarve" width={width} height={height} minWidth={460} minHeight={500} position="center"
    theme={theme} onCloseRequest={event => { event.preventDefault(); actions.close(); }}>
    <TitleBar height={49} appearance={state.dark ? "dark" : "light"} buttonStyle={{ width: compact ? 34 : 42 }}
      actions={<Navigation tab={state.tab} select={actions.tab} compact={compact} />}
      style={{ background: "var(--card)", padding: { left: compact ? 14 : 22 } }}>
      <Row gap={9} align="center">
        <Row align="center" justify="center" style={{ width: 27, height: 27, radius: 7, background: secondary, shrink: 0 }}>
          <Icon iconNode={glyphs.app} size={15} color={accent} />
        </Row>
        <Text size={14} weight={640}>Periféricos</Text>
      </Row>
    </TitleBar>
    {state.visible ? <Scroll id="device-scroll" key={state.tab} flex={1} style={{ scrollbarColor: "var(--scrollbar)" }}>
      <Column id="device-content" padding={compact ? 16 : 22} gap={connected ? 16 : 14}
        style={{ width: "100%", maxWidth: 800, alignSelf: "center" }}>
        <DeviceOverview state={state} actions={actions} compact={compact} />
        {connected ? headset ? <HeadsetControls state={state} actions={actions} compact={compact} />
          : <MouseControls state={state} actions={actions} compact={compact} /> : null}
        {notice ? <Text size={13} color={noticeError ? "var(--destructive-text)" : muted}>{notice}</Text> : null}
      </Column>
    </Scroll> : <View flex={1} />}
  </Window>;
}
