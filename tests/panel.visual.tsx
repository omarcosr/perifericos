import { strict as assert } from "node:assert";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createTestRenderer } from "@tarve/core";
import type { NodeSnapshot, Snapshot } from "@tarve/core/protocol";
import { mchoseK7, viper } from "../src/devices/catalog";
import { K7_RATES } from "../src/devices/mchose-protocol";
import { Panel, type PanelActions, type PanelState } from "../src/ui/panel";

const [scenario = "headset", scheme = "dark", size = "normal", output] = process.argv.slice(2);
const sizes: Record<string, readonly [number, number]> = {
  normal: [672, 704], compact: [464, 504], below: [577, 656], above: [578, 656], wide: [1088, 760],
};
const dimensions = sizes[size];
assert(dimensions, `Tamanho de janela desconhecido: ${size}`);
assert(scheme === "dark" || scheme === "light", `Tema desconhecido: ${scheme}`);
const [width, height] = dimensions;
const headset = scenario.startsWith("headset");
const state: PanelState = {
  visible: true, dark: scheme === "dark", tab: headset ? "headset" : "mouse",
  headset: { status: "connected", battery: 37, hardwareMuted: false, windowsMuted: false },
  mouse: { status: "connected", model: viper.id, wireless: true, battery: 95, dpi: { x: 1300, y: 1300 }, polling: 1000,
    rates: [125, 500, 1000, 2000, 4000, 8000] },
  mouseModels: [viper.id],
  mouseBusy: false, startup: false, startupPending: false, startupAvailable: true, settingsOpen: false,
  preferences: { lightsOff: true, onUnmute: 1, onMute: 2 }, dpi: "1300", rate: "1000",
  updates: { open: false, version: "0.5.0", view: { status: "idle" } },
};
const viperState = state.mouse;
const k7State: PanelState["mouse"] = { status: "connected", model: mchoseK7.id, wireless: true, battery: 18, charging: true,
  dpi: { x: 1600, y: 1600 }, polling: 2000, rates: K7_RATES, dpiStage: 2, profile: 0 };
switch (scenario) {
  case "headset-off": state.headset = { status: "disconnected" }; break;
  case "headset-muted":
    state.headset = { ...state.headset, battery: 8, windowsMuted: true };
    state.startupPending = true;
    break;
  case "headset-no-battery": delete state.headset.battery; state.headset.hardwareMuted = true; break;
  case "headset-charging": state.headset = { ...state.headset, battery: 17, charging: true }; break;
  case "headset-charge-no-battery": state.headset = { ...state.headset, battery: undefined, charging: true }; break;
  case "mouse-off": state.mouse = { status: "disconnected" }; state.mouseModels = []; break;
  case "mouse-waiting": state.mouse = { status: "waiting", model: viper.id }; break;
  case "mouse-busy": state.mouseBusy = true; break;
  case "mouse-no-dpi": delete state.mouse.dpi; state.dpi = ""; break;
  case "mouse-usb":
    state.mouse = { ...state.mouse, wireless: false, charging: true, battery: 100, dpi: { x: 35000, y: 24500 }, rates: [125, 500, 1000] };
    state.dpi = "35000";
    break;
  case "mouse-k7":
    state.mouse = k7State;
    state.mouseModels = [mchoseK7.id];
    state.dpi = "1600";
    state.rate = "2000";
    break;
  case "mouse-picker": state.mouseModels = [viper.id, mchoseK7.id]; break;
  case "updates": break;
  case "headset": case "mouse": break;
  default: throw new Error(`Cenário desconhecido: ${scenario}`);
}

