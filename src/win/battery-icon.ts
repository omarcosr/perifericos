import { trayNumerals } from "./tray-numerals";
import { trayPalette } from "./tray-color";

export type TrayDevice = "headset" | "mouse";
export const trayIconStyles = [
  { id: "classic", code: 0, label: "Clássico" },
  { id: "number", code: 1, label: "Número" },
  { id: "bars", code: 2, label: "Barras" },
  { id: "ring", code: 3, label: "Anel" },
] as const;
export type TrayIconStyle = typeof trayIconStyles[number]["id"];
export type TrayAppearance = { style: TrayIconStyle; color?: number; numberSize: number };
export const trayNumberSize = { min: 65, max: 110, step: 5, default: 85 };

const colors = {
  dark: {
    headset: { ink: 0xbbd8ff, track: 0x52627b },
    mouse: { ink: 0xa9e8cb, track: 0x476658 },
    low: 0xffc477, idle: 0xb4beca,
  },
  light: {
    headset: { ink: 0x234f92, track: 0xaab9ce },
    mouse: { ink: 0x176147, track: 0x9bb8a9 },
    low: 0x8e4d08, idle: 0x566476,
  },
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

function iconDrawing(device: TrayDevice, level: number | undefined, style: TrayIconStyle, dark: boolean, color: number | undefined, numberSize: number) {
  const transparent = -1;
  const theme = colors[dark ? "dark" : "light"];
  const palette = color === undefined ? theme[device] : trayPalette(color, dark);
  const ink = level === undefined ? theme.idle : level <= 20 ? theme.low : palette.ink;
  if (level === undefined) {
    return (x: number, y: number) => insideRoundedRect(x, y, 5.25, 7.25, 10.75, 8.75, 0.75) ? ink : transparent;
  }

  if (style === "number") {
    const scale = numberSize / 100;
    const number = trayNumerals(String(level), 8, 8, Math.min(14.3, 13.6 * scale), 1.2 * scale);
    return (x: number, y: number) => number(x, y) ? ink : transparent;
  }

  if (style === "ring") {
    // Leave an opening at the bottom so the arc reads as a gauge when stationary.
    const start = -0.75 * Math.PI;
    const sweep = 1.5 * Math.PI;
    const progress = level / 100 * sweep;
    const radius = 5.56;
    const halfLine = 0.98;
    const turn = 2 * Math.PI;
    const tip = (angle: number) => [radius * Math.sin(angle), -radius * Math.cos(angle)] as const;
    const [firstX, firstY] = tip(start);
    const [lastX, lastY] = tip(start + sweep);
    const [valueX, valueY] = tip(start + progress);
    const cap = (dx: number, dy: number, cx: number, cy: number) => (dx - cx) ** 2 + (dy - cy) ** 2 <= halfLine ** 2;
    return (x: number, y: number) => {
      const dx = x - 8, dy = y - 8.55;
      const distance = dx * dx + dy * dy;
      if (distance < (radius - halfLine) ** 2 || distance > (radius + halfLine) ** 2) return transparent;
      const relativeAngle = (Math.atan2(dx, -dy) - start + turn) % turn;
      const first = cap(dx, dy, firstX, firstY);
      if (progress > 0 && (relativeAngle <= progress || first || cap(dx, dy, valueX, valueY))) return ink;
      return relativeAngle <= sweep || first || cap(dx, dy, lastX, lastY) ? palette.track : transparent;
    };
  }

  if (style === "bars") {
    const active = level * 3 / 100;
    return (x: number, y: number) => {
      if (insideRoundedRect(x, y, 4.85, 3.95, 11.15, 13.15, 1.05)) {
        const segment = Math.floor((11.9 - y) / 2.4);
        if (segment < 0 || segment >= active) return transparent;
        const bottom = 11.9 - segment * 2.4;
        const height = Math.max(0.54, Math.min(1, active - segment) * 1.6);
        return insideRoundedRect(x, y, 6, bottom - height, 10, bottom, Math.min(0.35, height / 2)) ? ink : transparent;
      }
      return insideRoundedRect(x, y, 3.55, 2.65, 12.45, 14.45, 2.05) ||
        insideRoundedRect(x, y, 6, 1, 10, 3.14, 0.6) ? ink : transparent;
    };
  }

  const fillLeft = 3.05;
  const fillWidth = level > 0 ? Math.max(1.12, level / 100 * 8.58) : 0;
  return (x: number, y: number) => {
    if (insideRoundedRect(x, y, 2.02, 5.05, 12.72, 10.95, 1.02)) {
      return fillWidth && insideRoundedRect(x, y, fillLeft, 6.14, fillLeft + fillWidth, 9.86, Math.min(0.7, fillWidth / 2))
        ? ink : transparent;
    }
    return insideRoundedRect(x, y, 0.75, 3.78, 14, 12.22, 2.16) ||
      insideRoundedRect(x, y, 13.44, 6.3, 15.5, 9.7, 0.62) ? ink : transparent;
  };
}

const iconHeaderSize = 40; // BITMAPINFOHEADER

/** RT_ICON image data, shared by the ICO sent to Tarve and CreateIconFromResourceEx. */
export function batteryIconBits(device: TrayDevice, level: number | undefined, size: number, style: TrayIconStyle,
  dark = true, color?: number, numberSize = trayNumberSize.default): Uint8Array {
  const colorSize = size * size * 4;
  const maskStride = Math.ceil(size / 32) * 4; // Rows of the 1-bit AND mask align to a DWORD.
  const bytes = new Uint8Array(iconHeaderSize + colorSize + maskStride * size);
  const data = new DataView(bytes.buffer);
  data.setUint32(0, iconHeaderSize, true);
  data.setInt32(4, size, true);
  data.setInt32(8, size * 2, true); // Height includes the color bitmap and the AND mask.
  data.setUint16(12, 1, true);
  data.setUint16(14, 32, true);
  bytes.fill(0xff, iconHeaderSize + colorSize);
  const colorAt = iconDrawing(device, level, style, dark, color, numberSize);

  // Sample the 16-unit drawing at both icon sizes, smoothing the rounded edges.
  const samples = 4;
  const step = 16 / (size * samples);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      let count = 0, red = 0, green = 0, blue = 0;
      for (let dy = 0; dy < samples; dy++) {
        for (let dx = 0; dx < samples; dx++) {
          const color = colorAt((column * samples + dx + 0.5) * step, ((size - 1 - row) * samples + dy + 0.5) * step);
          if (color < 0) continue;
          count++;
          red += color >> 16;
          green += (color >> 8) & 0xff;
          blue += color & 0xff;
        }
      }
      if (!count) continue;
      const alpha = Math.round(255 * count / (samples * samples));
      data.setUint32(iconHeaderSize + (row * size + column) * 4, (alpha << 24) |
        (Math.round(red / count) << 16) | (Math.round(green / count) << 8) | Math.round(blue / count), true);
      bytes[iconHeaderSize + colorSize + row * maskStride + (column >> 3)] &= ~(0x80 >> (column & 7));
    }
  }
  return bytes;
}

