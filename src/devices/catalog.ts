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
} as const satisfies { id: string; label: string; match: HidMatch };