const events: string[] = [];
function showAvailableUpdate(): void {
  state.updates!.view = { status: "available", update: { kind: "pack", version: "0.5.1", currentVersion: "0.5.0",
    size: 241318, sha256: "0".repeat(64), url: "https://example.com/perifericos.tarve", pubDate: "2026-11-14T00:00Z", platform: "win32-x64" } };
  render.app.update();
}
const actions: PanelActions = {
  tab(next) { state.tab = next; render.app.update(); },
  close() { events.push("close"); },
  lightsOff(value) { state.preferences.lightsOff = value; render.app.update(); },
  startup(value) { state.startup = value; render.app.update(); },
  showSettings() { state.settingsOpen = true; render.app.update(); },
  closeSettings() { state.settingsOpen = false; render.app.update(); },
  sound(key, value) { state.preferences[key] = value; render.app.update(); },
  preview(value) { events.push(`preview:${value}`); },
  unmute() { events.push("unmute"); },
  selectMouse(value) {
    state.mouse = value === mchoseK7.id ? k7State : viperState;
    state.dpi = String(state.mouse.dpi?.x ?? "");
    state.rate = String(state.mouse.polling ?? "");
    events.push(`mouse:${value}`);
    render.app.update();
  },
  editDpi(value) { state.dpi = value; render.app.update(); },
  selectRate(value) { state.rate = value; render.app.update(); },
  applyMouse(kind, value) { events.push(`${kind}:${value}`); },
  showUpdates() {
    state.updates!.open = true;
    events.push("open-updates");
    render.app.update();
  },
  closeUpdates() { state.updates!.open = false; render.app.update(); },
  checkUpdates() { events.push("check-update"); showAvailableUpdate(); },
  installUpdate() {
    events.push("install-update");
    state.updates!.view = { status: "downloading", percent: 42 };
    render.app.update();
  },
};
const folder = output ? resolve(output) : await mkdtemp(resolve(tmpdir(), "perifericos-visual-"));
if (output) await mkdir(folder, { recursive: true });
const name = `${scenario}-${size}-${scheme}`;
const errors: string[] = [];
const render = await createTestRenderer(() => <Panel state={state} actions={actions} width={width} height={height} />, {
  headless: true, renderer: "cpu", onError: event => { errors.push(event.error.message); },
});

function box(snapshot: Snapshot, id: string): NodeSnapshot {
  const node = snapshot.nodes.find(item => item.id === id);
  assert(node, `Controle ausente: ${id}`);
  return node;
}

function aligned(first: number, second: number, detail: string): void {
  // Tarve rounds the final coordinates to device pixels.
  assert(Math.abs(first - second) <= 1, `${detail}: ${first} / ${second}`);
}

