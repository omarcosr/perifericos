import { createApp, requestSingleInstance, type AppHandle, type TrayHandle, type TrayMenuItem } from "@tarve/core";
import { spawn } from "node:child_process";
import { AppUpdates, hasUpdate } from "./app-updates";
import { hs80, mouseModels } from "./devices/catalog";
import { HeadsetController } from "./devices/headset-controller";
import { MouseController } from "./devices/mouse-controller";
import { Panel, type PanelActions, type PanelState, type Tab } from "./ui/panel";
import { batteryTooltip, headsetTrayImage } from "./win/battery-icon";
import { createMouseBatteryIcon, systemTrayIconSize } from "./win/battery-tray";
import { PreferenceStore, sounds, systemDark, type Preferences } from "./win/preferences";
import { invalidTrayColor, sameTrayAppearance, trayDevices } from "./ui/tray-settings";
import { playSound, stopSound } from "./win/sound";
import { migrateStartup, packaged, removeStartup, setStartup, startupEnabled } from "./win/startup";
import { delay } from "./win/ffi";

const APP_ID = "Perifericos.Tarve";
const updateCheckInterval = 6 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const installerAction = process.argv.find(arg => arg === "--migrate-startup" || arg === "--enable-startup" || arg === "--remove-startup");
  if (installerAction && packaged()) {
    if (installerAction === "--migrate-startup") migrateStartup();
    else if (installerAction === "--enable-startup") setStartup(true);
    else removeStartup(process.argv.find(arg => arg.startsWith("--startup-target="))?.slice("--startup-target=".length));
    return;
  }
  let instance = await requestSingleInstance({ id: APP_ID });
  if (process.argv.includes("--stop") && process.argv.includes("--wait")) {
    for (let attempt = 0; !instance.primary && attempt < 50; attempt++) {
      await delay(100);
      instance = await requestSingleInstance({ id: APP_ID });
    }
    if (!instance.primary) throw new Error("O Periféricos ainda está em execução.");
  }
  if (!instance.primary) return;
  const args = instance.launch.args;
  if (args.includes("--stop") || args.includes("--hide")) { instance.release(); return; }

  let app: AppHandle | undefined;
  let tray: TrayHandle | undefined;
  let mouseIcon: ReturnType<typeof createMouseBatteryIcon>;
  let trayAvailable = false;
  let updateTimer: ReturnType<typeof setInterval> | undefined;
  let exit: Promise<void> | undefined;
  let dpiEdited = false;
  let rateEdited = false;
  const store = new PreferenceStore();
  let importError: string | undefined;
  try { store.importFirstRun(process.env.PERIFERICOS_IMPORT_INI); }
  catch { importError = "Não foi possível importar as preferências do HS80."; }
  const preferences = store.load();
  const packagedApp = packaged();
  const state: PanelState = {
    visible: !args.includes("--run"), dark: systemDark(),
    tab: args.includes("--mouse") ? "mouse" : args.includes("--headset") ? "headset" : "home",
    preferences, startup: false, startupPending: false, startupAvailable: packagedApp, settingsOpen: false,
    settingsView: "tray", trayDevice: "headset", trayDrafts: {},
    headset: { status: "looking" }, mouse: { status: "looking" }, mouseModels: [], mouseBusy: false,
    headsetNotice: importError, dpi: "", rate: "",
  };
  let trayDark = systemDark("tray");
  const headsetIcon = () => {
    const { style, color, numberSize } = preferences.tray.headset;
    return headsetTrayImage(state.headset.battery, style, systemTrayIconSize(), trayDark, color, numberSize);
  };
  const draw = () => { if (state.visible && !exit) app?.update(); };
  const updates = new AppUpdates(view => {
    if (!state.updates) return;
    const updateWasAvailable = hasUpdate(state.updates.view);
    state.updates.view = view;
    if (updateWasAvailable !== hasUpdate(view)) tray?.update({ menu: trayMenu() });
    draw();
  });
  if (packagedApp) {
    const metadata = JSON.parse(process.env.TARVE_APP_METADATA ?? "{}") as { version?: string };
    const previousInstall = args.find(arg => arg.startsWith("--updated="))?.slice("--updated=".length);
    state.updates = {
      open: args.includes("--updates"), version: metadata.version ?? "",
      view: !previousInstall ? updates.view : previousInstall === metadata.version ? { status: "installed" }
        : { status: "error", message: "A nova versão não iniciou. O Periféricos manteve a versão anterior." },
    };
  }
  const headset = new HeadsetController(preferences, () => {
    const previous = state.headset;
    state.headset = headset.state;
    const { battery, charging } = state.headset;
    if (!exit && (previous.battery !== battery || previous.charging !== charging)) {
      const tooltip = batteryTooltip(hs80.label, battery, charging);
      tray?.update(previous.battery === battery ? { tooltip } : { icon: headsetIcon(), tooltip });
    }
    draw();
  });
  const mouse = new MouseController(() => {
    const current = mouse.state;
    if (current.status !== "connected" || current.path !== state.mouse.path || current.profile !== state.mouse.profile) {
      dpiEdited = rateEdited = false;
    } else if (current.dpiStage !== state.mouse.dpiStage) {
      dpiEdited = false;
    }
    if (!mouse.busy && !mouse.notice?.error) {
      if (current.dpi?.x === Number(state.dpi) && current.dpi?.y === Number(state.dpi)) dpiEdited = false;
      if (current.polling === Number(state.rate)) rateEdited = false;
    }
    if (!dpiEdited) state.dpi = current.dpi ? String(current.dpi.x) : "";
    if (!rateEdited) state.rate = current.polling ? String(current.polling) : "";
    state.mouse = current;
    state.mouseModels = mouse.models;
    state.mouseBusy = mouse.busy;
    state.mouseNotice = mouse.notice;
    if (!exit) mouseIcon?.update(current.model ? mouseModels[current.model].label : undefined, current.battery, current.charging);
    draw();
  });

  function setTab(next: Tab): void {
    state.tab = next;
    mouse.setForeground(state.visible && next === "mouse");
    draw();
  }

  function show(next = state.tab): void {
    if (exit) return;
    state.visible = true;
    state.dark = systemDark();
    setTab(next);
    app?.flush();
    app?.show();
    app?.activate();
  }

  function openUpdates(force = false): void {
    if (!state.updates || state.updates.open || exit) return;
    const available = hasUpdate(state.updates.view);
    if (!available && !force) return;
    state.settingsOpen = false;
    state.trayDrafts = {};
    state.trayStyleNotice = undefined;
    state.updates.open = true;
    if (!available) void updates.checkRemote();
    draw();
  }

  function trayMenu(): TrayMenuItem[] {
    const menu: TrayMenuItem[] = [
      { id: "show", label: "Abrir painel", onSelect: () => show() },
      { id: "mouse", label: "Abrir aba Mouse", onSelect: () => show("mouse") },
      { id: "settings", label: "Configurações", onSelect: () => { actions.showSettings(); show(); } },
    ];
    if (hasUpdate(state.updates?.view)) {
      menu.push({ id: "updates", label: "Atualização disponível", onSelect: () => { openUpdates(); show(); } });
    }
    menu.push({ id: "quit", label: "Encerrar controle", onSelect: () => { void quit(); } });
    return menu;
  }

  function hide(): void {
    state.visible = false;
    mouse.setForeground(false);
    app?.update();
    app?.flush();
    app?.hide();
  }

  function shutdown(): Promise<void> {
    return exit ??= (async () => {
      if (updateTimer) clearInterval(updateTimer);
      updates.stop();
      await Promise.allSettled([headset.stop(), mouse.stop()]);
      stopSound();
      mouseIcon?.remove();
      tray?.remove();
      instance.release();
    })();
  }

  async function quit(): Promise<void> {
    await shutdown();
    app?.close();
  }

  function save<K extends "lightsOff" | "onUnmute" | "onMute">(key: K, value: Preferences[K]): void {
    try {
      store.save(key, value);
      preferences[key] = value;
      state.headsetNotice = undefined;
    } catch { state.headsetNotice = "Não foi possível salvar a preferência."; }
    draw();
  }

  const actions: PanelActions = {
    tab: setTab,
    close() { if (trayAvailable) hide(); else void quit(); },
    lightsOff: enabled => save("lightsOff", enabled),
    showSettings() {
      if (state.updates?.open) return;
      if (!state.settingsOpen) {
        state.settingsView = "tray";
        state.trayDevice = state.tab === "mouse" ? "mouse" : "headset";
      }
      state.settingsOpen = true;
      draw();
    },
    settingsView(view) { state.settingsView = view; draw(); },
    selectTrayDevice(device) { state.trayDevice = device; draw(); },
    editTray(device, draft) {
      state.trayDrafts[device] = draft;
      state.trayStyleNotice = undefined;
      draw();
    },
    applyTray() {
      if (Object.values(state.trayDrafts).some(invalidTrayColor)) return;
      state.trayStyleNotice = undefined;
      for (const { id } of trayDevices) {
        const draft = state.trayDrafts[id];
        if (!draft) continue;
        const { style, color, numberSize } = draft;
        const appearance = { style, color, numberSize };
        if (!sameTrayAppearance(appearance, preferences.tray[id])) {
          try { store.saveTray(id, appearance); }
          catch {
            state.trayStyleNotice = "Não foi possível salvar todas as alterações. Tente novamente.";
            break;
          }
          preferences.tray[id] = appearance;
          if (id === "headset") tray?.update({ icon: headsetIcon() });
          else mouseIcon?.setAppearance(appearance);
        }
        delete state.trayDrafts[id];
      }
      draw();
    },
    closeSettings() {
      state.settingsOpen = false;
      state.trayDrafts = {};
      state.trayStyleNotice = undefined;
      draw();
    },
    async startup(enabled) {
      if (state.startupPending) return;
      state.startupPending = true;
      state.startupNotice = undefined;
      draw();
      try { await delay(0); setStartup(enabled); state.startup = startupEnabled(); }
      catch (error) { state.startupNotice = error instanceof Error ? error.message : "Não foi possível alterar a inicialização."; }
      finally { state.startupPending = false; draw(); }
    },
    sound(key, value) { if (Number.isInteger(value) && value >= 0 && value < sounds.length) save(key, value); },
    preview(value) {
      try { state.headsetNotice = playSound(value) ? undefined : "Não foi possível tocar a prévia."; }
      catch { state.headsetNotice = "Não foi possível tocar a prévia."; }
      draw();
    },
    unmute: () => headset.unmute(),
    selectMouse: model => mouse.select(model),
    editDpi(value) { if (/^\d{0,5}$/.test(value)) { state.dpi = value; dpiEdited = true; draw(); } },
    selectRate(value) { state.rate = value; rateEdited = true; draw(); },
    applyMouse: (kind, value) => mouse.apply(kind, value),
    showUpdates: () => openUpdates(),
    closeUpdates() {
      if (!state.updates) return;
      state.updates.open = false;
      draw();
    },
    checkUpdates: () => updates.checkRemote(),
    async installUpdate() {
      const version = await updates.install();
      if (!version) return;
      const tabArgs = state.tab === "home" ? [] : [`--${state.tab}`];
      const next = state.visible ? ["--updates", `--updated=${version}`, ...tabArgs] : ["--run"];
      await quit();
      const restarted = spawn(process.execPath, next, { detached: true, stdio: "ignore", windowsHide: true });
      restarted.once("error", error => console.error("Reinício após atualização:", error));
      restarted.unref();
    },
  };

  try {
    app = createApp(() => <Panel state={state} actions={actions} />, {
      headless: !state.visible,
      lowPower: true,
      renderer: "cpu",
      memoryTrimDelay: false,
    });
    instance.onSecondInstance(launch => {
      if (launch.args.includes("--stop")) void quit();
      else if (launch.args.includes("--hide")) hide();
      else if (!launch.args.includes("--run")) {
        if (launch.args.includes("--updates")) openUpdates(true);
        show(launch.args.includes("--mouse") ? "mouse" : launch.args.includes("--headset") ? "headset" : state.tab);
      }
    });
    tray = app.tray({
      icon: headsetIcon(),
      tooltip: batteryTooltip(hs80.label), onClick: () => show(),
      onAvailability({ available }) {
        trayAvailable = available;
      },
      menu: trayMenu(),
    });
    await app.ready;
    if (!state.visible) app.hide();
    if (!exit) {
      mouseIcon = createMouseBatteryIcon(preferences.tray.mouse, dark => {
        if (exit || trayDark === dark) return;
        trayDark = dark;
        tray?.update({ icon: headsetIcon() });
      });
      headset.start();
      mouse.setForeground(state.visible && state.tab === "mouse");
      mouse.start();
      if (state.updates) {
        if (!state.updates.open || state.updates.view.status === "idle") void updates.checkRemote(!state.updates.open);
        updateTimer = setInterval(() => {
          if (!state.updates?.open) void updates.checkRemote(true);
        }, updateCheckInterval);
      }
      setTimeout(() => {
        if (exit) return;
        try { state.startup = startupEnabled(); draw(); } catch { /* The user can retry from the panel. */ }
      }, 100);
    }
    await app.closed;
  } finally { await shutdown(); }
}

await main();
