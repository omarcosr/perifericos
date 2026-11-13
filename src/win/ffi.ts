import { createRequire } from "node:module";

type Abi = "i32" | "u32" | "u16" | "u8" | "i64" | "buffer" | "void";
type Signature = { args: readonly Abi[]; returns: Abi };
type Value<T> = T extends "i64" ? bigint : T extends "buffer" ? Uint8Array : T extends "void" ? void : number;
type Args<T extends readonly Abi[]> = { -readonly [K in keyof T]: Value<T[K]> };
type Symbols<S extends Record<string, Signature>> = {
  [K in keyof S]: (...args: Args<S[K]["args"]>) => Value<S[K]["returns"]>;
};

interface CommonFfi {
  dlopen(path: string, symbols: Record<string, Signature>): { symbols: Record<string, Function> };
}
interface TxikiFfi extends CommonFfi { bufferToPointer(bytes: Uint8Array): { toString(): string } }
interface BunFfi extends CommonFfi { ptr(bytes: Uint8Array): number }
interface NodeFfi {
  getRawPointer(bytes: Uint8Array): bigint;
  dlopen(path: string, definitions: unknown): { functions: Record<string, Function> };
}

const require = createRequire(import.meta.url);
const txiki = (globalThis as { __tarveTxikiFfi?: TxikiFfi }).__tarveTxikiFfi;
const bun = !txiki && process.versions.bun ? require("bun:ffi") as BunFfi : undefined;
const node = !txiki && !bun ? require("node:ffi") as NodeFfi : undefined;
const nodeTypes: Record<Abi, string> = {
  i32: "int32", u32: "uint32", u16: "uint16", u8: "uint8", i64: "int64", buffer: "buffer", void: "void",
};
const libraries: unknown[] = [];

export const runtime = txiki ? "QuickJS" : bun ? "Bun" : "Node";
export const systemDirectory = `${process.env.SystemRoot ?? process.env.WINDIR ?? "C:\\Windows"}\\System32`;

export function dll<const S extends Record<string, Signature>>(name: string, definitions: S): Symbols<S> {
  const path = `${systemDirectory}\\${name}.dll`;
  let functions: Record<string, Function>;
  if (node) {
    const signatures = Object.fromEntries(Object.entries(definitions).map(([key, sig]) => [key, {
      arguments: sig.args.map(type => nodeTypes[type]), return: nodeTypes[sig.returns],
    }]));
    const library = node.dlopen(path, signatures);
    libraries.push(library);
    functions = library.functions;
  } else {
    const library = (txiki ?? bun)!.dlopen(path, definitions);
    libraries.push(library);
    functions = library.symbols;
  }
  return Object.fromEntries(Object.entries(definitions).map(([key, sig]) => {
    const call = functions[key];
    const invoke = txiki && sig.args.includes("i64")
      ? (...args: unknown[]) => call(...args.map((value, i) => sig.args[i] === "i64" ? Number(value) : value))
      : call;
    return [key, sig.returns === "i64" ? (...args: unknown[]) => BigInt(invoke(...args)) : invoke];
  })) as Symbols<S>;
}

export function address(bytes: Uint8Array | null): bigint {
  if (!bytes) return 0n;
  if (txiki) return BigInt(txiki.bufferToPointer(bytes).toString());
  if (bun) return BigInt(bun.ptr(bytes));
  return node!.getRawPointer(bytes);
}

export function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function wide(text: string): Uint8Array {
  const bytes = new Uint8Array((text.length + 1) * 2);
  const data = view(bytes);
  for (let i = 0; i < text.length; i++) data.setUint16(i * 2, text.charCodeAt(i), true);
  return bytes;
}

export function fromWide(bytes: Uint8Array, offset = 0): string {
  const data = view(bytes);
  let text = "";
  for (let i = offset; i + 1 < bytes.length; i += 2) {
    const unit = data.getUint16(i, true);
    if (!unit) break;
    text += String.fromCharCode(unit);
  }
  return text;
}

export function pointer(bytes: Uint8Array, offset = 0): bigint {
  return view(bytes).getBigInt64(offset, true);
}

export function guid(text: string): Uint8Array {
  const [first, second, third, fourth, fifth] = text.split("-");
  const bytes = new Uint8Array(16);
  const data = view(bytes);
  data.setUint32(0, Number.parseInt(first, 16), true);
  data.setUint16(4, Number.parseInt(second, 16), true);
  data.setUint16(6, Number.parseInt(third, 16), true);
  for (let i = 0; i < 8; i++) bytes[8 + i] = Number.parseInt((fourth + fifth).slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
