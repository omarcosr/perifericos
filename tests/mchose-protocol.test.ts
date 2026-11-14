import { expect, test } from "bun:test";
import { k7Config, k7DpiWrite, k7Identity, k7PollingWrite, mchoseReply, mchoseReport,
  MCHOSE_CONFIG, MCHOSE_DPI, MCHOSE_IDENTITY, MCHOSE_LONG, MCHOSE_SHORT } from "../src/devices/mchose-protocol";

// Recorded report and config from the K7 Ultra protocol notes, firmware 5.28.5.0.
const report = Uint8Array.of(0x11, 0xf9, 0xc8, 0xc7, 0xaf, 0xbe, 0xe3, 0xfa, 0xfa, 0xff, 0xf6, 0xe3, 0xff, 0xe1,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
const config = Uint8Array.from(Buffer.from([
  "00 22 22 02 90 01 20 03 40 06 80 0c 00 19 10 a4",
  "06 0e 08 03 00 00 00 00 00 10 00 00 00 20 00 00",
  "00 30 00 00 00 40 00 00 00 50 00 00 00 00 00 00",
  "00 00 80 90 01 20 03 40 06 80 0c 00 19 10 a4",
].join("").replace(/ /g, ""), "hex"));

test("envia o relatório curto com o tamanho exigido pela coleção no Windows", () => {
  const request = mchoseReport(MCHOSE_SHORT, MCHOSE_IDENTITY);
  expect(request.length).toBe(65);
  expect([...request.slice(0, 3)]).toEqual([0x11, 0xf9, 0xff]);
  expect(request.slice(2, 21).every(byte => byte === 0xff)).toBe(true);
  expect(request.slice(21).every(byte => byte === 0)).toBe(true);
});

test("confere identidade, bateria, carga e vínculo com o receptor", () => {
  const payload = mchoseReply(report, MCHOSE_SHORT, MCHOSE_IDENTITY)!;
  expect(k7Identity(payload, true)).toEqual({ connected: true, battery: 28, charging: false });
  expect(k7Identity(payload, false)).toBeUndefined();
  payload[10] = 1;
  expect(k7Identity(payload, true)?.charging).toBe(true);
  payload[8] = 1;
  expect(k7Identity(payload, true)?.connected).toBe(false);
  payload[8] = 0;
  expect(k7Identity(payload, false)?.connected).toBe(true);
  payload[2] ^= 1;
  expect(k7Identity(payload, false)).toBeUndefined();
});

test("rejeita uma leitura vazia, truncada ou de outro comando", () => {
  expect(mchoseReply(mchoseReport(MCHOSE_SHORT, MCHOSE_IDENTITY), MCHOSE_SHORT, MCHOSE_IDENTITY)).toBeUndefined();
  expect(mchoseReply(report.subarray(0, 11), MCHOSE_SHORT, MCHOSE_IDENTITY)).toBeUndefined();
  expect(mchoseReply(report, MCHOSE_SHORT, 3)).toBeUndefined();
});

test("lê DPI e polling do K7, incluindo o índice de taxa ativo", () => {
  const payload = mchoseReply(mchoseReport(MCHOSE_LONG, MCHOSE_CONFIG, config), MCHOSE_LONG, MCHOSE_CONFIG)!;
  expect(k7Config(payload)).toEqual({ profile: 0, dpiStage: 2, dpi: { x: 1600, y: 1600 }, polling: 1000 });
  payload[2] = 0x52;
  expect(k7Config(payload)?.polling).toBe(8000);
  payload[16] = 0;
  expect(k7Config(payload)).toBeUndefined();
});

test("o comando de DPI mantém os índices e as demais etapas, inclusive com X e Y diferentes", () => {
  const original = config.slice();
  original[2] = 0x21;
  original[53] = 0x84; // Y = 900, X = 800 na segunda etapa.
  const request = k7DpiWrite(original, 2, 10000);
  expect([...request.subarray(0, 5)]).toEqual([0x12, 0xbf, 0xfe, 0xfd, 0xfd]);
  const written = mchoseReply(request, MCHOSE_LONG, MCHOSE_DPI)!;
  const x = original.slice(4, 16);
  const y = original.slice(51, 63);
  new DataView(x.buffer).setUint16(4, 10000, true);
  new DataView(y.buffer).setUint16(4, 10000, true);
  expect([...written.subarray(0, 29)]).toEqual([1, 2, 2, ...x, 6, 0xff, ...y]);
  expect(written.subarray(29).every(byte => byte === 0)).toBe(true);
  expect(k7Config(original)?.dpi).toEqual({ x: 1600, y: 1600 });
});

test("o ajuste de polling preserva o primeiro índice e troca o índice ativo", () => {
  expect([...k7PollingWrite(config, 5).subarray(0, 4)]).toEqual([0x11, 0xbe, 0xfd, 0xfa]);
});
