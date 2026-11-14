type Device = "headset" | "mouse";

const digits: Record<string, readonly string[]> = {
  "0": ["0110", "1001", "1001", "1001", "1001", "0110"],
  "1": ["01", "11", "01", "01", "01", "01"],
  "2": ["1110", "0001", "0010", "0100", "1000", "1111"],
  "3": ["1110", "0001", "0110", "0001", "0001", "1110"],
  "4": ["1001", "1001", "1111", "0001", "0001", "0001"],
  "5": ["1111", "1000", "1110", "0001", "0001", "1110"],
  "6": ["0110", "1000", "1110", "1001", "1001", "0110"],
  "7": ["1111", "0001", "0010", "0010", "0100", "0100"],
  "8": ["0110", "1001", "0110", "1001", "1001", "0110"],
  "9": ["0110", "1001", "1001", "0111", "0001", "0110"],
  "100": ["01 111 111", "11 101 101", "01 101 101", "01 101 101", "01 101 101", "01 111 111"],
  "–": ["0000", "0000", "1111", "0000", "0000", "0000"],
};

const colors = {
  headset: { outline: 0x648ab5, track: 0x1c293b, fill: 0x345b83 },
  mouse: { outline: 0x568e78, track: 0x182d27, fill: 0x2a644f },
};

export function batteryTooltip(name: string, level?: number, charging?: boolean): string {
  if (charging) return `${name} · Carregando${level === undefined ? "" : ` · ${level}%`}`;
  return `${name} · ${level === undefined ? "bateria sem leitura" : `${level}% de bateria`}`;
}

function insideRoundedRect(x: number, y: number, left: number, top: number, right: number, bottom: number, radius: number): boolean {
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const dx = x - Math.max(left + radius, Math.min(x, right - radius));
  const dy = y - Math.max(top + radius, Math.min(y, bottom - radius));
  return dx * dx + dy * dy <= radius * radius;
}

/** RT_ICON image data, shared by the ICO sent to Tarve and CreateIconFromResourceEx. */
export function batteryIconBits(device: Device, level: number | undefined, size: 16 | 32): Uint8Array {
  const headerSize = 40; // BITMAPINFOHEADER
  const colorSize = size * size * 4;
  const maskStride = 4; // 16 and 32 bits both use one DWORD per row.
  const bytes = new Uint8Array(headerSize + colorSize + maskStride * size);
  const data = new DataView(bytes.buffer);
  data.setUint32(0, headerSize, true);
  data.setInt32(4, size, true);
  data.setInt32(8, size * 2, true); // Height includes the color bitmap and the AND mask.
  data.setUint16(12, 1, true);
  data.setUint16(14, 32, true);
  bytes.fill(0xff, headerSize + colorSize);

  const palette = colors[device];
  const low = level !== undefined && level <= 20;
  const fill = low ? 0x69502e : palette.fill;
  const ink = low ? 0xffe5b3 : level === undefined ? 0xb9c7d2 : 0xf5f9ff;
  const fillEnd = 1.5 + (12.7 - 1.5) * (level ?? 0) / 100;

  // Draw the number on whole pixels at 16 px and spell out the percentage in the tooltip.
  const label = level === undefined ? "–" : String(level);
  const glyphs = digits[label] ? [digits[label]] : [...label].map(digit => digits[digit]);
  const rows = glyphs[0].map((_, row) => glyphs.map(glyph => glyph[row]).join(" "));
  const textLeft = Math.round(7.1 - rows[0].length / 2);

  function colorAt(x: number, y: number): number {
    if (insideRoundedRect(x, y, 1.5, 4, 12.7, 12, 1.15)) {
      if (rows[Math.floor(y - 5)]?.[Math.floor(x - textLeft)] === "1") return ink;
      return x < fillEnd ? fill : palette.track;
    }
    if (insideRoundedRect(x, y, 0.4, 2.9, 13.8, 13.1, 2.25) ||
        insideRoundedRect(x, y, 13.25, 5.75, 15.7, 10.25, 0.85)) return palette.outline;
    return 0;
  }

  // Sample the 16-unit drawing at both icon sizes, smoothing the rounded edges.
  const samples = 4;
  const step = 16 / (size * samples);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      let count = 0, red = 0, green = 0, blue = 0;
      for (let dy = 0; dy < samples; dy++) {
        for (let dx = 0; dx < samples; dx++) {
          const color = colorAt((column * samples + dx + 0.5) * step, ((size - 1 - row) * samples + dy + 0.5) * step);
          if (!color) continue;
          count++;
          red += color >> 16;
          green += (color >> 8) & 0xff;
          blue += color & 0xff;
        }
      }
      if (!count) continue;
      const alpha = Math.round(255 * count / (samples * samples));
      data.setUint32(headerSize + (row * size + column) * 4, (alpha << 24) |
        (Math.round(red / count) << 16) | (Math.round(green / count) << 8) | Math.round(blue / count), true);
      bytes[headerSize + colorSize + row * maskStride + (column >> 3)] &= ~(0x80 >> (column & 7));
    }
  }
  return bytes;
}

export function headsetTrayImage(level?: number): string {
  const bits = batteryIconBits("headset", level, 32);
  const ico = new Uint8Array(22 + bits.length);
  const data = new DataView(ico.buffer);
  data.setUint16(2, 1, true);
  data.setUint16(4, 1, true);
  ico[6] = ico[7] = 32;
  data.setUint16(10, 1, true);
  data.setUint16(12, 32, true);
  data.setUint32(14, bits.length, true);
  data.setUint32(18, 22, true);
  ico.set(bits, 22);
  return `data:image/x-icon;base64,${Buffer.from(ico).toString("base64")}`;
}
