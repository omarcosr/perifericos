import { hidInterfaces, type HidInterface } from "../win/hid";
import { mchoseK7, viper, type MouseModelId } from "./catalog";
import { queryK7 } from "./mchose";
import type { MouseSetting, MouseState } from "./mouse-state";
import { queryViper } from "./viper";

const drivers = [
  { model: viper, query: queryViper },
  { model: mchoseK7, query: queryK7 },
];
type Target = { driver: typeof drivers[number]; entries: HidInterface[] };

export class MouseController {
  state: MouseState = { status: "looking" };
  models: readonly MouseModelId[] = [];
  busy = false;
  notice?: { text: string; error: boolean };
  private running = false;
  private foreground = false;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private presence = "";
  private selected?: MouseModelId;
  private generation = 0;
  private nextRead = 0;
  private quickUntil = 0;

  constructor(private readonly onChange: () => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  setForeground(foreground: boolean): void {
    if (this.foreground === foreground) return;
    this.foreground = foreground;
    if (foreground) this.refreshReading();
    else if (this.running) this.schedule();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.generation++;
    clearTimeout(this.timer);
    await this.pending;
  }

  private refreshReading(): void {
    this.nextRead = 0;
    if (this.running && !this.pending) this.tick();
  }

  select(model: MouseModelId): void {
    if (this.selected === model || !this.models.includes(model)) return;
    this.selected = model;
    if (this.running) this.tick();
  }

  async apply(kind: MouseSetting["kind"], value: number): Promise<void> {
    if (!this.foreground || !this.running || this.busy || this.state.status !== "connected") return;
    const previous = this.state;
    const generation = this.generation;
    this.busy = true;
    this.notice = undefined;
    this.onChange();
    await this.pending;
    if (!this.running) return;
    const target = this.scan();
    const current = this.state;
    if (target && generation === this.generation && current.status === "connected" && current.path === previous.path &&
        current.profile === previous.profile && (kind === "polling" || current.dpiStage === previous.dpiStage)) {
      this.read(target, { kind, value, previous });
    } else {
      this.busy = false;
      this.notice = { text: "O mouse ou o perfil mudou. Confira os valores antes de aplicar.", error: true };
      this.onChange();
      this.refreshReading();
    }
  }

  private publish(state: MouseState): void {
    const changed = JSON.stringify(this.state) !== JSON.stringify(state);
    this.state = state;
    if (changed) this.onChange();
  }

  private scan(): Target | undefined {
    try {
      const entries = hidInterfaces();
      const targets = drivers.map(driver => {
        const { vendor, products } = driver.model.match;
        return { driver, entries: entries.filter(entry =>
          entry.vendor === vendor && products.some(product => product === entry.product)) };
      }).filter(target => target.entries.length);
      const models = targets.map(target => target.driver.model.id);
      const modelsChanged = models.length !== this.models.length || models.some((model, index) => model !== this.models[index]);
      if (modelsChanged) this.models = models;
      const target = targets.find(candidate => candidate.driver.model.id === this.selected) ?? targets[0];
      const model = target?.driver.model.id;
      if (model) this.selected = model;
      const presence = target ? target.entries.map(entry => entry.path.toLowerCase()).sort().join("\n") : "";
      if (presence !== this.presence) {
        this.presence = presence;
        this.generation++;
        this.notice = undefined;
        this.nextRead = 0;
        this.quickUntil = performance.now() + 10000;
        this.publish({ status: target ? "looking" : "disconnected", model });
      } else if (!target) {
        this.publish({ status: "disconnected" });
      } else if (modelsChanged) {
        this.onChange();
      }
      return target;
    } catch {
      this.presence = "";
      this.models = [];
      this.generation++;
      this.publish({ status: "unavailable" });
      return undefined;
    }
  }

  private tick(): void {
    const target = this.scan();
    if (target && !this.pending && !this.busy && performance.now() >= this.nextRead) this.read(target);
    this.schedule();
  }

  private schedule(): void {
    clearTimeout(this.timer);
    if (this.running) this.timer = setTimeout(() => this.tick(), this.foreground ? 850 : 5000);
  }

  private read(target: Target, setting?: MouseSetting): void {
    const generation = this.generation;
    const batteryOnly = !this.foreground && !setting;
    const model = target.driver.model.id;
    this.pending = target.driver.query(target.entries, setting, batteryOnly).then(result => {
      if (generation !== this.generation) return;
      const state = { ...result, model };
      if (this.state.status === "connected" && state.status === "waiting") this.quickUntil = performance.now() + 5000;
      this.publish(batteryOnly && state.status === "connected" && state.path === this.state.path
        ? { ...this.state, ...state } : state);
      if (setting) {
        const sameProfile = state.profile === setting.previous.profile;
        const confirmed = state.status === "connected" && sameProfile && (setting.kind === "dpi"
          ? state.dpiStage === setting.previous.dpiStage && state.dpi?.x === setting.value && state.dpi?.y === setting.value
          : state.polling === setting.value);
        this.notice = confirmed ? { text: setting.kind === "dpi" ? "DPI confirmado pelo mouse." : "Taxa confirmada pelo mouse.", error: false }
          : { text: "O mouse não confirmou o ajuste. Aguarde a próxima leitura e tente de novo.", error: true };
      }
    }).catch(error => {
      if (generation !== this.generation) return;
      if (setting) this.notice = { text: error instanceof Error ? error.message : "Não foi possível aplicar o ajuste.", error: true };
      else this.publish({ status: "unavailable", model });
    }).finally(() => {
      this.pending = undefined;
      if (setting) this.busy = false;
      const connected = this.state.status === "connected";
      if (generation === this.generation) {
        const now = performance.now();
        const interval = this.foreground ? (connected ? 5000 : now < this.quickUntil ? 650 : 3500)
          : (connected ? 30000 : 10000);
        this.nextRead = now + interval;
      }
      if (setting) this.onChange();
      if (this.running && (generation !== this.generation || (this.foreground && batteryOnly))) this.refreshReading();
    });
  }
}
