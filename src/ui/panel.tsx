import {
  Button, Column, Dialog, Icon, Image, Input, Progress, Row, Scroll, Slider, Spinner, Switch, Text, TitleBar, View,
  Window, viewport, type Style, type SvgNode, type VNode,
} from "@tarve/core";
import type { HeadsetState } from "../devices/headset-controller";
import { validDpi, type MouseState } from "../devices/mouse-state";
import { hs80, mchoseK7, mouseModels, viper, type MouseModelId } from "../devices/catalog";
import { hasUpdate, type UpdateView } from "../app-updates";
import type { TrayDevice } from "../win/battery-icon";
import { sounds, type Preferences } from "../win/preferences";
import { invalidTrayColor, sameTrayAppearance, trayDevices, TraySettings, type TrayDraft, type TrayDrafts } from "./tray-settings";
import { panelTheme } from "./panel-theme";
import brandIcon from "./assets/app-icon.png" with { type: "file" };
import headsetPhoto from "./assets/hs80-max.webp" with { type: "file" };
import mousePhoto from "./assets/viper-v3-pro.webp" with { type: "file" };
import k7Photo from "./assets/mchose-k7-ultra.webp" with { type: "file" };

export type Tab = "home" | "headset" | "mouse";
type DeviceTab = Exclude<Tab, "home">;
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
  trayStyleNotice?: string;
  settingsView: "tray" | "general";
  trayDevice: TrayDevice;
  trayDrafts: TrayDrafts;
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
  settingsView(view: PanelState["settingsView"]): void;
  selectTrayDevice(device: TrayDevice): void;
  editTray(device: TrayDevice, draft: TrayDraft): void;
  applyTray(): void;
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
// Panel spacing uses an 8 px grid with half steps for optical alignment.
const cardInset = 16;
const panelMaxWidth = 1200;
const splitWidth = 760;
const card: Style = { background: "var(--card)", borderWidth: 1, borderColor: border, radius: 12 };
const fixedButton: Style = { shrink: 0, radius: 8 };
const toolbarButton: Style = { ...fixedButton, width: 112, height: 32, padding: { left: 8, right: 8 } };
const applyButton: Style = { ...fixedButton, width: 112, height: 40 };
const settingsRow: Style["padding"] = { left: cardInset, right: cardInset, top: 8, bottom: 8 };
const settingsSwitch: Style = { minHeight: 32, gap: 12 };
const settingsHint: Style = { margin: { left: 48 }, lineHeight: 4 / 3 };
const rowDivider: Style = { borderWidth: { top: 1 }, borderColor: border };
const numbers = { fontFeatureSettings: "'tnum' 1" };
const soundOptions = sounds.map((label, i) => ({ label, value: String(i) }));
const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const glyphs = {
  home: [["rect", { x: 3, y: 4, width: 18, height: 13, rx: 2 }], ["path", { d: "M8 21h8m-4-4v4" }]],
  arrow: [["path", { d: "M4 12h15m-6-6 6 6-6 6" }]],
  headset: [["path", { d: "M3 14v-2a9 9 0 0 1 18 0v2m-18 0h3a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2zm18 0h-3a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h2a2 2 0 0 0 2-2z" }]],
  mouse: [["rect", { x: 6, y: 3, width: 12, height: 18, rx: 6 }], ["path", { d: "M12 7v3" }]],
  battery: [["rect", { x: 2.5, y: 7, width: 17, height: 10, rx: 2 }], ["path", { d: "M22 10v4M6 12h5" }]],
  charging: [["path", { d: "m13 2-8 12h6l-1 8 9-12h-7z" }]],
  mic: [["rect", { x: 9, y: 3, width: 6, height: 12, rx: 3 }], ["path", { d: "M5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-3 0h6" }]],
  micOff: [["path", { d: "M3 3l18 18M9 9v3a3 3 0 0 0 5 2m1-4V6a3 3 0 0 0-5-2M5 11v1a7 7 0 0 0 12 5m2-5v-1M12 19v3m-3 0h6" }]],
  update: [["path", { d: "M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" }]],
  settings: [["path", { d: "M12 3h2l.5 2.2 1.7 1 2.2-.7 2 3.4-1.7 1.5v2.1l1.7 1.5-2 3.4-2.2-.7-1.7 1-.5 2.3h-4l-.5-2.3-1.7-1-2.2.7-2-3.4 1.7-1.5v-2.1L3.6 9l2-3.4 2.2.7 1.7-1L10 3z" }], ["circle", { cx: 12, cy: 11.5, r: 3 }]],
  dpi: [["circle", { cx: 12, cy: 12, r: 7 }], ["path", { d: "M12 2v5m0 10v5M2 12h5m10 0h5" }]],
  polling: [["path", { d: "M2 12h5l3-7 4 14 3-7h5" }]],
} satisfies Record<string, readonly SvgNode[]>;

