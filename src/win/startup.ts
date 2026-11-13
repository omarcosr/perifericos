import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dll, pointer, systemDirectory, view, wide } from "./ffi";
import { kernel, readWidePointer, WindowsError } from "./kernel";

const TASK = "Perifericos Tarve";

export function packaged(): boolean {
  if (process.versions.tjs) return true;
  if (process.versions.bun) return process.argv[1]?.includes("$bunfs") ?? false;
  const require = createRequire(import.meta.url);
  return (require("node:sea") as { isSea(): boolean }).isSea();
}

function schtasks(args: string[]): { status: number | null; output: string } {
  const result = spawnSync(`${systemDirectory}\\schtasks.exe`, args, {
    windowsHide: true, timeout: 4000, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout?.replaceAll("\0", "") ?? "" };
}

function taskEnabled(name: string): boolean {
  const { status, output } = schtasks(["/Query", "/TN", name, "/XML"]);
  return status === 0 && !/<Enabled>\s*false\s*<\/Enabled>/i.test(output);
}

export function startupEnabled(): boolean { return packaged() && taskEnabled(TASK); }

function userSid(): string {
  const security = dll("advapi32", {
    OpenProcessToken: { args: ["i64", "u32", "buffer"], returns: "i32" },
    GetTokenInformation: { args: ["i64", "i32", "buffer", "u32", "buffer"], returns: "i32" },
    ConvertSidToStringSidW: { args: ["i64", "buffer"], returns: "i32" },
  });
  const { LocalFree } = dll("kernel32", { LocalFree: { args: ["i64"], returns: "i64" } });
  const out = new Uint8Array(8);
  if (!security.OpenProcessToken(kernel.GetCurrentProcess(), 8, out)) throw new WindowsError("OpenProcessToken");
  const token = pointer(out);
  try {
    const user = new Uint8Array(96); // TOKEN_USER plus space for a SECURITY_MAX_SID_SIZE SID.
    const length = new Uint8Array(4);
    if (!security.GetTokenInformation(token, 1, user, user.length, length)) throw new WindowsError("GetTokenInformation");
    if (!security.ConvertSidToStringSidW(view(user).getBigInt64(0, true), out)) throw new WindowsError("ConvertSidToStringSidW");
    const text = pointer(out);
    try { return readWidePointer(text); }
    finally { LocalFree(text); }
  } finally {
    kernel.CloseHandle(token);
  }
}

export function setStartup(enabled: boolean): void {
  if (!packaged()) throw new Error("Use o executável da pasta dist para ativar a inicialização.");
  if (enabled) {
    const sid = userSid();
    if (taskEnabled(`HS80 MAX - ${sid}`)) {
      throw new Error("Desative a inicialização do controle anterior do HS80 para ativar esta versão.");
    }
    registerTask(sid);
  } else {
    schtasks(["/Delete", "/TN", TASK, "/F"]);
  }
  if (startupEnabled() !== enabled) {
    throw new Error("O Agendador de Tarefas recusou a alteração.");
  }
}

function registerTask(sid: string): void {
  const path = process.execPath.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${sid}</UserId><Delay>PT15S</Delay></LogonTrigger></Triggers>
  <Principals><Principal id="User"><UserId>${sid}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><Enabled>true</Enabled></Settings>
  <Actions Context="User"><Exec><Command>${path}</Command><Arguments>--run</Arguments></Exec></Actions>
</Task>`;
  const temp = mkdtempSync(join(tmpdir(), "perifericos-task-"));
  const definition = join(temp, "task.xml");
  try {
    writeFileSync(definition, wide(`\uFEFF${xml}`).subarray(0, -2));
    if (schtasks(["/Create", "/TN", TASK, "/XML", definition, "/F"]).status !== 0) {
      throw new Error("O Agendador de Tarefas recusou a criação da tarefa.");
    }
  } finally {
    rmSync(definition, { force: true });
    kernel.RemoveDirectoryW(wide(temp));
  }
}
