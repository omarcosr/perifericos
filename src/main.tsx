import { createApp, requestSingleInstance, type AppHandle, type TrayHandle } from "@tarve/core";
import { hs80, viper } from "./devices/catalog";
import { HeadsetController } from "./devices/headset-controller";
import { MouseController } from "./devices/mouse-controller";
import { Panel, type PanelActions, type PanelState, type Tab } from "./ui/panel";
import { batteryTooltip, headsetTrayImage } from "./win/battery-icon";
import { createMouseBatteryIcon } from "./win/battery-tray";
import { PreferenceStore, sounds, systemDark, type Preferences } from "./win/preferences";
import { playSound, stopSound } from "./win/sound";
import { packaged, setStartup, startupEnabled } from "./win/startup";
import { delay } from "./win/ffi";

const APP_ID = "Perifericos.Tarve";

async function main(): Promise<void> {
  const instance = await requestSingleInstance({ id: APP_ID });
  if (!instance.primary) return;
  const args = instance.launch.args;
  if (args.includes("--stop") || args.includes("--hide")) { instance.release(); return; }

  let app: AppHandle | undefined;
  let tray: TrayHandle | undefined;
  let mouseIcon: ReturnType<typeof createMouseBatteryIcon>;
  let trayAvailable = false;
  let exit: Promise<void> | undefined;
  let dpiEdited = false;
  let rateEdited = false;
  const store = new PreferenceStore();
  let importError: string | undefined;
  try { store.importFirstRun(process.env.PERIFERICOS_IMPORT_INI); }
  catch { importError = "Não foi possível importar as preferências do HS80."; }
  const preferences = store.load();
  const state: PanelState = {
    visible: !args.includes("--run"), dark: systemDark(), tab: args.includes("--mouse") ? "mouse" : "headset",
    preferences, startup: false, startupPending: false, startupAvailable: packaged(),
    headset: { status: "looking" }, mouse: { status: "looking" }, mouseBusy: false,
    headsetNotice: importError, dpi: "", rate: "",
  };
  const draw = () => { if (state.visible && !exit) app?.update(); };
  const headset = new HeadsetController(preferences, () => {
    const previous = state.headset.battery;
    state.headset = headset.state;
    if (!exit && previous !== state.headset.battery) {
      const level = state.headset.battery;
      tray?.update({ icon: headsetTrayImage(level), tooltip: batteryTooltip(hs80.label, level) });
    }
    draw();
  });
  const mouse = new MouseController(() => {
    const current = mouse.state;
    if (current.status !== "connected" || current.path !== state.mouse.path) dpiEdited = rateEdited = false;
    if (!mouse.busy && !mouse.notice?.error) {
      if (current.dpi?.x === Number(state.dpi) && current.dpi?.y === Number(state.dpi)) dpiEdited = false;
      if (current.polling === Number(state.rate)) rateEdited = false;
    }
    if (!dpiEdited) state.dpi = current.dpi ? String(current.dpi.x) : "";
    if (!rateEdited) state.rate = current.polling ? String(current.polling) : "";
    state.mouse = current;
    state.mouseBusy = mouse.busy;
    state.mouseNotice = mouse.notice;
    if (!exit) mouseIcon?.update(current.battery);
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

  function hide(): void {
    state.visible = false;
    mouse.setForeground(false);
    app?.update();
    app?.flush();
    app?.hide();
  }

  function shutdown(): Promise<void> {
    return exit ??= (async () => {
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

  function save<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
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
    async startup(enabled) {
      if (state.startupPending) return;
      state.startupPending = true;
      state.headsetNotice = undefined;
      draw();
      try { await delay(0); setStartup(enabled); state.startup = startupEnabled(); }
      catch (error) { state.headsetNotice = error instanceof Error ? error.message : "Não foi possível alterar a inicialização."; }
      finally { state.startupPending = false; draw(); }
    },
    sound(key, value) { if (Number.isInteger(value) && value >= 0 && value < sounds.length) save(key, value); },
    preview(value) {
      try { state.headsetNotice = playSound(value) ? undefined : "Não foi possível tocar a prévia."; }
      catch { state.headsetNotice = "Não foi possível tocar a prévia."; }
      draw();
    },
    unmute: () => headset.unmute(),
    refreshMouse: () => mouse.refresh(),
    editDpi(value) { if (/^\d{0,5}$/.test(value)) { state.dpi = value; dpiEdited = true; draw(); } },
    selectRate(value) { state.rate = value; rateEdited = true; draw(); },
    applyMouse: (kind, value) => mouse.apply(kind, value),
  };

  try {
    app = createApp(() => <Panel state={state} actions={actions} />, {
      appIdentity: { id: APP_ID, name: "Periféricos Tarve" },
      headless: !state.visible,
      lowPower: true,
      renderer: "cpu",
      memoryTrimDelay: false,
    });
    instance.onSecondInstance(launch => {
      if (launch.args.includes("--stop")) void quit();
      else if (launch.args.includes("--hide")) hide();
      else if (!launch.args.includes("--run")) show(launch.args.includes("--mouse") ? "mouse" : state.tab);
    });
    tray = app.tray({
      icon: headsetTrayImage(), tooltip: batteryTooltip(hs80.label), onClick: () => show(),
      onAvailability({ available }) {
        trayAvailable = available;
      },
      menu: [
        { id: "show", label: "Abrir painel", onSelect: () => show() },
        { id: "mouse", label: "Abrir aba Mouse", onSelect: () => show("mouse") },
        { id: "quit", label: "Encerrar controle", onSelect: () => { void quit(); } },
      ],
    });
    await app.ready;
    if (!state.visible) app.hide();
    if (!exit) {
      mouseIcon = createMouseBatteryIcon(viper.label);
      headset.start();
      mouse.setForeground(state.visible && state.tab === "mouse");
      mouse.start();
      setTimeout(() => {
        if (exit) return;
        try { state.startup = startupEnabled(); draw(); } catch { /* The user can retry from the panel. */ }
      }, 100);
    }
    await app.closed;
  } finally { await shutdown(); }
}

await main();
