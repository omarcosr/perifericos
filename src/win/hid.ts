import { address, delay, dll, fromWide, pointer, view, wide } from "./ffi";
import { INVALID_HANDLE, kernel, WindowsError } from "./kernel";

const setup = dll("setupapi", {
  SetupDiGetClassDevsW: { args: ["buffer", "i64", "i64", "u32"], returns: "i64" },
  SetupDiEnumDeviceInterfaces: { args: ["i64", "i64", "buffer", "u32", "buffer"], returns: "i32" },
  SetupDiGetDeviceInterfaceDetailW: { args: ["i64", "buffer", "i64", "u32", "buffer", "i64"], returns: "i32" },
  SetupDiDestroyDeviceInfoList: { args: ["i64"], returns: "i32" },
});
const hid = dll("hid", {
  HidD_GetHidGuid: { args: ["buffer"], returns: "void" },
  HidD_GetAttributes: { args: ["i64", "buffer"], returns: "u8" },
  HidD_GetPreparsedData: { args: ["i64", "buffer"], returns: "u8" },
  HidD_FreePreparsedData: { args: ["i64"], returns: "u8" },
  HidP_GetCaps: { args: ["i64", "buffer"], returns: "i32" },
  HidD_SetFeature: { args: ["i64", "buffer", "u32"], returns: "u8" },
  HidD_GetFeature: { args: ["i64", "buffer", "u32"], returns: "u8" },
});

export interface HidInterface {
  path: string;
  vendor: number;
  product: number;
}
export interface HidMatch {
  vendor: number;
  products: readonly number[];
  usagePage: number;
  usage: number;
  input?: number;
  output?: number;
  feature?: number;
}

const HID_GUID = new Uint8Array(16);
hid.HidD_GetHidGuid(HID_GUID);

