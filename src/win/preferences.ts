import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { dll, view, wide } from "./ffi";
import { WindowsError } from "./kernel";

const profile = dll("kernel32", {
  GetPrivateProfileIntW: { args: ["buffer", "buffer", "i32", "buffer"], returns: "u32" },
  WritePrivateProfileStringW: { args: ["buffer", "buffer", "buffer", "buffer"], returns: "i32" },
});
const registry = dll("advapi32", {
  RegGetValueW: { args: ["i64", "buffer", "buffer", "u32", "i64", "buffer", "buffer"], returns: "i32" },
});

export const sounds = ["Sem som", "Pulso", "Duplo", "Subida", "Descida"] as const;
export interface Preferences { lightsOff: boolean; onUnmute: number; onMute: number }

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
    return {
      lightsOff: read("controle", "leds_apagados", 1) !== 0,
      onUnmute: sound("microfone_ativo"),
      onMute: sound("microfone_mudo"),
    };
  }

  save<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    const entry = {
      lightsOff: ["controle", "leds_apagados"],
      onUnmute: ["sons", "microfone_ativo"],
      onMute: ["sons", "microfone_mudo"],
    }[key];
    mkdirSync(dirname(this.path), { recursive: true });
    if (!profile.WritePrivateProfileStringW(wide(entry[0]), wide(entry[1]), wide(String(Number(value))), wide(this.path))) {
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

export function systemDark(): boolean {
  const value = new Uint8Array(4);
  const size = new Uint8Array(4);
  view(size).setUint32(0, 4, true);
  const result = registry.RegGetValueW(-2147483647n, // HKEY_CURRENT_USER
    wide("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"), wide("AppsUseLightTheme"),
    0x10, 0n, value, size);
  return result !== 0 || view(value).getUint32(0, true) === 0;
}
