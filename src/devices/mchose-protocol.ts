import { mchoseK7 } from "./catalog";
import { validDpi } from "./mouse-state";

// Layout measured on a K7 Ultra (3837:4150, firmware 5.28.5.0).
// https://github.com/aipno/mchose-linux/blob/main/docs/PROTOCOL.md
export const MCHOSE_SHORT = 0x11, MCHOSE_LONG = 0x12;
export const MCHOSE_IDENTITY = 0x06, MCHOSE_CONFIG = 0x67, MCHOSE_DPI = 0x40;
export const K7_RATES = [125, 500, 1000, 2000, 4000, 8000] as const;

type ReportId = typeof MCHOSE_SHORT | typeof MCHOSE_LONG;
const featureLength = mchoseK7.match.feature;
const lengthOf = (id: ReportId) => id === MCHOSE_SHORT ? 21 : featureLength;

export function mchoseReport(id: ReportId, command: number, payload = new Uint8Array()): Uint8Array {
  const length = lengthOf(id);
  if (payload.length > length - 2) throw new Error("Relatório MCHOSE fora do tamanho.");
  const bytes = new Uint8Array(featureLength);
  bytes[0] = id;
  bytes[1] = command ^ 0xff;
  // Windows expects the collection's maximum buffer size, including the report ID.
  // The unused bytes of the shorter report are inverted only within its own length.
  bytes.fill(0xff, 2, length);
  for (let i = 0; i < payload.length; i++) bytes[i + 2] = payload[i] ^ 0xff;
  return bytes;
}

export function mchoseReply(bytes: Uint8Array, id: ReportId, command: number): Uint8Array | undefined {
  const length = lengthOf(id);
  if (bytes.length < length || bytes[0] !== id || bytes[1] !== (command ^ 0xff)) return undefined;
  const payload = bytes.slice(2, length).map(byte => byte ^ 0xff);
  return payload.some(byte => byte !== 0) ? payload : undefined;
}

export function k7Identity(payload: Uint8Array, wireless: boolean) {
  if (payload.length < 11) return undefined;
  const data = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  if (data.getUint16(0, true) !== mchoseK7.match.vendor || data.getUint16(2, true) !== mchoseK7.body) return undefined;
  const flags = payload[8];
  const mode = flags & 7;
  if (mode !== (wireless ? 1 : 0)) return undefined;
  return {
    connected: !wireless || Boolean(flags & 8),
    battery: payload[9] <= 100 ? payload[9] : undefined,
    charging: payload[10] <= 1 ? payload[10] === 1 : undefined,
  };
}

export function k7Config(payload: Uint8Array) {
  if (payload.length !== 63 || payload[0] > 2 || payload[16] < 1 || payload[16] > 6) return undefined;
  const stage = payload[1] & 15;
  if (stage >= payload[16]) return undefined;
  const data = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const x = data.getUint16(4 + stage * 2, true);
  const y = data.getUint16(51 + stage * 2, true);
  if (!validDpi(x, mchoseK7.dpi) || !validDpi(y, mchoseK7.dpi)) return undefined;
  // The K7's live rate follows byte 2, even when byte 1 retains an older value.
  return { profile: payload[0], dpiStage: stage, dpi: { x, y }, polling: K7_RATES[payload[2] >> 4] };
}

export function k7DpiWrite(payload: Uint8Array, stage: number, value: number): Uint8Array {
  // The dedicated DPI report applies the new sensitivity without reloading the profile.
  const dpi = new Uint8Array(29);
  dpi.set([payload[2] & 15, payload[1] & 15, payload[3]]);
  dpi.set(payload.subarray(4, 17), 3); // Six X values and the number of enabled stages.
  dpi[16] = 0xff;
  dpi.set(payload.subarray(51, 63), 17);
  const data = new DataView(dpi.buffer);
  data.setUint16(3 + stage * 2, value, true);
  data.setUint16(17 + stage * 2, value, true);
  return mchoseReport(MCHOSE_LONG, MCHOSE_DPI, dpi);
}

export function k7PollingWrite(payload: Uint8Array, code: number): Uint8Array {
  // K7 uses the second argument as the active rate. Carry the other index through.
  return mchoseReport(MCHOSE_SHORT, 0x41, Uint8Array.of(payload[1] >> 4, code));
}
