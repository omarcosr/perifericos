import { expect, test } from "bun:test";
import { batteryIconBits, headsetTrayImage, trayIconPreview, trayIconStyles, trayNumberSize } from "../src/win/battery-icon";
import { fromTrayHsl, hexColor, parseHexColor, toTrayHsl, trayPalette } from "../src/win/tray-color";

test("cada estilo produz um ícone distinto nas escalas do Windows, inclusive sem leitura", () => {
  for (const size of [16, 20, 24, 28, 32, 48]) {
    for (const device of ["headset", "mouse"] as const) {
      const icons = new Set<string>();
      for (const { id } of trayIconStyles) {
        const readings = [undefined, 0, 19, 75, 100].map(level => {
          const bits = batteryIconBits(device, level, size, id);
          const data = new DataView(bits.buffer);
          expect(data.getInt32(4, true)).toBe(size);
          expect(data.getInt32(8, true)).toBe(2 * size);
          expect(bits).toHaveLength(40 + size * size * 4 + size * Math.ceil(size / 32) * 4);
          return Buffer.from(bits).toString("base64");
        });
        expect(readings[0]).not.toBe(readings[1]);
        expect(readings[3]).not.toBe(readings[4]);
        icons.add(readings[3]);
      }
      expect(icons.size).toBe(trayIconStyles.length);
    }
  }
});

test("ICO da bandeja e prévia usam os mesmos pixels", () => {
  const image = headsetTrayImage(75, "ring");
  const ico = Buffer.from(image.split(",")[1], "base64");
  const dib = batteryIconBits("headset", 75, 32, "ring");
  expect(ico.readUInt32LE(14)).toBe(dib.length);
  expect(Buffer.compare(ico.subarray(ico.readUInt32LE(18)), dib)).toBe(0);
  const small = Buffer.from(headsetTrayImage(75, "number", 20).split(",")[1], "base64");
  expect(small[6]).toBe(20);
  expect(small.readUInt32LE(22 + 4)).toBe(20);

  const { rgba } = trayIconPreview("headset", "ring");
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const from = 40 + ((31 - y) * 32 + x) * 4;
      const to = (y * 32 + x) * 4;
      expect([...rgba.subarray(to, to + 4)]).toEqual([dib[from + 2], dib[from + 1], dib[from], dib[from + 3]]);
    }
  }
});

test("mantém o espaço livre ao redor do número e dentro do anel e da bateria", () => {
  const size = 32;
  for (const dark of [true, false]) {
    const number = batteryIconBits("headset", 100, size, "number", dark);
    const classic = batteryIconBits("headset", 75, size, "classic", dark);
    const bars = batteryIconBits("mouse", 75, size, "bars", dark);
    const ring = batteryIconBits("mouse", 75, size, "ring", dark);
    const alphaAt = (bits: Uint8Array, x: number, y: number) => bits[40 + ((size - 1 - y) * size + x) * 4 + 3];

    expect(alphaAt(number, 16, 2)).toBe(0);
    expect(alphaAt(bars, 3, 2)).toBe(0);
    expect(alphaAt(classic, 14, 10)).toBe(0);
    expect(alphaAt(classic, 14, 16)).toBe(255);
    expect(alphaAt(ring, 16, 16)).toBe(0);
  }
  const dark = trayIconPreview("mouse", "number", true);
  const light = trayIconPreview("mouse", "number", false);
  expect(dark.cacheKey).not.toBe(light.cacheKey);
  expect(dark.rgba).not.toEqual(light.rgba);
});

test("preserva preto válido no desenho e adapta a cor à bandeja escura", () => {
  expect(parseHexColor("#000000")).toBe(0);
  expect(parseHexColor("aBc123")).toBe(0xabc123);
  expect(parseHexColor("#1234")).toBeUndefined();
  expect(hexColor(0x2288)).toBe("#002288");
  expect(trayPalette(0, false).ink).toBe(0);
  expect(trayPalette(0, true).ink).not.toBe(0);
  expect(trayPalette(0xffffff, true).ink).toBe(0xffffff);
  expect(trayPalette(0xffffff, false).ink).not.toBe(0xffffff);

  const black = trayIconPreview("mouse", "number", false, 0);
  const defaultColor = trayIconPreview("mouse", "number", false);
  expect(black.rgba.some((value, index) => index % 4 === 3 && value === 255 &&
    black.rgba[index - 1] === 0 && black.rgba[index - 2] === 0 && black.rgba[index - 3] === 0)).toBe(true);
  expect(black.rgba).not.toEqual(defaultColor.rgba);
});

test("o tamanho muda a área dos números sem mudar os outros desenhos", () => {
  const { min, max } = trayNumberSize;
  for (const size of [16, 20, 32]) {
    const coverage = (numberSize: number) => {
      const bytes = batteryIconBits("headset", 100, size, "number", true, undefined, numberSize);
      let alpha = 0;
      for (let offset = 43; offset < 40 + size * size * 4; offset += 4) alpha += bytes[offset];
      return alpha;
    };
    expect(coverage(min)).toBeGreaterThan(0);
    expect(coverage(max)).toBeGreaterThan(coverage(min));
  }
  const ring = (numberSize: number) => batteryIconBits("headset", 75, 20, "ring", true, undefined, numberSize);
  expect(ring(min)).toEqual(ring(max));
});

test("matiz, saturação e luminosidade formam a cor indicada nas faixas", () => {
  for (const rgb of [0, 0xffffff, 0xff0000, 0x00ff00, 0x0000ff]) expect(fromTrayHsl(toTrayHsl(rgb))).toBe(rgb);
  expect(fromTrayHsl({ hue: 60, saturation: 100, lightness: 50 })).toBe(0xffff00);
  expect(fromTrayHsl({ hue: 240, saturation: 0, lightness: 50 })).toBe(0x808080);
});

test("a pilha tem terminal no topo e preenche os segmentos de baixo para cima", () => {
  const size = 32;
  const pixels = (level: number) => {
    const data = new DataView(batteryIconBits("headset", level, size, "bars").buffer);
    return (x: number, y: number) => data.getUint32(40 + ((size - 1 - y) * size + x) * 4, true);
  };
  const pixel = pixels(50);
  const full = pixels(100);
  const terminal = pixel(16, 3);
  expect(terminal >>> 24).toBe(255);
  expect(pixel(16, 22)).toBe(terminal);
  expect(pixel(16, 18)).toBe(terminal);
  expect(pixel(16, 12)).toBe(0);
  expect(full(16, 12)).toBe(terminal);
  expect(full(16, 19)).toBe(0);
  expect(full(28, 17)).toBe(0);
});

test("o medidor deixa uma abertura na base mesmo com carga completa", () => {
  const size = 32;
  const bits = batteryIconBits("mouse", 100, size, "ring");
  const alpha = (x: number, y: number) => bits[40 + ((size - 1 - y) * size + x) * 4 + 3];
  expect(alpha(16, 5)).toBe(255);
  expect(alpha(16, 27)).toBe(0);
});
