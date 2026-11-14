import type { HidMatch } from "../win/hid";

export const hs80 = {
  id: "corsair-hs80-max",
  label: "Corsair HS80 MAX",
  match: { vendor: 0x1b1c, products: [0x0a97], usagePage: 0xff42, usage: 1, input: 64, output: 64 },
} as const satisfies { id: string; label: string; match: HidMatch };

export const viper = {
  id: "razer-viper-v3-pro",
  label: "Razer Viper V3 Pro",
  match: { vendor: 0x1532, products: [0x00c0, 0x00c1], usagePage: 1, usage: 2, feature: 91 },
  dpi: { min: 100, max: 35000, step: 50 },
} as const;

const k7Receiver = 0x1001, k7Body = 0x4150;
export const mchoseK7 = {
  id: "mchose-k7-ultra",
  label: "MCHOSE K7 Ultra",
  // The receiver's USB PID differs from the mouse's own PID in the battery reply.
  receiver: k7Receiver,
  body: k7Body,
  match: { vendor: 0x3837, products: [k7Receiver, k7Body], usagePage: 0xff01, usage: 1, feature: 65 },
  dpi: { min: 50, max: 42000, step: 50 },
} as const;

export const mouseModels = { [viper.id]: viper, [mchoseK7.id]: mchoseK7 };
export type MouseModelId = keyof typeof mouseModels;
