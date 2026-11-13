import { hidInterfaces, type HidInterface } from "../win/hid";
import { queryViper, viperPresence, type MouseSetting, type MouseState } from "./viper";

export class MouseController {
  state: MouseState = { status: "looking" };
  busy = false;
  notice?: { text: string; error: boolean };
  private running = false;
  private foreground = false;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private presence = "";
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
    if (foreground) this.refresh();
    else if (this.running) this.schedule();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.generation++;
    clearTimeout(this.timer);
    await this.pending;
  }

  refresh(): void {
    this.nextRead = 0;
    if (this.running && !this.pending) this.tick();
  }

  apply(kind: MouseSetting["kind"], value: number): void {
    if (!this.foreground || !this.running || this.pending || this.state.status !== "connected") return;
    const entries = this.scan();
    if (entries && this.state.status === "connected") this.read(entries, { kind, value, previous: this.state });
  }

  private publish(state: MouseState): void {
    const changed = JSON.stringify(this.state) !== JSON.stringify(state);
    this.state = state;
    if (changed) this.onChange();
  }

  private scan(): HidInterface[] | undefined {
    try {
      const entries = hidInterfaces();
      const presence = viperPresence(entries);
      if (presence !== this.presence) {
        this.presence = presence;
        this.generation++;
        this.notice = undefined;
        this.nextRead = 0;
        this.quickUntil = performance.now() + 10000;
        this.publish({ status: presence ? "looking" : "disconnected" });
      }
      if (!presence) this.publish({ status: "disconnected" });
      return presence ? entries : undefined;
    } catch {
      this.generation++;
      this.publish({ status: "unavailable" });
      return undefined;
    }
  }

  private tick(): void {
    const entries = this.scan();
    if (entries && !this.pending && performance.now() >= this.nextRead) this.read(entries);
    this.schedule();
  }

  private schedule(): void {
    clearTimeout(this.timer);
    if (this.running) this.timer = setTimeout(() => this.tick(), this.foreground ? 850 : 5000);
  }

  private read(entries: HidInterface[], setting?: MouseSetting): void {
    const generation = this.generation;
    const batteryOnly = !this.foreground;
    this.busy = true;
    if (setting) this.notice = undefined;
    this.onChange();
    this.pending = queryViper(entries, setting, batteryOnly).then(state => {
      if (generation !== this.generation) return;
      this.publish(batteryOnly && state.status === "connected" && state.path === this.state.path
        ? { ...this.state, ...state } : state);
      if (setting && state.status === "connected") {
        const confirmed = setting.kind === "dpi" ? state.dpi?.x === setting.value && state.dpi?.y === setting.value : state.polling === setting.value;
        this.notice = confirmed ? { text: setting.kind === "dpi" ? "DPI confirmado pelo mouse." : "Taxa confirmada pelo mouse.", error: false }
          : { text: "O mouse não confirmou o ajuste. Atualize e tente novamente.", error: true };
      }
    }).catch(error => {
      if (generation !== this.generation) return;
      if (setting) this.notice = { text: error instanceof Error ? error.message : "Não foi possível aplicar o ajuste.", error: true };
      else this.publish({ status: "unavailable" });
    }).finally(() => {
      this.pending = undefined;
      this.busy = false;
      const connected = this.state.status === "connected";
      if (generation === this.generation) {
        const now = performance.now();
        const interval = this.foreground ? (connected ? 15000 : now < this.quickUntil ? 650 : 3500)
          : (connected ? 30000 : 10000);
        this.nextRead = now + interval;
      }
      this.onChange();
      if (this.running && this.foreground && batteryOnly) this.refresh();
    });
  }
}
