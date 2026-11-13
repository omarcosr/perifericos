import { dll, fromWide, view, wide } from "./ffi";

export const kernel = dll("kernel32", {
  GetLastError: { args: [], returns: "u32" },
  CloseHandle: { args: ["i64"], returns: "i32" },
  RemoveDirectoryW: { args: ["buffer"], returns: "i32" },
  CreateFileW: { args: ["buffer", "u32", "u32", "i64", "u32", "u32", "i64"], returns: "i64" },
  CreateEventW: { args: ["i64", "i32", "i32", "i64"], returns: "i64" },
  ResetEvent: { args: ["i64"], returns: "i32" },
  WaitForSingleObject: { args: ["i64", "u32"], returns: "u32" },
  ReadFile: { args: ["i64", "buffer", "u32", "buffer", "buffer"], returns: "i32" },
  WriteFile: { args: ["i64", "buffer", "u32", "buffer", "buffer"], returns: "i32" },
  GetOverlappedResult: { args: ["i64", "buffer", "buffer", "i32"], returns: "i32" },
  CancelIoEx: { args: ["i64", "buffer"], returns: "i32" },
  CreateMutexW: { args: ["i64", "i32", "buffer"], returns: "i64" },
  ReleaseMutex: { args: ["i64"], returns: "i32" },
  GetCurrentProcess: { args: [], returns: "i64" },
  ReadProcessMemory: { args: ["i64", "i64", "buffer", "i64", "i64"], returns: "i32" },
  lstrlenW: { args: ["i64"], returns: "i32" },
  CreateToolhelp32Snapshot: { args: ["u32", "u32"], returns: "i64" },
  Process32FirstW: { args: ["i64", "buffer"], returns: "i32" },
  Process32NextW: { args: ["i64", "buffer"], returns: "i32" },
});

export const INVALID_HANDLE = -1n;

export class WindowsError extends Error {
  constructor(operation: string, readonly code = kernel.GetLastError()) {
    super(`${operation} (${(code >>> 0).toString(16).padStart(8, "0")})`);
  }
}

export function readWidePointer(ptr: bigint): string {
  if (!ptr) return "";
  const length = kernel.lstrlenW(ptr);
  if (length < 0 || length > 4096) return "";
  const bytes = new Uint8Array((length + 1) * 2);
  if (!kernel.ReadProcessMemory(kernel.GetCurrentProcess(), ptr, bytes, BigInt(bytes.length), 0n)) {
    throw new WindowsError("ReadProcessMemory");
  }
  return fromWide(bytes);
}

export function isProcessRunning(name: string): boolean {
  const snapshot = kernel.CreateToolhelp32Snapshot(2, 0);
  if (snapshot === INVALID_HANDLE) throw new WindowsError("CreateToolhelp32Snapshot");
  try {
    // PROCESSENTRY32W on Windows x64. szExeFile follows the fixed-size fields.
    const entry = new Uint8Array(568);
    view(entry).setUint32(0, entry.length, true);
    const target = name.toLowerCase();
    for (let ok = kernel.Process32FirstW(snapshot, entry); ok; ok = kernel.Process32NextW(snapshot, entry)) {
      if (fromWide(entry, 44).toLowerCase() === target) return true;
    }
    return false;
  } finally {
    kernel.CloseHandle(snapshot);
  }
}

const legacyMutex = wide("Local\\HS80-LedsOff-Instance-marcos");

export function acquireHeadsetLease(): (() => void) | undefined {
  const mutex = kernel.CreateMutexW(0n, 1, legacyMutex);
  const error = kernel.GetLastError();
  if (!mutex) throw new WindowsError("CreateMutexW", error);
  if (error === 183) {
    kernel.CloseHandle(mutex);
    return undefined;
  }
  return () => {
    kernel.ReleaseMutex(mutex);
    kernel.CloseHandle(mutex);
  };
}
