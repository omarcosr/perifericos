import { delay } from "../win/ffi";
import { matchingHid, ReportHid } from "../win/hid";
import { hs80 } from "./catalog";
import { HEADSET_PACKET_SIZE, headsetPacket, headsetReply } from "./protocol";

export class HeadsetLink {
  private lastWrite = -Infinity;

  private constructor(private readonly hid: ReportHid) {}

  static async connect(): Promise<HeadsetLink | undefined> {
    const entries = matchingHid(hs80.match);
    if (!entries.length) return undefined;
    if (entries.length !== 1) throw new Error("Há mais de um receptor HS80 MAX conectado.");
    const device = new HeadsetLink(new ReportHid(entries[0]));
    try {
      const receiver = await device.get(0x12, 0);
      const headset = await device.get(0x12);
      if (receiver !== 0x0a97 || headset !== 0x0a96) throw new Error("Identificação do HS80 MAX inválida.");
      return device;
    } catch (error) {
      device.close();
      throw error;
    }
  }

  private async send(packet: Uint8Array, child = 1): Promise<number> {
    const wait = 50 - (performance.now() - this.lastWrite);
    if (wait > 0) await delay(wait);
    await this.hid.transfer(packet, true);
    this.lastWrite = performance.now();
    const reply = new Uint8Array(HEADSET_PACKET_SIZE);
    for (let i = 0; i < 6; i++) {
      const length = await this.hid.transfer(reply, false);
      const value = headsetReply(reply, length, child, packet[2]);
      if (value !== undefined) return value;
    }
    throw new Error("Resposta do HS80 MAX inválida.");
  }

  get(property: number, child = 1): Promise<number> {
    return this.send(headsetPacket(child, 2, property), child);
  }

  private set(property: number, value: number): Promise<number> {
    const packet = headsetPacket(1, 1, property);
    packet[5] = value & 255;
    packet[6] = value >> 8;
    return this.send(packet);
  }

  async restoreLights(): Promise<void> { await this.set(3, 1); }

  async darken(): Promise<void> {
    await this.set(3, 2);
    const open = headsetPacket(1, 0x0d);
    open[4] = 0x22;
    await this.send(open);
    const close = headsetPacket(1, 5);
    try {
      const black = headsetPacket(1, 6);
      black[4] = 8;
      black[8] = 0x12;
      await this.send(black);
    } finally {
      await this.send(close);
    }
    await this.set(2, 0);
  }

  close(): void { this.hid.close(); }
}
