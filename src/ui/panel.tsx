import {
  Button, Column, Dialog, Icon, Image, Input, Progress, Row, Scroll, Slider, Spinner, Switch, Text, TitleBar, View,
  Window, viewport, type Style, type SvgNode, type VNode,
} from "@tarve/core";
import type { HeadsetState } from "../devices/headset-controller";
import { validDpi, type MouseState } from "../devices/mouse-state";
import { hs80, mchoseK7, mouseModels, viper, type MouseModelId } from "../devices/catalog";
import { hasUpdate, type UpdateView } from "../app-updates";
import { sounds, type Preferences } from "../win/preferences";
import { panelTheme } from "./panel-theme";
import brandIcon from "./assets/app-icon.png" with { type: "file" };
import headsetPhoto from "./assets/hs80-max.webp" with { type: "file" };
import mousePhoto from "./assets/viper-v3-pro.webp" with { type: "file" };
import k7Photo from "./assets/mchose-k7-ultra.webp" with { type: "file" };

export type Tab = "headset" | "mouse";
export interface PanelState {
  visible: boolean;
  dark: boolean;
  tab: Tab;
  headset: HeadsetState;
  mouse: MouseState;
  mouseModels: readonly MouseModelId[];
  mouseBusy: boolean;
  mouseNotice?: { text: string; error: boolean };
  preferences: Preferences;
  startup: boolean;
  startupPending: boolean;
  startupAvailable: boolean;
  settingsOpen: boolean;
  startupNotice?: string;
  headsetNotice?: string;
  dpi: string;
  rate: string;
  updates?: { open: boolean; version: string; view: UpdateView };
}
export interface PanelActions {
  tab(next: Tab): void;
  close(): void;
  lightsOff(enabled: boolean): void;
  startup(enabled: boolean): void;
  showSettings(): void;
  closeSettings(): void;
  sound(key: "onUnmute" | "onMute", sound: number): void;
  preview(sound: number): void;
  unmute(): void;
  selectMouse(model: MouseModelId): void;
  editDpi(value: string): void;
  selectRate(value: string): void;
  applyMouse(kind: "dpi" | "polling", value: number): void;
  showUpdates(): void;
  closeUpdates(): void;
  checkUpdates(): void;
  installUpdate(): void;
}

const muted = "var(--muted-foreground)";
const accent = "var(--primary)";
const border = "var(--border)";
const secondary = "var(--secondary)";
// Panel spacing uses an 8 px grid with half steps for optical alignment.
const cardInset = 16;
const panelMaxWidth = 800;
const compactWidth = 576;
const card: Style = { background: "var(--card)", borderWidth: 1, borderColor: border, radius: 16 };
const fixedButton: Style = { shrink: 0, radius: 8 };
const toolbarButton: Style = { ...fixedButton, width: 112, height: 32, padding: { left: 8, right: 8 } };
const applyButton: Style = { ...fixedButton, width: 112, height: 40 };
const settingsRow: Style["padding"] = { left: cardInset, right: cardInset, top: 8, bottom: 8 };
const settingsSwitch: Style = { minHeight: 32, gap: 12 };
const settingsHint: Style = { margin: { left: 48 }, lineHeight: 4 / 3 };
const rowDivider: Style = { borderWidth: { top: 1 }, borderColor: border };
const sectionTitle = { lineHeight: 1.5 };
const numbers = { fontFeatureSettings: "'tnum' 1" };
const soundOptions = sounds.map((label, i) => ({ label, value: String(i) }));
const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const glyphs = {
  headset: [["path", { d: "M3 14v-2a9 9 0 0 1 18 0v2m-18 0h3a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2zm18 0h-3a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h2a2 2 0 0 0 2-2z" }]],
  mouse: [["rect", { x: 6, y: 3, width: 12, height: 18, rx: 6 }], ["path", { d: "M12 7v3" }]],
  battery: [["rect", { x: 2.5, y: 7, width: 17, height: 10, rx: 2 }], ["path", { d: "M22 10v4M6 12h5" }]],
  charging: [["path", { d: "m13 2-8 12h6l-1 8 9-12h-7z" }]],
  mic: [["rect", { x: 9, y: 3, width: 6, height: 12, rx: 3 }], ["path", { d: "M5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-3 0h6" }]],
  micOff: [["path", { d: "M3 3l18 18M9 9v3a3 3 0 0 0 5 2m1-4V6a3 3 0 0 0-5-2M5 11v1a7 7 0 0 0 12 5m2-5v-1M12 19v3m-3 0h6" }]],
  update: [["path", { d: "M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" }]],
  settings: [["path", { d: "M12 3h2l.5 2.2 1.7 1 2.2-.7 2 3.4-1.7 1.5v2.1l1.7 1.5-2 3.4-2.2-.7-1.7 1-.5 2.3h-4l-.5-2.3-1.7-1-2.2.7-2-3.4 1.7-1.5v-2.1L3.6 9l2-3.4 2.2.7 1.7-1L10 3z" }], ["circle", { cx: 12, cy: 11.5, r: 3 }]],
  linkOff: [["path", { d: "M3 3l18 18M9 7l2-2a5 5 0 0 1 7 7l-2 2M8 10l-2 2a5 5 0 0 0 7 7l2-2" }]],
  dpi: [["circle", { cx: 12, cy: 12, r: 7 }], ["path", { d: "M12 2v5m0 10v5M2 12h5m10 0h5" }]],
  polling: [["path", { d: "M2 12h5l3-7 4 14 3-7h5" }]],
} satisfies Record<string, readonly SvgNode[]>;

