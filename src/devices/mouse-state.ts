import type { MouseModelId } from "./catalog";

export type MouseStatus = "looking" | "disconnected" | "waiting" | "duplicate" | "unavailable" | "connected";
export interface MouseState {
  status: MouseStatus;
  model?: MouseModelId;
  path?: string;
  wireless?: boolean;
  battery?: number;
  charging?: boolean;
  dpi?: { x: number; y: number };
  polling?: number;
  rates?: readonly number[];
  profile?: number;
  dpiStage?: number;
}

export type MouseSetting = { kind: "dpi" | "polling"; value: number; previous: MouseState };

export function validDpi(value: number, { min, max }: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