function verifyLayout(snapshot: Snapshot, layout = size): void {
  const find = (id: string) => box(snapshot, id);
  const right = (node: NodeSnapshot) => node.x + node.width;
  const middle = (node: NodeSnapshot) => node.y + node.height / 2;
  assert(!snapshot.nodes.some(node => node.id === "refresh-mouse"));
  if (state.updates?.open) {
    const dialog = find("app-updates-content");
    const scroll = find("device-scroll");
    aligned(dialog.x + dialog.width / 2, snapshot.width / 2, "Centro horizontal do popup");
    aligned(middle(dialog), snapshot.height / 2, "Centro vertical do popup");
    assert(dialog.x >= 16 && right(dialog) <= snapshot.width - 16);
    assert(snapshot.nodes.some(node => node.text === "Versão instalada 0.5.0"));
    assert.equal(scroll.scrollMaxX ?? 0, 0);
    find("device-overview");
    return;
  }
  const overview = find("device-overview");
  const scroll = find("device-scroll");
  const title = find("device-name");
  const photo = find("device-photo");
  const leftTab = find("tab-headset");
  const rightTab = find("tab-mouse");
  const compact = scroll.width < 576;
  aligned(find("panel-brand").x, overview.x, "Recuo da barra de título");
  aligned(title.x, overview.x + 17, "Recuo do cabeçalho");
  aligned(title.y, overview.y + (compact ? 17 : 25), "Altura do título do dispositivo");
  aligned(photo.width, compact ? 128 : 192, "Largura da foto");
  aligned(leftTab.width, rightTab.width, "Largura das abas");
  aligned(middle(leftTab), middle(rightTab), "Centro das abas");
  assert.equal(scroll.scrollMaxX ?? 0, 0, "O painel deve ter apenas rolagem vertical");
  if (layout === "normal" || layout === "wide") assert.equal(scroll.scrollMax, 0);
  if (layout === "below") assert(compact);
  if (layout === "above") assert(!compact);

  const tab = state.tab;
  const device = tab === "headset" ? state.headset : state.mouse;
  if (device.status !== "connected") {
    assert(snapshot.nodes.some(node => node.id === "device-notice"));
    assert(!snapshot.nodes.some(node => ["battery-reading", "headset-settings", "mouse-settings"].includes(node.id)));
    return;
  }
  const status = find("device-status-row");
  const battery = find("battery-reading");
  if (device.charging) assert.equal(find("battery-status").text, "Carregando");
  aligned(middle(find("device-connection")), middle(status), "Centro da faixa de conexão");
  aligned(right(battery), right(status), "Coluna da bateria");
  if (device.battery !== undefined) {
    const track = find("battery-track");
    aligned(track.x, title.x, "Início da barra de bateria");
    aligned(right(track), right(battery), "Fim da barra de bateria");
  }
  if (tab === "headset") {
    aligned(find("leds").x, title.x, "Coluna dos controles do headset");
    assert(!snapshot.nodes.some(node => node.id === "startup"), "A inicialização pertence ao popup");
    for (const id of ["sound-active", "sound-muted"]) {
      const field = find(`${id}-trigger`);
      const button = find(`${id}-preview`);
      aligned(field.y, button.y, `Borda do seletor ${id}`);
      aligned(field.height, button.height, `Altura do seletor ${id}`);
      aligned(button.x - right(field), 8, `Espaço após o seletor ${id}`);
    }
    aligned(find("sound-active-trigger").width, find("sound-muted-trigger").width, "Largura dos seletores de som");
    if (compact) aligned(find("sound-active-preview").x, find("sound-muted-preview").x, "Coluna dos botões Ouvir");
    else aligned(find("sound-active-preview").y, find("sound-muted-preview").y, "Linha dos botões Ouvir");
    return;
  }
  const polling = find("polling");
  const applyRate = find("apply-rate");
  aligned(polling.height, applyRate.height, "Altura do seletor de polling");
  if (state.mouse.dpi) {
    const slider = find("dpi-slider");
    const dpi = find("dpi");
    const applyDpi = find("apply-dpi");
    assert.equal(slider.control?.role, "slider");
    assert.equal(slider.control?.value, Number(state.dpi));
    aligned(slider.x, polling.x, "Coluna dos controles do mouse");
    aligned(dpi.y, applyDpi.y, "Linha do campo DPI");
    aligned(dpi.height, applyDpi.height, "Altura do campo DPI");
    aligned(applyDpi.x, applyRate.x, "Coluna dos botões Aplicar");
    aligned(applyDpi.width, applyRate.width, "Largura dos botões Aplicar");
    if (compact) {
      aligned(slider.width, polling.width, "Largura dos controles no compacto");
      assert(dpi.y > slider.y + slider.height, "O campo deve ficar abaixo do slider no compacto");
    } else {
      aligned(slider.y, dpi.y, "Linha do slider e do campo DPI");
      assert(right(slider) <= dpi.x - 8, "O slider precisa de espaço antes do campo DPI");
    }
  } else {
    assert(!snapshot.nodes.some(node => ["dpi-slider", "dpi", "apply-dpi"].includes(node.id)));
  }
  if (compact) aligned(applyRate.y - (polling.y + polling.height), 8, "Espaço após as frequências no compacto");
  else aligned(polling.y, applyRate.y, "Linha das frequências");
  const rateBoxes = state.mouse.rates!.map(rate => find(`polling-item-${rate}`));
  for (const [index, rate] of rateBoxes.entries()) {
    aligned(rate.width, rateBoxes[0].width, "Largura das frequências");
    if (index > 0) aligned(rate.x - right(rateBoxes[index - 1]), 4, "Espaço entre frequências");
  }
}

