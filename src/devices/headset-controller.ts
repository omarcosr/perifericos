import { CoreAudio, type CaptureEndpoint } from "../win/audio";
import { acquireHeadsetLease, isProcessRunning } from "../win/kernel";
import type { Preferences } from "../win/preferences";
import { playSound } from "../win/sound";
import { HeadsetLink } from "./hs80";
import { headsetBattery } from "./protocol";

export type HeadsetStatus = "looking" | "disconnected" | "connected" | "icue" | "legacy" | "audio-error";
export interface HeadsetState {
  status: HeadsetStatus;
  battery?: number;
  hardwareMuted?: boolean;
  windowsMuted?: boolean;
}

export class HeadsetController {
  state: HeadsetState = { status: "looking" };
  diagnostic?: string;
  private readonly audio = new CoreAudio();
  private capture?: CaptureEndpoint;
  private link?: HeadsetLink;
  private releaseLease?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private running = false;
  private icue = false;
  private icueDue = 0;
  private batteryDue = 0;
  private modeDue = 0;
  private lightDue = 0;
  private windowsDue = 0;
  private lights?: boolean;
  private unmuteRequested = false;

  constructor(private readonly preferences: Preferences, private readonly onChange: () => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule(0);
  }

  unmute(): void {
    if (this.state.status === "connected" && this.state.hardwareMuted === false) this.unmuteRequested = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    clearTimeout(this.timer);
    try { await this.pending; }
    finally {
      try { await this.disconnect(!this.icue); }
      finally { this.audio.close(); }
    }
  }

  private publish(state: HeadsetState): void {
    const old = this.state;
    this.state = state;
    if (state.status !== old.status || state.battery !== old.battery || state.hardwareMuted !== old.hardwareMuted ||
        state.windowsMuted !== old.windowsMuted) this.onChange();
  }

  private schedule(ms: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.pending = this.tick().finally(() => { this.pending = undefined; });
    }, ms);
  }

  private async disconnect(restore: boolean): Promise<void> {
    this.unmuteRequested = false;
    if (this.link) {
      if (restore) {
        try { await this.link.restoreLights(); } catch { /* A removed receiver cannot respond. */ }
      }
      this.link.close();
      this.link = undefined;
    }
    try { this.capture?.close(); }
    finally {
      this.capture = undefined;
      this.releaseLease?.();
      this.releaseLease = undefined;
    }
  }

  private async tick(): Promise<void> {
    let interval = 250;
    try {
      const now = performance.now();
      if (now >= this.icueDue) {
        this.icue = isProcessRunning("iCUE.exe");
        this.icueDue = now + 3000;
      }
      if (this.icue) {
        await this.disconnect(false);
        this.publish({ status: "icue" });
        interval = 3000;
        return;
      }
      this.releaseLease ??= acquireHeadsetLease();
      if (!this.releaseLease) {
        this.publish({ status: "legacy" });
        interval = 2000;
        return;
      }
      if (!this.link) {
        this.link = await HeadsetLink.connect();
        if (!this.link) {
          await this.disconnect(false);
          this.publish({ status: "disconnected" });
          interval = 2000;
          return;
        }
        try { this.capture = this.audio.capture(name => /corsair/i.test(name) && /hs80 max/i.test(name)); }
        catch (error) { this.diagnostic = String(error); }
        if (!this.capture) {
          await this.disconnect(false);
          this.publish({ status: "audio-error" });
          interval = 3000;
          return;
        }
        this.batteryDue = this.modeDue = this.lightDue = this.windowsDue = 0;
        this.lights = undefined;
      }
      await this.update(this.link, this.capture!, now);
      this.diagnostic = undefined;
    } catch (error) {
      this.diagnostic = String(error);
      await this.disconnect(!this.icue);
      this.publish({ status: "disconnected" });
      interval = 2000;
    } finally {
      this.schedule(interval);
    }
  }

  private async update(link: HeadsetLink, input: CaptureEndpoint, now: number): Promise<void> {
    const old = this.state;
    const raw = await link.get(0xa6);
    if (raw > 1) throw new Error("O estado físico do microfone está fora da faixa.");
    const hardwareMuted = raw === 1;
    const changed = hardwareMuted !== old.hardwareMuted;
    const unmute = this.unmuteRequested && !hardwareMuted;
    this.unmuteRequested = false;
    if (changed || unmute) input.setMuted(hardwareMuted);

    const lightsOff = this.preferences.lightsOff;
    let refreshLights = lightsOff !== this.lights || changed;
    if (lightsOff && now >= this.modeDue) {
      if (await link.get(3) !== 2) refreshLights = true;
      this.modeDue = now + 1000;
    }
    if (lightsOff && (refreshLights || now >= this.lightDue)) {
      await link.darken();
      this.lightDue = performance.now() + 3000;
    } else if (!lightsOff && lightsOff !== this.lights) {
      await link.restoreLights();
    }
    this.lights = lightsOff;

    let windowsMuted = old.windowsMuted;
    if (changed || unmute || now >= this.windowsDue) {
      windowsMuted = input.isMuted();
      this.windowsDue = now + 1000;
    }
    let battery = old.battery;
    if (now >= this.batteryDue) {
      battery = undefined;
      try {
        for (let i = 0; i < 3 && battery === undefined; i++) battery = headsetBattery(await link.get(0x0f));
      } catch { /* The mic and LEDs can continue while telemetry is unavailable. */ }
      this.batteryDue = performance.now() + 15000;
    }
    this.publish({ status: "connected", hardwareMuted, windowsMuted, battery });
    const muted = hardwareMuted || windowsMuted;
    if (old.status === "connected" && muted !== (old.hardwareMuted || old.windowsMuted)) {
      try { playSound(muted ? this.preferences.onMute : this.preferences.onUnmute); }
      catch { /* A playback error does not invalidate the headset connection. */ }
    }
  }
}
