import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { trayIconStyles, trayNumberSize, type TrayAppearance, type TrayDevice } from "./battery-icon";
import { dll, fromWide, view, wide } from "./ffi";
import { WindowsError } from "./kernel";

const profile = dll("kernel32", {
  GetPrivateProfileIntW: { args: ["buffer", "buffer", "i32", "buffer"], returns: "u32" },
  GetPrivateProfileStringW: { args: ["buffer", "buffer", "buffer", "buffer", "u32", "buffer"], returns: "u32" },
  WritePrivateProfileStringW: { args: ["buffer", "buffer", "buffer", "buffer"], returns: "i32" },
});
const registry = dll("advapi32", {
  RegGetValueW: { args: ["i64", "buffer", "buffer", "u32", "i64", "buffer", "buffer"], returns: "i32" },
});

export const sounds = ["Sem som", "Pulso", "Duplo", "Subida", "Descida"] as const;
export interface Preferences {
  lightsOff: boolean;
  onUnmute: number;
  onMute: number;
  tray: Record<TrayDevice, TrayAppearance>;
}

const defaultColor = 0x1000000; // One past the RGB range. Older profiles have no color keys.

export class PreferenceStore {
  readonly path = join(process.env.PERIFERICOS_CONFIG_DIR ??
    join(process.env.LOCALAPPDATA ?? process.env.USERPROFILE ?? process.cwd(), "PerifericosTarve"), "preferencias.ini");

  load(source = this.path): Preferences {
    const path = wide(source);
    const read = (section: string, key: string, fallback: number) =>
      profile.GetPrivateProfileIntW(wide(section), wide(key), fallback, path);
    const sound = (name: string) => {
      const value = read("sons", name, 0);
      return value < sounds.length ? value : 0;
    };
    const tray = (device: TrayDevice): TrayAppearance => {
      const text = new Uint8Array(256);
      if (profile.GetPrivateProfileStringW(wide("bandeja"), wide(`aparencia_${device}`), wide(""), text, text.length / 2, path)) {
        try {
          const saved = JSON.parse(fromWide(text)) as TrayAppearance;
          if (trayIconStyles.some(style => style.id === saved?.style) && Number.isInteger(saved.numberSize) &&
              saved.numberSize >= trayNumberSize.min && saved.numberSize <= trayNumberSize.max) {
            const color = saved.color;
            return { style: saved.style, numberSize: saved.numberSize,
              color: color !== undefined && Number.isInteger(color) && color >= 0 && color < defaultColor ? color : undefined };
          }
        } catch { /* Try the settings from older builds. */ }
      }
      const code = read("bandeja", device, 0);
      const value = read("bandeja", `cor_${device}`, defaultColor);
      return {
        style: trayIconStyles.find(style => style.code === code)?.id ?? "classic",
        color: value < defaultColor ? value : undefined,
        numberSize: trayNumberSize.default,
      };
    };
    return {
      lightsOff: read("controle", "leds_apagados", 1) !== 0,
      onUnmute: sound("microfone_ativo"),
      onMute: sound("microfone_mudo"),
      tray: { headset: tray("headset"), mouse: tray("mouse") },
    };
  }

  save<K extends "lightsOff" | "onUnmute" | "onMute">(key: K, value: Preferences[K]): void {
    const entry = {
      lightsOff: ["controle", "leds_apagados"],
      onUnmute: ["sons", "microfone_ativo"],
      onMute: ["sons", "microfone_mudo"],
    }[key];
    this.write(entry[0], entry[1], String(Number(value)));
  }

  saveTray(device: TrayDevice, appearance: TrayAppearance): void {
    this.write("bandeja", `aparencia_${device}`, JSON.stringify(appearance));
  }

  private write(section: string, key: string, value: string): void {
    mkdirSync(dirname(this.path), { recursive: true });
    if (!profile.WritePrivateProfileStringW(wide(section), wide(key), wide(value), wide(this.path))) {
      throw new WindowsError("Salvar preferências");
    }
  }

  importFirstRun(source: string | undefined): void {
    if (!source || existsSync(this.path) || !existsSync(source)) return;
    const { lightsOff, onUnmute, onMute } = this.load(source);
    this.save("lightsOff", lightsOff);
    this.save("onUnmute", onUnmute);
    this.save("onMute", onMute);
  }
}

const themeSettings = wide("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");
const themeValues = { app: wide("AppsUseLightTheme"), tray: wide("SystemUsesLightTheme") } as const;

export function systemDark(surface: keyof typeof themeValues = "app"): boolean {
  const value = new Uint8Array(4);
  const size = new Uint8Array(4);
  view(size).setUint32(0, 4, true);
  const result = registry.RegGetValueW(-2147483647n, themeSettings, themeValues[surface], // HKEY_CURRENT_USER
    0x10, 0n, value, size);
  return result !== 0 || view(value).getUint32(0, true) === 0;
}
