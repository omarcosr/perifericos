export const trayBackground = { dark: 0x1b1b1f, light: 0xf0eff4 };

export const trayDefaultColor = { headset: 0x6099f4, mouse: 0x37b88d };

export type TrayHsl = { hue: number; saturation: number; lightness: number };

export function toTrayHsl(rgb: number): TrayHsl {
  const [r, g, b] = channels(rgb).map(channel => channel / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const chroma = max - min, light = (max + min) / 2;
  if (!chroma) return { hue: 0, saturation: 0, lightness: Math.round(light * 100) };
  const sector = max === r ? (g - b) / chroma : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return {
    hue: Math.round((sector + 6) * 60) % 360,
    saturation: Math.round(chroma / (1 - Math.abs(2 * light - 1)) * 100),
    lightness: Math.round(light * 100),
  };
}

export function fromTrayHsl({ hue, saturation, lightness }: TrayHsl): number {
  const light = lightness / 100;
  const amplitude = saturation / 100 * Math.min(light, 1 - light);
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    return Math.round((light - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}

export function hexColor(value: number): string {
  return `#${value.toString(16).toUpperCase().padStart(6, "0")}`;
}

export function parseHexColor(value: string): number | undefined {
  const hex = value.trim().replace(/^#/, "");
  return /^[\da-f]{6}$/i.test(hex) ? Number.parseInt(hex, 16) : undefined;
}

function channels(rgb: number) {
  return [rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff];
}

function mix(from: number, to: number, amount: number): number {
  const end = channels(to);
  return channels(from).reduce((rgb, channel, i) => (rgb << 8) | Math.round(channel + (end[i] - channel) * amount), 0);
}

function luminance(rgb: number): number {
  const [red, green, blue] = channels(rgb).map(channel => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function trayPalette(color: number, dark: boolean) {
  const background = trayBackground[dark ? "dark" : "light"];
  const bg = luminance(background) + 0.05;
  const contrast = (rgb: number) => {
    const fg = luminance(rgb) + 0.05;
    return Math.max(fg, bg) / Math.min(fg, bg);
  };
  let ink = color;
  if (contrast(color) < 5.5) {
    const target = dark ? 0xffffff : 0x000000;
    let low = 0, high = 1;
    for (let step = 0; step < 9; step++) {
      const amount = (low + high) / 2;
      if (contrast(mix(color, target, amount)) < 5.5) low = amount;
      else high = amount;
    }
    ink = mix(color, target, high);
  }
  return { ink, track: mix(ink, background, dark ? 0.62 : 0.52) };
}