export function hidInterfaces(): HidInterface[] {
  const list = setup.SetupDiGetClassDevsW(HID_GUID, 0n, 0n, 0x12); // PRESENT | DEVICEINTERFACE
  if (list === INVALID_HANDLE) throw new WindowsError("SetupDiGetClassDevsW");
  const result: HidInterface[] = [];
  try {
    const iface = new Uint8Array(32);
    const size = new Uint8Array(4);
    for (let index = 0; ; index++) {
      view(iface).setUint32(0, iface.length, true);
      if (!setup.SetupDiEnumDeviceInterfaces(list, 0n, HID_GUID, index, iface)) {
        const error = kernel.GetLastError();
        if (error !== 259) throw new WindowsError("SetupDiEnumDeviceInterfaces", error);
        return result;
      }
      size.fill(0);
      setup.SetupDiGetDeviceInterfaceDetailW(list, iface, 0n, 0, size, 0n);
      const length = view(size).getUint32(0, true);
      if (length < 8 || length > 32768) continue;
      const detail = new Uint8Array(length);
      view(detail).setUint32(0, 8, true);
      if (!setup.SetupDiGetDeviceInterfaceDetailW(list, iface, address(detail), length, size, 0n)) continue;
      const path = fromWide(detail, 4);
      const ids = /vid_([\da-f]{4})&pid_([\da-f]{4})(?:[&#]|$)/i.exec(path);
      if (ids) result.push({ path, vendor: Number.parseInt(ids[1], 16), product: Number.parseInt(ids[2], 16) });
    }
  } finally {
    setup.SetupDiDestroyDeviceInfoList(list);
  }
}

function open(path: string, access = 0, flags = 0): bigint {
  return kernel.CreateFileW(wide(path), access, 3, 0n, 3, flags, 0n);
}

function attributes(handle: bigint, entry: HidInterface): boolean {
  const bytes = new Uint8Array(12);
  const data = view(bytes);
  data.setUint32(0, bytes.length, true);
  return Boolean(hid.HidD_GetAttributes(handle, bytes)) && data.getUint16(4, true) === entry.vendor &&
    data.getUint16(6, true) === entry.product;
}

function matchesCollection(entry: HidInterface, match: HidMatch): boolean {
  const handle = open(entry.path);
  if (handle === INVALID_HANDLE) return false;
  const out = new Uint8Array(8);
  try {
    if (!attributes(handle, entry) || !hid.HidD_GetPreparsedData(handle, out)) return false;
    const data = pointer(out);
    try {
      const caps = new Uint8Array(64);
      if (hid.HidP_GetCaps(data, caps) !== 0x110000) return false;
      const fields = view(caps);
      return fields.getUint16(0, true) === match.usage && fields.getUint16(2, true) === match.usagePage &&
        (!match.input || fields.getUint16(4, true) === match.input) &&
        (!match.output || fields.getUint16(6, true) === match.output) &&
        (!match.feature || fields.getUint16(8, true) === match.feature);
    } finally {
      hid.HidD_FreePreparsedData(data);
    }
  } finally {
    kernel.CloseHandle(handle);
  }
}

export function matchingHid(match: HidMatch, entries = hidInterfaces()): HidInterface[] {
  return entries.filter(entry => entry.vendor === match.vendor && match.products.includes(entry.product) &&
    matchesCollection(entry, match));
}

export class FeatureHid {
  private readonly handle: bigint;

  constructor(entry: HidInterface, access = 0) {
    this.handle = open(entry.path, access);
    if (this.handle === INVALID_HANDLE) throw new WindowsError("CreateFileW (feature)");
    if (!attributes(this.handle, entry)) {
      this.close();
      throw new Error("O dispositivo HID mudou durante a abertura.");
    }
  }

  set(bytes: Uint8Array): boolean { return Boolean(hid.HidD_SetFeature(this.handle, bytes, bytes.length)); }
  get(bytes: Uint8Array): boolean { return Boolean(hid.HidD_GetFeature(this.handle, bytes, bytes.length)); }
  close(): void { kernel.CloseHandle(this.handle); }
}

export class ReportHid {
  private readonly handle: bigint;
  private readonly event: bigint;
  private readonly overlapped = new Uint8Array(32);
  private readonly count = new Uint8Array(4);

  constructor(entry: HidInterface) {
    this.handle = open(entry.path, 0xc0000000, 0x40000000);
    if (this.handle === INVALID_HANDLE) throw new WindowsError("CreateFileW (relatórios)");
    this.event = kernel.CreateEventW(0n, 1, 0, 0n);
    if (!this.event) {
      const error = new WindowsError("CreateEventW");
      kernel.CloseHandle(this.handle);
      throw error;
    }
  }

  // Keep the packet and OVERLAPPED buffers alive until I/O completes, even after cancellation.
  async transfer(packet: Uint8Array, write: boolean): Promise<number> {
    this.overlapped.fill(0);
    view(this.overlapped).setBigInt64(24, this.event, true);
    this.count.fill(0);
    if (!kernel.ResetEvent(this.event)) throw new WindowsError("ResetEvent");
    const transfer = write ? kernel.WriteFile : kernel.ReadFile;
    if (!transfer(this.handle, packet, packet.length, this.count, this.overlapped)) {
      const error = kernel.GetLastError();
      if (error !== 997) throw new WindowsError(write ? "WriteFile" : "ReadFile", error);
      const deadline = performance.now() + 900;
      for (;;) {
        const signal = kernel.WaitForSingleObject(this.event, 0);
        if (signal === 0) break;
        if (signal !== 258 || performance.now() >= deadline) {
          const code = signal === 258 ? 1460 : kernel.GetLastError();
          kernel.CancelIoEx(this.handle, this.overlapped);
          kernel.GetOverlappedResult(this.handle, this.overlapped, this.count, 1);
          throw new WindowsError("Transferência HID", code);
        }
        await delay(8);
      }
      if (!kernel.GetOverlappedResult(this.handle, this.overlapped, this.count, 0)) {
        throw new WindowsError("GetOverlappedResult");
      }
    }
    // A read always uses the returned length and a write must have sent the entire packet.
    const transferred = view(this.count).getUint32(0, true);
    if (transferred < 6 || (write && transferred !== packet.length)) throw new Error("Relatório HID incompleto.");
    return transferred;
  }

  close(): void {
    kernel.CloseHandle(this.handle);
    kernel.CloseHandle(this.event);
  }
}
