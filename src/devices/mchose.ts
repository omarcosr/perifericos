import { delay } from "../win/ffi";
import { FeatureHid, matchingHid, type HidInterface } from "../win/hid";
import { mchoseK7 } from "./catalog";
import { k7Config, k7DpiWrite, k7Identity, k7PollingWrite, K7_RATES, mchoseReply, mchoseReport,
  MCHOSE_CONFIG, MCHOSE_IDENTITY, MCHOSE_LONG, MCHOSE_SHORT } from "./mchose-protocol";
import { validDpi, type MouseSetting, type MouseState } from "./mouse-state";

async function read<T>(mouse: FeatureHid, id: typeof MCHOSE_SHORT | typeof MCHOSE_LONG, command: number,
  parse: (payload: Uint8Array) => T | undefined, attempts = 3): Promise<T | undefined> {
  const request = mchoseReport(id, command);
  const reply = new Uint8Array(request.length);
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) await delay(110);
    if (!mouse.set(request)) continue;
    await delay(50);
    reply.fill(0);
    reply[0] = id;
    if (!mouse.get(reply)) continue;
    const payload = mchoseReply(reply, id, command);
    const result = payload && parse(payload);
    if (result !== undefined) return result;
  }
  return undefined;
}

async function readConfig(mouse: FeatureHid, attempts = 3) {
  return read(mouse, MCHOSE_LONG, MCHOSE_CONFIG, bytes => {
    const config = k7Config(bytes);
    return config && { ...config, bytes };
  }, attempts);
}

async function setK7(mouse: FeatureHid, setting: MouseSetting, current: Awaited<ReturnType<typeof readConfig>>) {
  if (!current || current.profile !== setting.previous.profile || current.dpiStage !== setting.previous.dpiStage) {
    throw new Error("O perfil ou a etapa de DPI mudou. Aguarde a nova leitura e tente de novo.");
  }
  let request: Uint8Array;
  if (setting.kind === "dpi") {
    if (!setting.previous.dpi || !validDpi(setting.value, mchoseK7.dpi)) throw new Error("DPI inválido para o K7 Ultra.");
    request = k7DpiWrite(current.bytes, current.dpiStage, setting.value);
  } else {
    const code = K7_RATES.findIndex(rate => rate === setting.value);
    if (!setting.previous.polling || !current.polling || code < 0) throw new Error("Taxa inválida para o K7 Ultra.");
    request = k7PollingWrite(current.bytes, code);
  }
  await delay(30);
  if (!mouse.set(request)) throw new Error("Falha ao enviar o ajuste ao K7 Ultra.");
  // The receiver can return an older copy while the mouse applies the write.
  // Read again if needed without resending the write to onboard memory.
  let latest: typeof current | undefined;
  for (const ms of [200, 120, 200, 350]) {
    await delay(ms);
    const result = await readConfig(mouse, 1);
    if (!result) continue;
    latest = result;
    if (result.profile !== current.profile || result.dpiStage !== current.dpiStage) break;
    const confirmed = setting.kind === "dpi"
      ? result.dpi.x === setting.value && result.dpi.y === setting.value
      : result.polling === setting.value;
    if (confirmed) break;
  }
  return latest;
}

export async function queryK7(entries: HidInterface[], setting?: MouseSetting, batteryOnly = false): Promise<MouseState> {
  const matches = matchingHid(mchoseK7.match, entries);
  const wired = matches.filter(entry => entry.product === mchoseK7.body);
  const preferred = wired.length ? wired : matches;
  if (preferred.length > 1) return { status: "duplicate" };
  const entry = preferred[0];
  if (!entry) return { status: entries.length ? "unavailable" : "disconnected" };
  const wireless = entry.product === mchoseK7.receiver;
  if (setting && setting.previous.path?.toLowerCase() !== entry.path.toLowerCase()) {
    throw new Error("O mouse mudou. Aguarde a nova leitura e tente de novo.");
  }
  const mouse = new FeatureHid(entry, 0xc0000000); // GENERIC_READ | GENERIC_WRITE on the vendor collection.
  try {
    const identity = await read(mouse, MCHOSE_SHORT, MCHOSE_IDENTITY, payload => k7Identity(payload, wireless), batteryOnly ? 2 : 3);
    if (!identity?.connected) return { status: wireless ? "waiting" : "unavailable", wireless };
    const state = { status: "connected", path: entry.path, wireless, battery: identity.battery, charging: identity.charging } as const;
    if (batteryOnly) return state;
    await delay(30);
    let config = await readConfig(mouse);
    if (setting) config = await setK7(mouse, setting, config);
    return { ...state, dpi: config?.dpi, polling: config?.polling, profile: config?.profile, dpiStage: config?.dpiStage, rates: K7_RATES };
  } finally {
    mouse.close();
  }
}