const previews = new Map<string, { rgba: Uint8Array; width: number; height: number; cacheKey: string }>();

export function trayIconPreview(device: TrayDevice, style: TrayIconStyle, dark = true, color?: number, numberSize = trayNumberSize.default) {
  const slot = `tray-preview-${device}-${style}-${dark ? "dark" : "light"}`;
  const key = `${slot}-${color ?? "default"}-${style === "number" ? numberSize : 0}`;
  const cached = previews.get(slot);
  if (cached?.cacheKey === key) return cached;
  const size = 32;
  const bits = batteryIconBits(device, 75, size, style, dark, color, numberSize);
  const rgba = new Uint8Array(size * size * 4);
  // DIB icons store BGRA bottom-up, while Image expects RGBA in top-down row order.
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const from = iconHeaderSize + ((size - 1 - row) * size + column) * 4;
      const to = (row * size + column) * 4;
      rgba.set([bits[from + 2], bits[from + 1], bits[from], bits[from + 3]], to);
    }
  }
  const preview = { rgba, width: size, height: size, cacheKey: key };
  previews.set(slot, preview);
  return preview;
}

export function headsetTrayImage(level: number | undefined, style: TrayIconStyle, size = 32, dark = true, color?: number,
  numberSize = trayNumberSize.default): string {
  const bits = batteryIconBits("headset", level, size, style, dark, color, numberSize);
  const ico = new Uint8Array(22 + bits.length);
  const data = new DataView(ico.buffer);
  data.setUint16(2, 1, true);
  data.setUint16(4, 1, true);
  ico[6] = ico[7] = size;
  data.setUint16(10, 1, true);
  data.setUint16(12, 32, true);
  data.setUint32(14, bits.length, true);
  data.setUint32(18, 22, true);
  ico.set(bits, 22);
  return `data:image/x-icon;base64,${Buffer.from(ico).toString("base64")}`;
}