const locate = (id: string) => render.getById(id);
const wait = (predicate: () => boolean) => render.waitFor(predicate, { timeout: 2000 });
async function verifyDpiSlider(): Promise<void> {
  const slider = locate("dpi-slider");
  const field = locate("dpi");
  const initial = state.dpi;
  const bounds = await slider.node();
  await slider.dragTo({ x: bounds.x + bounds.width * 0.75, y: bounds.y + bounds.height / 2 });
  await wait(() => Number(state.dpi) > 20000);
  assert(!events.some(event => event.startsWith("dpi:")), "Arrastar deve apenas editar o DPI");
  assert.equal((await locate("current-dpi").node()).text, "1.300 DPI");
  await render.waitFor(snapshot => box(snapshot, "dpi").text === state.dpi);
  await render.capture(resolve(folder, `${name}-dpi-editado.png`));

  await slider.press("Home");
  await wait(() => state.dpi === "100");
  await slider.press("ArrowRight");
  await wait(() => state.dpi === "150");
  await slider.press("End");
  await wait(() => state.dpi === "35000");
  await slider.press("ArrowRight");
  assert.equal((await slider.node()).control?.value, 35000);

  await field.fill("35001");
  await wait(() => state.dpi === "35001");
  await locate("dpi-error").waitFor();
  await field.press("Enter");
  assert(!events.some(event => event.startsWith("dpi:")), "DPI fora da faixa deve ser rejeitado");
  await field.press("SelectAll");
  render.app.debug({ type: "input", action: "text", text: "1837" });
  await render.waitFor(snapshot => box(snapshot, "dpi-slider").control?.value === 1837 && box(snapshot, "dpi").text === "1837");
  await field.press("Enter");
  await wait(() => events.includes("dpi:1837"));
  await slider.press("ArrowLeft");
  await wait(() => Number(state.dpi) < 1837);
  await locate("apply-dpi").click();
  await wait(() => events.includes(`dpi:${state.dpi}`));
  actions.editDpi(initial);
}

async function verifyControls(): Promise<void> {
  await locate("leds").click();
  await wait(() => !state.preferences.lightsOff);
  await locate("sound-active-preview").click();
  await wait(() => events.includes("preview:1"));
  await locate("sound-active-trigger").click();
  await locate("sound-active-option-3").waitFor();
  verifyPopup(await render.inspect(), "sound-active");
  await render.capture(resolve(folder, `${name}-sons.png`));
  await locate("sound-active-option-3").click();
  await wait(() => state.preferences.onUnmute === 3);
  await locate("tab-mouse").click();
  await wait(() => state.tab === "mouse");
  await verifyDpiSlider();
  await locate("polling-item-4000").click();
  await wait(() => state.rate === "4000");
  await locate("apply-rate").click();
  await wait(() => events.includes("polling:4000"));
  await locate("tab-headset").press("Space");
  await wait(() => state.tab === "headset");
}

async function verifySettings(): Promise<void> {
  await locate("open-settings").press("Space");
  await locate("app-settings-content").waitFor();
  const snapshot = await render.inspect();
  const dialog = box(snapshot, "app-settings-content");
  aligned(dialog.x + dialog.width / 2, snapshot.width / 2, "Centro do popup de configurações");
  await render.capture(resolve(folder, `${name}-configuracoes.png`));
  await locate("startup").click();
  await wait(() => state.startup);
  await locate("close-settings").press("Escape");
  await wait(() => !state.settingsOpen);
  assert(!(await render.inspect()).nodes.some(node => node.id === "startup"));
}

async function verifyUpdates(): Promise<void> {
  const absent = async () => assert(!(await render.inspect()).nodes.some(node => node.id === "open-updates"));
  await absent();
  for (const status of ["checking", "current", "unpublished"] as const) {
    state.updates!.view = { status };
    render.app.update();
    await render.waitForIdle();
    await absent();
  }
  showAvailableUpdate();
  await locate("open-updates").waitFor();
  await render.capture(resolve(folder, `${name}-botao.png`));
  await locate("open-updates").press("Space");
  await locate("app-updates-content").waitFor();
  assert.equal((await locate("update-status").node()).text, "Versão 0.5.1 disponível");
  assert.deepEqual(events, ["open-updates"]);
  const available = state.updates!.view;
  assert(available.status === "available");
  state.updates!.view = { status: "error", message: "Falha ao baixar a atualização.", update: available.update };
  render.app.update();
  await locate("check-update").waitFor();
  verifyLayout(await render.inspect());
  await locate("check-update").click();
  await locate("install-update").waitFor();
  assert.equal((await locate("update-status").node()).text, "Versão 0.5.1 disponível");
  verifyLayout(await render.inspect());
  await render.capture(resolve(folder, `${name}-disponivel.png`));
  await locate("close-updates").press("Escape");
  await wait(() => !state.updates!.open);
  await locate("open-updates").click();
  await locate("app-updates-content").waitFor();
  showAvailableUpdate();
  await locate("install-update").waitFor();
  await locate("install-update").click();
  await locate("update-progress").waitFor();
  assert(events.includes("install-update"));
  assert(!(await render.inspect()).nodes.some(node => node.id === "close-updates"));
  await render.capture(resolve(folder, `${name}-progresso.png`));
  state.updates!.view = { status: "installed" };
  render.app.update();
  await locate("close-updates").click();
  await wait(() => !state.updates!.open);
  await absent();
  verifyLayout(await render.inspect());
}