const devices = {
  headset: { tabLabel: "Headset" },
  mouse: { tabLabel: "Mouse" },
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
  disconnected: ["Mouse desconectado", "Ligue um mouse compatível e conecte o receptor ou o cabo USB."],
  waiting: ["Aguardando mouse", "O receptor está conectado. Ligue ou mova o mouse para retomar a comunicação."],
  duplicate: ["Dois mouses do mesmo modelo", "Deixe conectado apenas o mouse que você quer configurar."],
  unavailable: ["Sem resposta do mouse", "Confira a conexão USB. A leitura será retomada automaticamente."],
} as const;

function Connection({ text }: { text: string }) {
  return <Row id="device-connection" align="center" gap={8} padding={{ left: 8, right: 8 }}
    style={{ height: 24, shrink: 0, background: "var(--success-muted)", radius: 12 }}>
    <View style={{ width: 6, height: 6, radius: 3, background: "var(--success)", shrink: 0 }} />
    <Text color="var(--success)" size={12} weight={600}>{text}</Text>
  </Row>;
}

function Battery({ level, charging, warning }: { level?: number; charging?: boolean; warning: string }) {
  const low = !charging && level !== undefined && level <= 20;
  const labelColor = charging ? "var(--success)" : muted;
  return <Column id="device-battery" gap={8} style={{ width: "100%", minHeight: 48 }}>
    <Row id="battery-label-row" align="center" justify="between" gap={8} style={{ minHeight: 32 }}>
      <Row align="center" gap={8}>
        <Icon iconNode={charging ? glyphs.charging : glyphs.battery} size={16} color={labelColor} />
        <Column>
          <Text id="battery-status" size={13} weight={500} color={labelColor}
            style={{ lineHeight: 1.23 }}>{charging ? "Carregando" : "Bateria"}</Text>
          {low ? <Text id="battery-low" size={12} weight={560} color={warning} style={{ lineHeight: 1.33 }}>Carga baixa</Text> : null}
        </Column>
      </Row>
      <Text id="battery-reading" size={level === undefined ? 13 : 24} weight={650}
        style={{ ...numbers, lineHeight: 1.25, letterSpacing: -0.5, shrink: 0 }} color={low ? warning : undefined}>
        {level === undefined ? "Sem leitura" : `${level}%`}
      </Text>
    </Row>
    {level !== undefined ? <Progress id="battery-track" label={charging ? "Nível de carga" : "Bateria"} value={level} style={{
      height: 8, radius: 4, background: "var(--muted)", foreground: low ? warning : accent,
    }} /> : null}
  </Column>;
}