const tabLabels = { home: "Visão geral", headset: "Headset", mouse: "Mouse" } satisfies Record<Tab, string>;

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

function Connection({ text, connected }: { text: string; connected: boolean }) {
  return <Row align="center" gap={8} style={{ minHeight: 24 }}>
    <View style={{ width: 6, height: 6, radius: 3, background: connected ? "var(--success)" : muted, shrink: 0 }} />
    <Text color={muted} size={13} weight={500} style={{ minWidth: 0 }}>{text}</Text>
  </Row>;
}

function Battery({ level, charging, dark, deviceId }: { level?: number; charging?: boolean; dark: boolean; deviceId?: string }) {
  const low = !charging && level !== undefined && level <= 20;
  const warning = dark ? "#efba80" : "#8a4a17";
  const labelColor = charging ? "var(--success)" : low ? warning : muted;
  const label = charging ? "Carregando" : low && deviceId ? "Bateria baixa" : "Bateria";
  const suffix = deviceId ? `-${deviceId}` : "";
  return <Column gap={8} style={{ width: "100%" }}>
    <Row align="center" justify="between" gap={8} style={{ minHeight: 24 }}>
      <Row align="center" gap={8}>
        <Icon iconNode={charging ? glyphs.charging : glyphs.battery} size={16} color={labelColor} />
        <Text id={`battery-status${suffix}`} size={13} weight={530} color={labelColor}>{label}</Text>
      </Row>
      <Text id={`battery-reading${suffix}`} size={14} weight={620} style={{ ...numbers, shrink: 0 }} color={low ? warning : undefined}>
        {level === undefined ? "Sem leitura" : `${level}%`}
      </Text>
    </Row>
    {level !== undefined ? <Progress id={`battery-track${suffix}`} label={charging ? "Nível de carga" : "Bateria"} value={level} style={{
      height: 4, radius: 2, background: "var(--muted)", foreground: charging ? "var(--success)" : low ? warning : accent,
    }} /> : null}
    {low && !deviceId ? <Text id="battery-low" size={12} color={warning}>Carga baixa</Text> : null}
  </Column>;
}

function DevicePhoto({ tab, model, width, height }: { tab: DeviceTab; model?: MouseModelId; width: number; height: number }) {
  return tab === "mouse" && !model
    ? <Icon iconNode={glyphs.mouse} size={Math.min(56, height / 2)} color={muted} />
    : <Image src={tab === "headset" ? headsetPhoto : model === mchoseK7.id ? k7Photo : mousePhoto}
      fit="contain" width={width} height={height} />;
}

function connectionText(tab: DeviceTab, mouse: MouseState): string {
  if (tab === "headset") return "Conectado via receptor USB";
  return mouse.wireless ? "Conectado sem fio" : "Conectado via USB";
}

function DeviceOverview({ state, tab, split }: { state: PanelState; tab: DeviceTab; split: boolean }) {
  const headset = tab === "headset";
  const device = headset ? state.headset : state.mouse;
  const model = headset ? hs80 : state.mouse.model ? mouseModels[state.mouse.model] : undefined;
  const headsetStatus = state.headset.status;
  const mouseStatus = state.mouse.status;
  const notice = headset
    ? (headsetStatus === "connected" ? undefined : headsetNotices[headsetStatus])
    : (mouseStatus === "connected" ? undefined : mouseNotices[mouseStatus]);
  const Layout = split ? Column : Row;

  return <Layout id="device-overview" align={split ? "stretch" : "center"} gap={16} padding={16}
    style={{ ...card, width: split ? 272 : "100%", shrink: 0, overflow: "hidden" }}>
    <Column id="device-photo" align="center" justify="center" style={{
      width: split ? "100%" : 96, height: split ? 216 : 104, shrink: 0, radius: 8, background: "var(--input)",
    }}>
      <DevicePhoto tab={tab} model={state.mouse.model} width={split ? 216 : 88} height={split ? 192 : 88} />
    </Column>
    <Column id="device-overview-copy" flex={split ? undefined : 1} gap={8} style={{ minWidth: 0 }}>
      {notice ? <>
        <Text id="device-notice" size={21} weight={660} style={{ lineHeight: 1.18 }}>{notice[0]}</Text>
        <Text size={14} color={muted} style={{ lineHeight: 1.4, maxWidth: 420 }}>{notice[1]}</Text>
      </> : <>
        <Text id="device-name" size={split ? 23 : 21} weight={675}
          style={{ lineHeight: 1.18, letterSpacing: -0.45 }}>{model?.label ?? "Mouse"}</Text>
        <Connection connected text={connectionText(tab, state.mouse)} />
        <Column style={rowDivider} padding={{ top: 8 }}>
          <Battery level={device.battery} charging={device.charging} dark={state.dark} />
        </Column>
      </>}
    </Column>
  </Layout>;
}