async function verifyMousePicker(): Promise<void> {
  await locate("mouse-model-trigger").click();
  const option = locate(`mouse-model-option-${mchoseK7.id}`);
  await option.waitFor();
  await option.click();
  await wait(() => state.mouse.model === mchoseK7.id);
  await render.waitFor(snapshot => box(snapshot, "device-name").text === mchoseK7.label &&
    box(snapshot, "current-dpi").text === "1.600 DPI" && box(snapshot, "battery-status").text === "Carregando");
  const snapshot = await render.inspect();
  verifyLayout(snapshot);
  await render.capture(resolve(folder, `${name}-k7.png`));
  await locate("dpi-slider").press("End");
  await wait(() => state.dpi === "42000");
  await locate("apply-dpi").click();
  await wait(() => events.includes("dpi:42000"));
  if (box(snapshot, "device-scroll").scrollMax > 0) {
    render.app.scrollTo("device-scroll", { y: "end" });
    await render.waitFor(current => {
      const scroll = box(current, "device-scroll");
      return (scroll.scrollY ?? scroll.scroll) >= scroll.scrollMax - 1;
    }, { timeout: 2000 });
  }
  await locate("polling-item-8000").click();
  await wait(() => state.rate === "8000");
  await locate("apply-rate").click();
  await wait(() => events.includes("polling:8000"));
}

function verifyPopup(snapshot: Snapshot, id: string): void {
  const popup = box(snapshot, `${id}-popup`);
  const trigger = box(snapshot, `${id}-trigger`);
  const scroll = box(snapshot, "device-scroll");
  aligned(popup.x, trigger.x, "Coluna do menu de som");
  assert(popup.y >= scroll.y && popup.y + popup.height <= snapshot.height, "Menu de som fora da área visível");
}

async function verifyResize(): Promise<void> {
  for (const layout of ["compact", "normal"]) {
    const [nextWidth, nextHeight] = sizes[layout];
    render.app.debug({ type: "resize", width: nextWidth, height: nextHeight });
    await render.waitFor(current => {
      const photo = box(current, "device-photo");
      return Math.abs(current.width - nextWidth) <= 1 && photo.width === (nextWidth < 576 ? 128 : 192);
    }, { timeout: 3000 });
    verifyLayout(await render.inspect(), layout);
  }
}

try {
  const snapshot = await render.waitForIdle({ timeout: 4000 });
  verifyLayout(snapshot);
  await render.capture(resolve(folder, `${name}.png`));
  await Bun.write(resolve(folder, `${name}.json`), JSON.stringify(snapshot, null, 2));
  if (scenario === "headset" && size === "normal") {
    await verifyControls();
    await verifyResize();
  }
  if (scenario === "mouse" && size === "normal") await verifyDpiSlider();
  if (scenario === "mouse-picker") await verifyMousePicker();
  if (scenario === "updates") await verifyUpdates();
  if (scenario === "headset" || scenario === "mouse-off") await verifySettings();
  if (size === "compact" && box(snapshot, "device-scroll").scrollMax > 0) {
    render.app.scrollTo("device-scroll", { y: "end" });
    await render.waitFor(current => {
      const scroll = box(current, "device-scroll");
      return (scroll.scrollY ?? scroll.scroll) >= scroll.scrollMax - 1;
    }, { timeout: 2000 });
    await render.capture(resolve(folder, `${name}-rolagem.png`));
    if (headset) {
      await locate("sound-muted-trigger").click();
      await locate("sound-muted-option-4").waitFor();
      verifyPopup(await render.inspect(), "sound-muted");
      await render.capture(resolve(folder, `${name}-sons.png`));
    }
  }
  assert.deepEqual(errors, []);
  console.log(`${name} (${snapshot.width}×${snapshot.height}, ${snapshot.scale}x) → ${folder}`);
} finally {
  render.close();
  await render.app.closed;
}