function DevicePhoto({ tab, model, dark, compact }: { tab: Tab; model?: MouseModelId; dark: boolean; compact: boolean }) {
  const paint = panelTheme[tab];
  const tint = dark ? paint.photoDark : paint.photoLight;
  return <Column id="device-photo" align="center" justify="center" style={{
    width: compact ? 128 : 192, alignSelf: "stretch", shrink: 0,
    background: `radial-gradient(ellipse at 50% 43%, ${tint}, ${dark ? "#18212c" : "#ecf1f8"})`,
    borderWidth: { left: 1 }, borderColor: border,
  }}>
    {tab === "mouse" && !model ? <Icon iconNode={glyphs.mouse} size={compact ? 48 : 64} color={muted} />
      : <Image id="product-image" src={tab === "headset" ? headsetPhoto : model === mchoseK7.id ? k7Photo : mousePhoto}
        fit="contain" width={compact ? 104 : 160} height={compact ? 112 : 152} />}
  </Column>;
}

function DeviceOverview({ state, compact }: { state: PanelState; compact: boolean }) {
  const headset = state.tab === "headset";
  const device = headset ? state.headset : state.mouse;
  const model = headset ? hs80 : state.mouse.model ? mouseModels[state.mouse.model] : undefined;
  const headsetStatus = state.headset.status;
  const mouseStatus = state.mouse.status;
  const notice = headset
    ? (headsetStatus === "connected" ? undefined : headsetNotices[headsetStatus])
    : (mouseStatus === "connected" ? undefined : mouseNotices[mouseStatus]);
  const warning = state.dark ? "#f3bf76" : "#885000";
  const connection = headset ? "Conectado" : state.mouse.wireless ? "Conectado sem fio" : "Conectado via USB";

  return <Row id="device-overview" align="stretch" style={{ ...card, minHeight: compact ? 160 : 192, overflow: "hidden" }}>
    <Column id="device-overview-copy" flex={1} gap={8} justify="start" padding={{
      left: cardInset, right: cardInset, top: compact ? 16 : 24, bottom: compact ? 16 : 24,
    }} style={{ minWidth: 0 }}>
      <Text id="device-name" size={compact ? 24 : 32} weight={670}
        style={{ lineHeight: compact ? 4 / 3 : 1.25, letterSpacing: compact ? -0.5 : -0.8 }}>{model?.label ?? "Mouse"}</Text>
      {notice ? <Column gap={8}>
        <Row gap={8} align="center" style={{ minHeight: 32 }}>
          <Icon iconNode={glyphs.linkOff} size={16} color={muted} />
          <Text id="device-notice" size={16} weight={630}>{notice[0]}</Text>
        </Row>
        <Text size={14} color={muted} style={{ lineHeight: 1.4, maxWidth: 400 }}>{notice[1]}</Text>
      </Column> : <>
        <Row id="device-status-row" gap={8} align="center" style={{ minHeight: 32, wrap: true, margin: { bottom: 8 } }}>
          <Connection text={connection} />
        </Row>
        <Battery level={device.battery} charging={device.charging} warning={warning} />
      </>}
    </Column>
    <DevicePhoto tab={state.tab} model={state.mouse.model} dark={state.dark} compact={compact} />
  </Row>;
}

function MousePicker({ state, actions }: { state: PanelState; actions: PanelActions }) {
  return <Row gap={8} align="center">
    <label htmlFor="mouse-model"><span style={{ fontSize: 13, fontWeight: 580, color: muted }}>Dispositivo</span></label>
    <select id="mouse-model" value={state.mouse.model ?? ""} onValueChange={value => actions.selectMouse(value as MouseModelId)}
      style={{ width: 224, minWidth: 0 }}>
      {state.mouseModels.map(id => <option key={id} value={id}>{mouseModels[id].label}</option>)}
    </select>
  </Row>;
}

