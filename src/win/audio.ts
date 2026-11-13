import { address, dll, guid, pointer, view } from "./ffi";
import { readWidePointer, WindowsError } from "./kernel";

const ole = dll("ole32", {
  CoInitializeEx: { args: ["i64", "u32"], returns: "i32" },
  CoUninitialize: { args: [], returns: "void" },
  CoCreateInstance: { args: ["buffer", "i64", "u32", "buffer", "buffer"], returns: "i32" },
  PropVariantClear: { args: ["buffer"], returns: "i32" },
});
const { DispCallFunc } = dll("oleaut32", {
  DispCallFunc: { args: ["i64", "i64", "i32", "u16", "u32", "buffer", "buffer", "buffer"], returns: "i32" },
});

const CLSID_ENUMERATOR = guid("bcde0395-e52f-467c-8e3d-c4579291692e");
const IID_ENUMERATOR = guid("a95664d2-9614-4f35-a746-de8db63617e6");
const IID_VOLUME = guid("5cdf2c82-841e-4546-9722-0cf74078229a");
const FRIENDLY_NAME = new Uint8Array(20);
FRIENDLY_NAME.set(guid("a45c254e-df1c-4efd-8020-67d146a850e0"));
view(FRIENDLY_NAME).setUint32(16, 14, true);

const VT_I4 = 3;
const VT_UI4 = 19;
const VT_UI8 = 21;
const VT_LPWSTR = 31;
const CC_STDCALL = 4;
const VARIANT_SIZE = 24;
const pinnedVariants = new Set<Uint8Array>();

function check(result: number, operation: string): void {
  if (result < 0) throw new WindowsError(operation, result);
}

// DispCallFunc invokes a COM vtable slot on x64. An address is passed as VT_UI8,
// which uses the same integer calling convention as a pointer on this target.
function call(object: bigint, slot: number, args: (bigint | number)[], returnType = VT_I4): number {
  const values = new Uint8Array(args.length * VARIANT_SIZE);
  const types = new Uint8Array(Math.max(1, args.length) * 2);
  const pointers = new Uint8Array(Math.max(1, args.length) * 8);
  const result = new Uint8Array(VARIANT_SIZE);
  const valueView = view(values), typeView = view(types), pointerView = view(pointers);
  const start = args.length ? address(values) : 0n;
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    const offset = i * VARIANT_SIZE;
    const type = typeof value === "bigint" ? VT_UI8 : VT_I4;
    typeView.setUint16(i * 2, type, true);
    valueView.setUint16(offset, type, true);
    if (typeof value === "bigint") valueView.setBigUint64(offset + 8, value, true);
    else valueView.setInt32(offset + 8, value, true);
    pointerView.setBigInt64(i * 8, start + BigInt(offset), true);
  }
  pinnedVariants.add(values);
  try {
    check(DispCallFunc(object, BigInt(slot * 8), CC_STDCALL, returnType, args.length, types, pointers, result), "DispCallFunc");
  } finally {
    pinnedVariants.delete(values);
  }
  return view(result).getInt32(8, true);
}

function release(object: bigint): void {
  if (object) call(object, 2, [], VT_UI4);
}

function endpointName(device: bigint): string {
  const out = new Uint8Array(8);
  check(call(device, 4, [0, address(out)]), "IMMDevice.OpenPropertyStore");
  const store = pointer(out);
  const value = new Uint8Array(VARIANT_SIZE);
  try {
    check(call(store, 5, [address(FRIENDLY_NAME), address(value)]), "IPropertyStore.GetValue");
    return view(value).getUint16(0, true) === VT_LPWSTR ? readWidePointer(pointer(value, 8)) : "";
  } finally {
    ole.PropVariantClear(value);
    release(store);
  }
}

export interface CaptureEndpoint {
  name: string;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  close(): void;
}

export class CoreAudio {
  private initialized = false;

  private enumerate(use: (device: bigint, name: string) => void): void {
    if (!this.initialized) {
      // The device loop and its COM calls all run on the JS thread.
      const result = ole.CoInitializeEx(0n, 2);
      check(result, "CoInitializeEx");
      this.initialized = true;
    }
    const out = new Uint8Array(8);
    check(ole.CoCreateInstance(CLSID_ENUMERATOR, 0n, 23, IID_ENUMERATOR, out), "MMDeviceEnumerator");
    const enumerator = pointer(out);
    let collection = 0n;
    try {
      check(call(enumerator, 3, [1, 1, address(out)]), "EnumAudioEndpoints");
      collection = pointer(out);
      const count = new Uint8Array(4);
      check(call(collection, 3, [address(count)]), "IMMDeviceCollection.GetCount");
      for (let i = 0; i < view(count).getUint32(0, true); i++) {
        if (call(collection, 4, [i, address(out)]) < 0) continue;
        const device = pointer(out);
        try { use(device, endpointName(device)); }
        finally { release(device); }
      }
    } finally {
      release(collection);
      release(enumerator);
    }
  }

  names(): string[] {
    const names: string[] = [];
    this.enumerate((_device, name) => { if (name) names.push(name); });
    return names;
  }

  capture(matches: (name: string) => boolean): CaptureEndpoint | undefined {
    let endpoint: CaptureEndpoint | undefined;
    try {
      this.enumerate((device, name) => {
        if (!matches(name)) return;
        if (endpoint) throw new Error("Há mais de uma entrada de áudio com esse nome.");
        const out = new Uint8Array(8);
        check(call(device, 3, [address(IID_VOLUME), 23, 0n, address(out)]), "IMMDevice.Activate");
        let volume = pointer(out);
        const mute = new Uint8Array(4);
        endpoint = {
          name,
          isMuted() {
            check(call(volume, 15, [address(mute)]), "IAudioEndpointVolume.GetMute");
            return view(mute).getInt32(0, true) !== 0;
          },
          setMuted(value) { check(call(volume, 14, [value ? 1 : 0, 0n]), "IAudioEndpointVolume.SetMute"); },
          close() { release(volume); volume = 0n; },
        };
      });
      return endpoint;
    } catch (error) {
      endpoint?.close();
      throw error;
    }
  }

  close(): void {
    if (this.initialized) ole.CoUninitialize();
    this.initialized = false;
  }
}
