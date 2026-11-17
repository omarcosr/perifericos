import { batteryIconBits, batteryTooltip, type TrayAppearance } from "./battery-icon";
import { dll, view, wide } from "./ffi";
import { systemDark } from "./preferences";

const user = dll("user32", {
  CreateWindowExW: { args: ["u32", "buffer", "buffer", "u32", "i32", "i32", "i32", "i32", "i64", "i64", "i64", "i64"], returns: "i64" },
  DestroyWindow: { args: ["i64"], returns: "i32" },
  FindWindowW: { args: ["buffer", "i64"], returns: "i64" },
  GetDpiForWindow: { args: ["i64"], returns: "u32" },
  GetSystemMetrics: { args: ["i32"], returns: "i32" },
  CreateIconFromResourceEx: { args: ["buffer", "u32", "i32", "u32", "i32", "i32", "u32"], returns: "i64" },
  DestroyIcon: { args: ["i64"], returns: "i32" },
});
const shell = dll("shell32", { Shell_NotifyIconW: { args: ["u32", "buffer"], returns: "i32" } });
const NIM_ADD = 0, NIM_MODIFY = 1, NIM_DELETE = 2;
const NIF_ICON_AND_TIP = 0x02 | 0x04;
const HWND_MESSAGE = -3n;
const taskbarClass = wide("Shell_TrayWnd");

export function systemTrayIconSize(): number {
  return Math.max(16, user.GetSystemMetrics(49)); // SM_CXSMICON, also used by Tarve.
}

/** Tarve provides one tray icon. Windows registers this second indicator in the same process. */
export function createMouseBatteryIcon(appearance: TrayAppearance, onThemeChange: (dark: boolean) => void) {
  const hwnd = user.CreateWindowExW(0, wide("Static"), wide("Perifericos.Tarve.MouseBattery"),
    0, 0, 0, 0, 0, HWND_MESSAGE, 0n, 0n, 0n);
  if (!hwnd) return undefined;

  // NOTIFYICONDATAW on Windows x64. uID 1 is used by Tarve's app icon.
  const entry = new Uint8Array(976);
  const data = view(entry);
  data.setUint32(0, entry.length, true);
  data.setBigInt64(8, hwnd, true);
  data.setUint32(16, 2, true);
  data.setUint32(20, NIF_ICON_AND_TIP, true);
  let level: number | undefined;
  let tooltip = "Mouse desconectado";
  let lastTaskbar = 0n;
  let lastSize: number | undefined;
  let lastDark: boolean | undefined;
  let added = false;
  let dirty = true;

  function publish(): void {
    const taskbar = user.FindWindowW(taskbarClass, 0n);
    if (!taskbar) { added = false; return; }
    const dpi = user.GetDpiForWindow(taskbar);
    const size = dpi ? Math.max(16, Math.round(dpi * 16 / 96)) : systemTrayIconSize();
    const dark = systemDark("tray");
    if (lastDark !== dark) onThemeChange(dark);
    const sameTaskbar = added && lastTaskbar === taskbar;
    if (sameTaskbar && lastSize === size && lastDark === dark && !dirty) return;
    const bits = batteryIconBits("mouse", level, size, appearance.style, dark, appearance.color, appearance.numberSize);
    const icon = user.CreateIconFromResourceEx(bits, bits.length, 1, 0x30000, size, size, 0);
    if (!icon) return;
    try {
      data.setBigInt64(32, icon, true);
      entry.set(wide(tooltip.slice(0, 127)), 40);
      added = Boolean((sameTaskbar && shell.Shell_NotifyIconW(NIM_MODIFY, entry)) || shell.Shell_NotifyIconW(NIM_ADD, entry));
      lastTaskbar = taskbar;
      lastSize = size;
      lastDark = dark;
      dirty = !added;
    } finally {
      user.DestroyIcon(icon);
      data.setBigInt64(32, 0n, true);
    }
  }

  publish();
  // Message-only windows do not receive TaskbarCreated. Re-register if Explorer recreates the taskbar.
  const recovery = setInterval(publish, 5000);
  return {
    setAppearance(next: TrayAppearance): void {
      if (appearance === next) return;
      appearance = next;
      dirty = true;
      publish();
    },
    update(name?: string, next?: number, charging?: boolean): void {
      const caption = name ? batteryTooltip(name, next, charging) : "Mouse desconectado";
      if (level === next && tooltip === caption) return;
      level = next;
      tooltip = caption;
      dirty = true;
      publish();
    },
    remove(): void {
      clearInterval(recovery);
      data.setUint32(20, 0, true);
      if (added) shell.Shell_NotifyIconW(NIM_DELETE, entry);
      user.DestroyWindow(hwnd);
    },
  };
}