function SoundChoice({ id, label, value, choose, preview, compact }: {
  id: string; label: string; value: number; choose: (value: number) => void; preview: () => void; compact: boolean;
}) {
  const Layout = compact ? Row : Column;
  return <Layout id={`${id}-row`} gap={8} align={compact ? "center" : "stretch"} style={{ minWidth: 0 }} flex={compact ? undefined : 1}>
    <label htmlFor={id} style={compact ? { width: 80, shrink: 0 } : undefined}>
      <span style={{ fontSize: 13, fontWeight: 580, color: muted }}>{label}</span>
    </label>
    <Row gap={8} align="center" flex={compact ? 1 : undefined} style={{ minWidth: 0, minHeight: 40 }}>
      <select id={id} value={String(value)} onValueChange={value => choose(Number(value))} style={{ flex: 1, minWidth: 0 }}>
        {soundOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {/* Tarve 0.11.1 renders the native Select trigger at 38 px. */}
      <Button id={`${id}-preview`} variant="outline" disabled={!value}
        style={{ ...fixedButton, width: 88, height: 38, padding: { left: 8, right: 8 } }}
        control={{ role: "button", label: `Ouvir aviso ${label.toLowerCase()}` }} onClick={preview}>
        <Row align="center" gap={8}><Icon name="play" size={16} /><Text>Ouvir</Text></Row>
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
    <Row id="microphone-status" align="center" justify="between" gap={8}
      padding={{ left: cardInset, right: cardInset, top: 12, bottom: 12 }}
      style={{ ...card, wrap: true }}>
      <Row gap={16} align="center" flex={1} style={{ minWidth: 176 }}>
        <Row align="center" justify="center" style={{ width: 32, height: 32, shrink: 0, radius: 8, background: micMuted ? "var(--muted)" : secondary }}>
          <Icon iconNode={micMuted ? glyphs.micOff : glyphs.mic} size={16} color={micMuted ? muted : accent} />
        </Row>
        <Column gap={4} style={{ minWidth: 0 }}>
          <Text id="mic-reading" size={16} weight={630} style={{ lineHeight: 1.25 }}>{micStatus}</Text>
          <Text size={12} color={muted} style={{ lineHeight: 4 / 3 }}>{micHelp}</Text>
        </Column>
      </Row>
      {!device.hardwareMuted && device.windowsMuted ? <Button id="unmute" variant="outline" size="sm" style={toolbarButton}
        control={{ role: "button", label: "Reativar microfone no Windows" }} onClick={actions.unmute}>
        Reativar
      </Button> : null}
    </Row>

    <Column gap={8}>
      <Text size={16} weight={640} style={sectionTitle}>Controle do headset</Text>
      <Column id="headset-settings" style={card}>
        <Column padding={settingsRow}>
          <Switch id="leds" label="Manter LEDs apagados" checked={preferences.lightsOff} onCheckedChange={actions.lightsOff}
            style={settingsSwitch} />
          <Text size={12} color={muted} style={settingsHint}>Logotipos e luz na ponta do microfone.</Text>
        </Column>
      </Column>
    </Column>

    <Column gap={8}>
      <Text size={16} weight={640} style={sectionTitle}>Sons do microfone</Text>
      <SoundLayout id="microphone-sounds" gap={16} padding={cardInset} style={card}>
        <SoundChoice id="sound-active" label="Ao ativar" value={preferences.onUnmute} compact={compact}
          choose={value => actions.sound("onUnmute", value)} preview={() => actions.preview(preferences.onUnmute)} />
        <SoundChoice id="sound-muted" label="Ao silenciar" value={preferences.onMute} compact={compact}
          choose={value => actions.sound("onMute", value)} preview={() => actions.preview(preferences.onMute)} />
      </SoundLayout>
    </Column>
  </>;
}

function Sensitivity({ state, actions, compact }: { state: PanelState; actions: PanelActions; compact: boolean }) {
  const { mouse, mouseBusy } = state;
  const dpi = mouse.dpi;
  const range = (mouse.model ? mouseModels[mouse.model] : viper).dpi;
  const nextDpi = Number(state.dpi);
  const valid = /^\d+$/.test(state.dpi) && validDpi(nextDpi, range);
  const invalid = state.dpi !== "" && !valid;
  const canApply = !!dpi && !mouseBusy && valid && (nextDpi !== dpi.x || nextDpi !== dpi.y);
  const apply = () => { if (canApply) actions.applyMouse("dpi", nextDpi); };
  const currentDpi = !dpi ? "Sem leitura" : dpi.x === dpi.y ? `${formatNumber(dpi.x)} DPI`
    : `X ${formatNumber(dpi.x)} / Y ${formatNumber(dpi.y)}`;
  const Layout = compact ? Column : Row;

  return <Column gap={8} padding={cardInset}>
    <Row gap={8} align="center" justify="between" style={{ minHeight: 24 }}>
      <Row gap={8} align="center">
        <Icon iconNode={glyphs.dpi} size={16} color={accent} />
        <Text size={16} weight={620}>Sensibilidade</Text>
      </Row>
      <Row gap={8} align="center">
        {dpi ? <Text size={12} color={muted}>Atual</Text> : null}
        <Text id="current-dpi" size={14} weight={600} style={numbers}>{currentDpi}</Text>
      </Row>
    </Row>
    {dpi ? <>
      <Layout gap={compact ? 8 : 16} align={compact ? "stretch" : "start"}>
        <Column flex={compact ? undefined : 1} style={{ minWidth: 0 }}>
          <Slider id="dpi-slider" label="Sensibilidade em DPI" value={valid ? nextDpi : dpi.x}
            min={range.min} max={range.max} step={range.step} disabled={mouseBusy}
            onValueChange={value => actions.editDpi(String(value))}
            style={{
              width: "100%", height: 40, radius: 8,
              trackThickness: 8, trackRadius: 4, trackInset: 8, trackBackground: border,
              thumbSize: 16, thumbColor: accent, thumbBorderWidth: 0,
              foreground: accent,
              hover: { thumbColor: "var(--primary-hover)" },
              active: { thumbColor: "var(--primary-active)" },
              disabled: { foreground: muted, thumbColor: muted },
            }} />
          <Row id="dpi-range" gap={8} justify="between" padding={{ left: 8, right: 8 }}>
            <Text size={12} color={muted} style={numbers}>{formatNumber(range.min)}</Text>
            <Text size={12} color={muted} style={numbers}>{formatNumber(range.max)} DPI</Text>
          </Row>
        </Column>
        <Row gap={8} align="center" justify="end" style={{ shrink: 0 }}>
          <label htmlFor="dpi"><span style={{ fontSize: 12, fontWeight: 600, color: muted }}>Valor</span></label>
          <Input id="dpi" type="number" value={state.dpi} maxLength={5} disabled={mouseBusy}
            style={{ ...numbers, width: 80, minWidth: 80, height: 40, radius: 8,
              borderColor: invalid ? "var(--destructive-text)" : border }}
            onChange={actions.editDpi} onSubmit={apply} />
          <Button id="apply-dpi" variant={canApply ? "default" : "outline"} disabled={!canApply}
            style={applyButton} onClick={apply}>Aplicar DPI</Button>
        </Row>
      </Layout>
      {invalid ? <Text id="dpi-error" size={12} color="var(--destructive-text)">
        {`Digite um valor de ${formatNumber(range.min)} a ${formatNumber(range.max)} DPI.`}
      </Text> : dpi.x !== dpi.y ? <Text size={12} color={muted}>O ajuste vale para os dois eixos.</Text> : null}
    </> : null}
  </Column>;
}

function MouseControls({ state, actions, compact }: { state: PanelState; actions: PanelActions; compact: boolean }) {
  const { mouse, mouseBusy } = state;
  const nextRate = Number(state.rate);
  const rates = mouse.rates ?? [];
  const rateEnabled = !!mouse.polling && !mouseBusy && rates.includes(nextRate) && nextRate !== mouse.polling;
  const RateLayout = compact ? Column : Row;

  return <Column gap={8}>
    <Text size={16} weight={640} style={sectionTitle}>Ajustes do mouse</Text>
    <Column id="mouse-settings" style={card}>
      <Sensitivity state={state} actions={actions} compact={compact} />
      <Column gap={8} padding={cardInset} style={rowDivider}>
        <Row gap={8} align="center" justify="between" style={{ minHeight: 24 }}>
          <Row gap={8} align="center"><Icon iconNode={glyphs.polling} size={16} color={accent} /><Text size={16} weight={620}>Taxa de polling</Text></Row>
          <Text id="current-rate" size={14} weight={600} style={numbers}>
            {mouse.polling ? `${formatNumber(mouse.polling)} Hz` : "Sem leitura"}
          </Text>
        </Row>
        {mouse.polling ? <RateLayout gap={8} align={compact ? "stretch" : "center"}>
          <Row id="polling" gap={4} padding={4}
            style={{ flex: compact ? undefined : 1, minWidth: 0, background: "var(--muted)", radius: 8 }}>
            {rates.map(rate => {
              const selected = nextRate === rate;
              return <Button key={rate} id={`polling-item-${rate}`} size="sm" variant={selected ? "secondary" : "ghost"} disabled={mouseBusy}
                control={{ role: "radio", label: `${rate} Hz`, checked: selected }}
                style={{ ...numbers, flex: 1, height: 32, minWidth: 0, radius: 4, padding: 0 }}
                onClick={() => actions.selectRate(String(rate))}>{formatNumber(rate)}</Button>;
            })}
          </Row>
          <Button id="apply-rate" variant={rateEnabled ? "default" : "outline"} disabled={!rateEnabled}
            style={{ ...applyButton, alignSelf: compact ? "end" : "center" }} onClick={() => actions.applyMouse("polling", nextRate)}>
            Aplicar taxa
          </Button>
        </RateLayout> : <Text size={12} color={muted}>O app consulta a taxa automaticamente.</Text>}
      </Column>
    </Column>
  </Column>;
}

function Navigation({ tab, select }: { tab: Tab; select: (tab: Tab) => void }) {
  return <Row id="device-tabs" gap={4} padding={4}
    style={{ background: "var(--muted)", radius: 12, margin: { right: 8 } }}>
    {(["headset", "mouse"] as const).map(next => {
      const selected = next === tab;
      return <Button key={next} id={`tab-${next}`} variant={selected ? "secondary" : "ghost"} size="sm"
        control={{ role: "tab", selected, label: devices[next].tabLabel }}
        onClick={() => select(next)} style={{ width: 88, height: 32, radius: 8, padding: 0 }}>
        <Row align="center" gap={8}>
          <Icon iconNode={glyphs[next]} size={16} color={selected ? accent : muted} />
          <Text size={13} weight={600}>{devices[next].tabLabel}</Text>
        </Row>
      </Button>;
    })}
  </Row>;
}

function SettingsDialog({ state, actions }: { state: PanelState; actions: PanelActions }) {
  return <Dialog id="app-settings" open title="Configurações" width={400} showClose={false}
    closeOnOverlay={false} onOpenChange={actions.closeSettings} style={{ radius: 16, padding: 24, gap: 16 }}
    footer={<Button id="close-settings" variant="outline" onClick={actions.closeSettings}
      style={{ ...fixedButton, height: 40 }}>Fechar</Button>}>
    <Column gap={4}>
      <Switch id="startup" label="Iniciar com o Windows" checked={state.startup} style={settingsSwitch}
        disabled={!state.startupAvailable || state.startupPending} onCheckedChange={actions.startup} />
      <Text id="startup-help" size={13} color={muted} style={settingsHint}>
        {state.startupPending ? "Salvando…" : state.startupAvailable
          ? "Abre na bandeja quando você entra na sua conta." : "Disponível no Periféricos instalado ou no executável compilado."}
      </Text>
      {state.startupNotice ? <Text id="startup-notice" size={13} color="var(--destructive-text)" style={settingsHint}>
        {state.startupNotice}
      </Text> : null}
    </Column>
  </Dialog>;
}

function UpdateDialog({ data, actions }: { data: NonNullable<PanelState["updates"]>; actions: PanelActions }) {
  const { view, version } = data;
  const available = view.status === "available";
  const checking = view.status === "idle" || view.status === "checking";
  const downloading = view.status === "downloading";
  const locked = downloading || view.status === "restarting";
  const retry = view.status === "error" || view.status === "unpublished";
  const status = available ? `Versão ${view.update.version} disponível`
    : checking ? "Buscando no GitHub…"
    : downloading ? `Baixando atualização… ${view.percent}%`
    : view.status === "restarting" ? "Reiniciando o Periféricos…"
    : view.status === "installed" ? "Atualização instalada."
    : view.status === "current" ? "Você já está na versão mais recente."
    : view.status === "unpublished" ? "Ainda não há uma atualização pública disponível no GitHub."
    : view.status === "error" ? view.message : "";
  return <Dialog id="app-updates" open={data.open} title="Atualizações" description={`Versão instalada ${version}`}
    width={400} style={{ radius: 16, padding: 24, gap: 16 }}
    showClose={false} closeOnEscape={!locked} closeOnOverlay={false} onOpenChange={actions.closeUpdates}
    footer={locked ? undefined : <>
      <Button id="close-updates" variant={retry || available ? "outline" : "default"} onClick={actions.closeUpdates}
        style={{ ...fixedButton, height: 40 }}>Fechar</Button>
      {available ? <Button id="install-update" onClick={actions.installUpdate} style={{ ...fixedButton, height: 40 }}>
        Instalar e reiniciar
      </Button> : retry ? <Button id="check-update" onClick={actions.checkUpdates} style={{ ...fixedButton, height: 40 }}>
        Tentar novamente
      </Button> : null}
    </>}>
    <Column gap={8}>
      <Row gap={8} align="center" style={{ minHeight: 24 }}>
        {checking ? <Spinner size={16} /> : null}
        <Text id="update-status" size={14} weight={available ? 600 : 500} style={{ minWidth: 0, flex: 1, lineHeight: 1.4 }}
          color={view.status === "error" ? "var(--destructive-text)" : available ? accent : undefined}>{status}</Text>
      </Row>
      {available ? <Text id="update-size" size={13} color={muted}>
        {view.update.kind === "pack" ? "Pacote incremental" : "Executável completo"} · {formatNumber(Math.ceil(view.update.size / 1024))} KB
      </Text> : null}
      {downloading ? <Progress id="update-progress" label="Progresso da atualização" value={view.percent}
        style={{ height: 8, radius: 4, background: "var(--muted)", foreground: accent }} /> : null}
    </Column>
  </Dialog>;
}

export function Panel({ state, actions, width = 672, height = 704 }: {
  state: PanelState; actions: PanelActions; width?: number; height?: number;
}) {
  const headset = state.tab === "headset";
  const connected = (headset ? state.headset : state.mouse).status === "connected";
  const currentWidth = viewport().width || width - 2;
  const compact = currentWidth < compactWidth;
  const gutter = compact ? 16 : 24;
  const titleInset = gutter + Math.max(0, (currentWidth - panelMaxWidth) / 2);
  const theme = panelTheme[state.tab][state.dark ? "dark" : "light"];
  const notice = headset ? state.headsetNotice : state.mouseNotice?.text;
  const noticeError = headset || !!state.mouseNotice?.error;
  const updateData = state.updates;
  const updateAvailable = hasUpdate(updateData?.view);

  return <Window title="Periféricos" width={width} height={height} minWidth={464} minHeight={504} position="center"
    theme={theme} onCloseRequest={event => { event.preventDefault(); actions.close(); }}>
    <TitleBar height={56} appearance={state.dark ? "dark" : "light"} buttonStyle={{ width: compact ? 32 : 40 }}
      actions={<Row align="center" gap={4}>
        <Button id="open-settings" variant={state.settingsOpen ? "secondary" : "ghost"} size="sm"
          control={{ role: "button", label: "Configurações" }} onClick={actions.showSettings}
          style={{ width: 32, height: 32, radius: 8, padding: 0, shrink: 0 }}>
          <Icon iconNode={glyphs.settings} size={16} color={state.settingsOpen ? accent : muted} />
        </Button>
        {updateAvailable ? <Button id="open-updates" variant="secondary" size="sm"
          control={{ role: "button", label: "Atualização disponível" }} onClick={actions.showUpdates}
          style={{ width: 32, height: 32, radius: 8, padding: 0, shrink: 0 }}>
          <Icon iconNode={glyphs.update} size={16} color={accent} />
        </Button> : null}
        <Navigation tab={state.tab} select={actions.tab} />
      </Row>}
      style={{ background: "var(--card)", padding: { left: titleInset } }}>
      <Row id="panel-brand" gap={8} align="center">
        <Image src={brandIcon} style={{ width: 32, height: 32, shrink: 0 }} />
        {currentWidth >= 500 || !updateAvailable ? <Text size={14} weight={640}>Periféricos</Text> : null}
      </Row>
    </TitleBar>
    {state.visible ? <Scroll id="device-scroll" key={state.tab} flex={1} style={{ scrollbarColor: "var(--scrollbar)" }}>
      <Column id="device-content" padding={gutter} gap={16}
        style={{ width: "100%", maxWidth: panelMaxWidth, alignSelf: "center" }}>
        {!headset && state.mouseModels.length > 1 ? <MousePicker state={state} actions={actions} /> : null}
        <DeviceOverview state={state} compact={compact} />
        {connected ? headset ? <HeadsetControls state={state} actions={actions} compact={compact} />
          : <MouseControls state={state} actions={actions} compact={compact} /> : null}
        {notice ? <Text size={13} color={noticeError ? "var(--destructive-text)" : muted}>{notice}</Text> : null}
      </Column>
    </Scroll> : <View flex={1} />}
    {state.visible && (updateData?.open ? <UpdateDialog data={updateData} actions={actions} />
      : state.settingsOpen ? <SettingsDialog state={state} actions={actions} /> : null)}
  </Window>;
}
