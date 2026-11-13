import { delay } from "../win/ffi";
import { FeatureHid, hidInterfaces, matchingHid, type HidInterface } from "../win/hid";
import { viper } from "./catalog";
import { pollingChoices, pollingCode, pollingHz, validDpi, viperBattery, viperDpi, viperReport, viperStatus, VIPER_PACKET_SIZE, type ViperCommand } from "./protocol";

export type MouseStatus = "looking" | "disconnected" | "waiting" | "duplicate" | "unavailable" | "connected";
export interface MouseState {
  status: MouseStatus;
  path?: string;
  wireless?: boolean;
  battery?: number;
  charging?: boolean;
  dpi?: { x: number; y: number };
  polling?: number;
  rates?: readonly number[];
}
export type MouseSetting = { kind: "dpi" | "polling"; value: number; previous: MouseState };

const BATTERY: ViperCommand = { group: 7, id: 0x80, size: 2 };
const DPI: ViperCommand = { group: 4, id: 0x85, size: 7 };

async function exchange(mouse: FeatureHid, command: ViperCommand, args?: readonly number[], attempts = command.id & 0x80 ? 2 : 1): Promise<Uint8Array | undefined> {
  const report = viperReport(command, args);
  for (let i = 0; i < attempts; i++) {
    if (!mouse.set(report)) continue;
    await delay(100);
    const reply = new Uint8Array(VIPER_PACKET_SIZE);
    if (!mouse.get(reply)) continue;
    const status = viperStatus(reply, command);
    if (status === 2) return reply;
    if (status === 3 || status === 5) break;
  }
  return undefined;
}

export function viperPresence(entries: HidInterface[]): string {
  return entries.filter(entry => entry.vendor === viper.match.vendor && viper.match.products.some(id => id === entry.product))
    .map(entry => entry.path.toLowerCase()).sort().join("\n");
}

async function write(mouse: FeatureHid, setting: MouseSetting, wireless: boolean): Promise<void> {
  const { kind, value, previous } = setting;
  if (kind === "dpi" && previous.dpi && validDpi(value)) {
    const high = value >> 8, low = value & 255;
    await exchange(mouse, { group: 4, id: 5, size: 7 }, [1, high, low, high, low, 0, 0]);
    return;
  }
  const code = kind === "polling" && previous.polling ? pollingCode(wireless, value) : undefined;
  if (!code) throw new Error("Ajuste inválido para essa conexão.");
  await exchange(mouse, { group: 0, id: wireless ? 0x40 : 5, size: wireless ? 2 : 1 }, wireless ? [0, code] : [code]);
  await delay(180);
}

export async function queryViper(entries = hidInterfaces(), setting?: MouseSetting, batteryOnly = false): Promise<MouseState> {
  const matches = matchingHid(viper.match, entries);
  const wired = matches.filter(entry => entry.product === 0x00c0);
  const preferred = wired.length ? wired : matches;
  if (preferred.length > 1) return { status: "duplicate" };
  const entry = preferred[0];
  if (!entry) return { status: viperPresence(entries) ? "unavailable" : "disconnected" };
  const wireless = entry.product === 0x00c1;
  if (setting && (setting.previous.status !== "connected" || setting.previous.path?.toLowerCase() !== entry.path.toLowerCase())) {
    throw new Error("O mouse mudou. Atualize antes de aplicar.");
  }
  const mouse = new FeatureHid(entry);
  try {
    if (setting) await write(mouse, setting, wireless);
    const batteryReport = await exchange(mouse, BATTERY, undefined, batteryOnly ? 1 : 2);
    const battery = batteryReport && batteryReport[6] >= 2 ? viperBattery(batteryReport[10]) : undefined;
    const noResponse = wireless ? "waiting" : "unavailable";
    if (batteryOnly) return battery === undefined ? { status: noResponse, wireless }
      : { status: "connected", path: entry.path, wireless, battery };
    const dpiReport = await exchange(mouse, DPI, [1]);
    const dpi = dpiReport ? viperDpi(dpiReport) : undefined;
    if (battery === undefined && !dpi) return { status: noResponse, wireless };
    const rateReport = await exchange(mouse, { group: 0, id: wireless ? 0xc0 : 0x85, size: 1 });
    const polling = rateReport && rateReport[6] >= 1 ? pollingHz(wireless, rateReport[wireless ? 10 : 9]) : undefined;
    const charging = wireless ? undefined : await exchange(mouse, { group: 7, id: 0x84, size: 2 });
    return { status: "connected", path: entry.path, wireless, battery, dpi, polling, rates: pollingChoices(wireless),
      charging: charging !== undefined && charging[6] >= 2 && charging[10] === 1 };
  } finally {
    mouse.close();
  }
}