type GalleryDevice = {
  tab: DeviceTab;
  id: string;
  label: string;
  status: string;
  connected: boolean;
  battery?: number;
  charging?: boolean;
  model?: MouseModelId;
};

function DeviceGallery({ state, actions, availableWidth }: { state: PanelState; actions: PanelActions; availableWidth: number }) {
  const headset = state.headset;
  const mouse = state.mouse;
  const detected = state.mouseModels.length ? state.mouseModels : mouse.model ? [mouse.model] : [];
  const devices: GalleryDevice[] = [{
    tab: "headset", id: hs80.id, label: hs80.label, connected: headset.status === "connected",
    status: headset.status === "connected" ? connectionText("headset", mouse) : headsetNotices[headset.status][0],
    battery: headset.battery, charging: headset.charging,
  }, ...detected.map((id): GalleryDevice => ({
    tab: "mouse", id, model: id, label: mouseModels[id].label,
    connected: mouse.model === id && mouse.status === "connected",
    status: mouse.model !== id ? "Receptor ou cabo detectado"
      : mouse.status === "connected" ? connectionText("mouse", mouse) : mouseNotices[mouse.status][0],
    battery: mouse.model === id ? mouse.battery : undefined,
    charging: mouse.model === id ? mouse.charging : undefined,
  }))];
  if (!detected.length) devices.push({
    tab: "mouse", id: "mouse", label: "Mouse", connected: false,
    status: mouse.status === "connected" ? connectionText("mouse", mouse) : mouseNotices[mouse.status][0],
  });

  const columns = availableWidth >= 840 ? Math.min(devices.length, 3) : availableWidth >= 560 ? 2 : 1;
  const width = Math.floor((availableWidth - (columns - 1) * 16) / columns);
  const stacked = columns === 1;
  const photoWidth = stacked ? 104 : Math.min(width - 32, devices.length === 2 ? 312 : 248);
  const photoHeight = stacked ? 104 : devices.length === 2 ? 248 : 208;
  const Grid = stacked ? Column : Row;
  const TileLayout = stacked ? Row : Column;

  return <Column gap={16}>
    <Text id="gallery-title" size={32} weight={680} style={{ letterSpacing: -0.85, lineHeight: 1.2 }}>Dispositivos</Text>
    <Grid id="device-gallery" gap={16} style={stacked ? undefined : { wrap: true }}>
      {devices.map(device => <Button key={device.id} id={`open-${device.id}`} variant="outline"
        control={{ role: "button", label: `Abrir ${device.label}`,
          description: (device.connected && device.battery !== undefined)
            ? `${device.status}. ${device.charging ? "Carregando" : "Bateria"}: ${device.battery}%.` : device.status }}
        style={{ ...card, width, height: stacked ? 152 : photoHeight + 144, padding: 0, shrink: 0, overflow: "hidden",
          hover: { borderColor: accent, background: "var(--card)" }, active: { background: "var(--muted)" } }}
        onClick={() => {
          if (device.model && device.model !== mouse.model) actions.selectMouse(device.model);
          actions.tab(device.tab);
        }}>
        <TileLayout gap={16} align={stacked ? "center" : "stretch"} padding={16} style={{ width: "100%", height: "100%" }}>
          <Column id={`photo-${device.id}`} align="center" justify="center" style={{
            height: photoHeight, width: stacked ? 112 : "100%", shrink: 0, radius: 8, background: "var(--input)",
          }}>
            <DevicePhoto tab={device.tab} model={device.model} width={photoWidth} height={photoHeight - 12} />
          </Column>
          <Column flex={1} justify="between" gap={8} style={{ minWidth: 0 }}>
            <Column gap={4} style={{ width: "100%" }}>
              <Row align="center" justify="between" gap={8}>
                <Text size={stacked ? 18 : 21} weight={670} style={{ minWidth: 0, lineHeight: 1.2, letterSpacing: -0.35 }}>{device.label}</Text>
                <Icon iconNode={glyphs.arrow} size={16} color={muted} />
              </Row>
              <Connection text={device.status} connected={device.connected} />
            </Column>
            {device.connected ? <Battery level={device.battery} charging={device.charging} dark={state.dark} deviceId={device.id} /> : null}
          </Column>
        </TileLayout>
      </Button>)}
    </Grid>
  </Column>;
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

function SoundChoice({ id, label, value, choose, preview }: {
  id: string; label: string; value: number; choose: (value: number) => void; preview: () => void;
}) {
  return <Row id={`${id}-row`} gap={8} align="center" style={{ minWidth: 0, minHeight: 40 }}>
    <label htmlFor={id} style={{ width: 84, shrink: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 530, color: muted }}>{label}</span>
    </label>
    <select id={id} value={String(value)} onValueChange={value => choose(Number(value))} style={{ flex: 1, minWidth: 0 }}>
      {soundOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <Button id={`${id}-preview`} variant="outline" disabled={!value}
      style={{ ...fixedButton, width: 80, height: 38, padding: 0 }}
      control={{ role: "button", label: `Ouvir aviso ${label.toLowerCase()}` }} onClick={preview}>
      <Row align="center" gap={8}><Icon name="play" size={16} /><Text>Ouvir</Text></Row>
    </Button>
  </Row>;
}

function HeadsetControls({ state, actions }: { state: PanelState; actions: PanelActions }) {
  const device = state.headset;
  const { preferences } = state;
  const micMuted = device.hardwareMuted || device.windowsMuted;
  const micStatus = device.hardwareMuted ? "Silenciado pela haste" : device.windowsMuted ? "Silenciado no Windows" : "Microfone ativo";
  const micHelp = device.hardwareMuted ? "Abaixe a haste para falar."
    : device.windowsMuted ? "Você pode reativar a entrada aqui." : "Levante a haste para silenciar.";

  return <Column id="headset-settings" style={card}>
    <Row id="microphone-status" align="center" justify="between" gap={8} padding={16} style={{ wrap: true }}>
      <Row gap={8} align="start" flex={1} style={{ minWidth: 184 }}>
        <Icon iconNode={micMuted ? glyphs.micOff : glyphs.mic} size={16} color={micMuted ? muted : accent} />
        <Column gap={4} style={{ minWidth: 0 }}>
          <Text id="mic-reading" size={16} weight={640}>{micStatus}</Text>
          <Text size={13} color={muted}>{micHelp}</Text>
        </Column>
      </Row>
      {!device.hardwareMuted && device.windowsMuted ? <Button id="unmute" variant="outline" size="sm" style={toolbarButton}
        control={{ role: "button", label: "Reativar microfone no Windows" }} onClick={actions.unmute}>
        Reativar
      </Button> : null}
    </Row>
    <Column padding={16} gap={4} style={rowDivider}>
      <Switch id="leds" label="Manter LEDs apagados" checked={preferences.lightsOff} onCheckedChange={actions.lightsOff}
        style={settingsSwitch} />
      <Text size={13} color={muted} style={settingsHint}>Logotipos e luz na ponta do microfone.</Text>
    </Column>
    <Column id="microphone-sounds" gap={8} padding={16} style={rowDivider}>
      <Text size={16} weight={640}>Sons do microfone</Text>
      <SoundChoice id="sound-active" label="Ao ativar" value={preferences.onUnmute}
        choose={value => actions.sound("onUnmute", value)} preview={() => actions.preview(preferences.onUnmute)} />
      <SoundChoice id="sound-muted" label="Ao silenciar" value={preferences.onMute}
        choose={value => actions.sound("onMute", value)} preview={() => actions.preview(preferences.onMute)} />
    </Column>
  </Column>;
}

function Sensitivity({ state, actions }: { state: PanelState; actions: PanelActions }) {
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
      <Column gap={8}>
        <Column style={{ minWidth: 0 }}>
          <Slider id="dpi-slider" label="Sensibilidade em DPI" value={valid ? nextDpi : dpi.x}
            min={range.min} max={range.max} step={range.step} disabled={mouseBusy}
            onValueChange={value => actions.editDpi(String(value))}
            style={{
              width: "100%", height: 40, radius: 8,
              trackThickness: 4, trackRadius: 2, trackInset: 8, trackBackground: "var(--muted)",
              thumbSize: 18, thumbColor: accent, thumbBorderWidth: 0,
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
      </Column>
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

  return <Column id="mouse-settings" style={card}>
      <Sensitivity state={state} actions={actions} />
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
    </Column>;
}

function Navigation({ tab, select, compact }: { tab: Tab; select: (tab: Tab) => void; compact: boolean }) {
  return <Row id="device-tabs" gap={4} style={{ margin: { right: 8 } }}>
    {(["home", "headset", "mouse"] as const).map(next => {
      const selected = next === tab;
      const label = tabLabels[next];
      return <Button key={next} id={`tab-${next}`} variant="ghost" size="sm"
        control={{ role: "tab", selected, label }}
        onClick={() => select(next)} style={{ width: compact ? 72 : next === "home" ? 112 : 92, height: 48, radius: 0, padding: 0,
          borderWidth: { bottom: 2 }, borderColor: selected ? accent : "transparent" }}>
        <Row align="center" gap={8}>
          {!compact ? <Icon iconNode={glyphs[next]} size={16} color={selected ? accent : muted} /> : null}
          <Text size={compact ? 12 : 13} weight={selected ? 650 : 550} color={selected ? undefined : muted}>{label}</Text>
        </Row>
      </Button>;
    })}
  </Row>;
}

function DeviceDetail({ state, actions, tab, split, controlsCompact }: {
  state: PanelState; actions: PanelActions; tab: DeviceTab; split: boolean; controlsCompact: boolean;
}) {
  const headset = tab === "headset";
  const connected = (headset ? state.headset : state.mouse).status === "connected";
  const notice = headset ? state.headsetNotice : state.mouseNotice?.text;
  const noticeError = headset || !!state.mouseNotice?.error;
  const Layout = split && connected ? Row : Column;
  return <Column gap={16}>
    <Row justify="between" align="center" gap={8} style={{ wrap: true }}>
      <Text id="detail-title" size={28} weight={670} style={{ letterSpacing: -0.6 }}>{tabLabels[tab]}</Text>
      {!headset && state.mouseModels.length > 1 ? <MousePicker state={state} actions={actions} /> : null}
    </Row>
    <Layout id="device-workspace" align={split && connected ? "start" : "stretch"} gap={16}>
      <DeviceOverview state={state} tab={tab} split={split && connected} />
      {connected ? <Column id="device-controls" flex={split ? 1 : undefined} gap={8} style={{ minWidth: 0 }}>
        {headset ? <HeadsetControls state={state} actions={actions} />
          : <MouseControls state={state} actions={actions} compact={controlsCompact} />}
        {notice ? <Text size={13} color={noticeError ? "var(--destructive-text)" : muted}>{notice}</Text> : null}
      </Column> : null}
    </Layout>
  </Column>;
}

function SettingsDialog({ state, actions }: { state: PanelState; actions: PanelActions }) {
  const changes = trayDevices.some(({ id }) => {
    const draft = state.trayDrafts[id];
    return draft && (!sameTrayAppearance(draft, state.preferences.tray[id]) || invalidTrayColor(draft));
  });
  const invalid = Object.values(state.trayDrafts).some(invalidTrayColor);
  const inTray = state.settingsView === "tray";
  const device = state.trayDevice;
  return <Dialog id="app-settings" open title="Configurações" width={428} showClose={false}
    closeOnOverlay={false} onOpenChange={actions.closeSettings} style={{ radius: 16, padding: 20, gap: 12 }}
    footer={<>
      <Button id="close-settings" variant="outline" onClick={actions.closeSettings} style={{ ...fixedButton, height: 40 }}>
        {changes ? "Cancelar" : "Fechar"}
      </Button>
      {inTray || changes ? <Button id="apply-tray-settings" disabled={!changes || invalid} onClick={actions.applyTray}
        style={{ ...fixedButton, height: 40 }}>Aplicar</Button> : null}
    </>}>
    <Row gap={8} style={{ borderWidth: { bottom: 1 }, borderColor: border }}>
      {([{ id: "tray", label: "Bandeja" }, { id: "general", label: "Geral" }] as const).map(({ id, label }) => {
        const selected = state.settingsView === id;
        return <Button key={id} id={`settings-${id}`} variant="ghost" size="sm"
          control={{ role: "tab", selected, label }} onClick={() => actions.settingsView(id)}
          style={{ width: 96, height: 32, radius: 0, padding: 0, borderWidth: { bottom: 2 },
            borderColor: selected ? accent : "transparent" }}>
          <Text size={13} weight={selected ? 650 : 500} color={selected ? undefined : muted}>{label}</Text>
        </Button>;
      })}
    </Row>
    {inTray ? <TraySettings key={device} device={device} draft={state.trayDrafts[device] ?? state.preferences.tray[device]}
      dark={state.dark} selectDevice={actions.selectTrayDevice} edit={draft => actions.editTray(device, draft)} /> :
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
      </Column>}
    {state.trayStyleNotice ? <Text size={12} color="var(--destructive-text)">{state.trayStyleNotice}</Text> : null}
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

export function Panel({ state, actions, width = 944, height = 584 }: {
  state: PanelState; actions: PanelActions; width?: number; height?: number;
}) {
  const currentWidth = viewport().width || width - 2;
  const compact = currentWidth < 600;
  const split = currentWidth >= splitWidth;
  const gutter = compact ? 16 : 24;
  const contentWidth = Math.min(currentWidth, panelMaxWidth);
  const titleInset = gutter + Math.max(0, (currentWidth - panelMaxWidth) / 2);
  const theme = panelTheme[state.dark ? "dark" : "light"];
  const updateData = state.updates;
  const updateAvailable = hasUpdate(updateData?.view);

  return <Window title="Periféricos" width={width} height={height} minWidth={464} minHeight={504} position="center"
    theme={theme} onCloseRequest={event => { event.preventDefault(); actions.close(); }}>
    <TitleBar height={48} appearance={state.dark ? "dark" : "light"} buttonStyle={{ width: compact ? 32 : 40 }}
      actions={<Row align="center" gap={4}>
        <Navigation tab={state.tab} select={actions.tab} compact={compact} />
        {updateAvailable ? <Button id="open-updates" variant="secondary" size="sm"
          control={{ role: "button", label: "Atualização disponível" }} onClick={actions.showUpdates}
          style={{ width: 32, height: 32, radius: 6, padding: 0, shrink: 0 }}>
          <Icon iconNode={glyphs.update} size={16} color={accent} />
        </Button> : null}
        <Button id="open-settings" variant={state.settingsOpen ? "secondary" : "ghost"} size="sm"
          control={{ role: "button", label: "Configurações" }} onClick={actions.showSettings}
          style={{ width: 32, height: 32, radius: 6, padding: 0, shrink: 0, margin: { right: 8 } }}>
          <Icon iconNode={glyphs.settings} size={16} color={state.settingsOpen ? accent : muted} />
        </Button>
      </Row>}
      style={{ background: "var(--card)", ...rowDivider, borderWidth: { bottom: 1 }, padding: { left: titleInset } }}>
      <Row id="panel-brand" gap={8} align="center">
        <Image src={brandIcon} style={{ width: 24, height: 24, shrink: 0 }} />
        {!compact ? <Text size={14} weight={650}>Periféricos</Text> : null}
      </Row>
    </TitleBar>
    {state.visible ? <Scroll id="device-scroll" key={state.tab} flex={1} style={{ scrollbarColor: "var(--scrollbar)" }}>
      <Column id="device-content" padding={gutter}
        style={{ width: "100%", maxWidth: panelMaxWidth, alignSelf: "center" }}>
        {state.tab === "home" ? <DeviceGallery state={state} actions={actions} availableWidth={contentWidth - 2 * gutter} />
          : <DeviceDetail state={state} actions={actions} tab={state.tab} split={split}
            controlsCompact={split ? contentWidth < 900 : compact} />}
      </Column>
    </Scroll> : <View flex={1} />}
    {state.visible && (updateData?.open ? <UpdateDialog data={updateData} actions={actions} />
      : state.settingsOpen ? <SettingsDialog state={state} actions={actions} /> : null)}
  </Window>;
}
