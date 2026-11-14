import { describe, expect, test } from "bun:test";
import { viper } from "../src/devices/catalog";
import { headsetBattery, headsetPacket, headsetReply, pollingCode, pollingHz, viperCharging, viperDpi, viperReport, viperStatus } from "../src/devices/protocol";
import { validDpi } from "../src/devices/mouse-state";

describe("relatórios do HS80 MAX", () => {
  test("valida a resposta do filho e o código do comando", () => {
    const request = headsetPacket(1, 2, 0xa6);
    expect(request.length).toBe(64);
    expect([...request.subarray(0, 4)]).toEqual([2, 9, 2, 0xa6]);
    expect(headsetReply(Uint8Array.of(1, 0, 2, 0, 1, 0), 6, 1, 2)).toBeUndefined();
    expect(headsetReply(Uint8Array.of(1, 1, 2, 0, 1, 0), 6, 1, 2)).toBe(1);
    expect(() => headsetReply(Uint8Array.of(1, 1, 2, 3, 0, 0), 6, 1, 2)).toThrow();
    expect(headsetBattery(999)).toBe(99);
    expect(headsetBattery(1001)).toBeUndefined();
  });
});

describe("relatórios do Viper V3 Pro", () => {
  test("valida a resposta, os eixos e a soma de verificação", () => {
    const command = { group: 4, id: 0x85, size: 7 };
    const report = viperReport(command, [1, 5, 20, 5, 20, 0, 0]);
    report[1] = 2;
    expect(viperStatus(report, command)).toBe(2);
    expect(viperDpi(report)).toEqual({ x: 1300, y: 1300 });
    report[10] ^= 1;
    expect(viperStatus(report, command)).toBeUndefined();
  });

  test("respeita os limites de DPI e polling de cada conexão", () => {
    expect(validDpi(100, viper.dpi)).toBe(true);
    expect(validDpi(35000, viper.dpi)).toBe(true);
    expect(validDpi(35001, viper.dpi)).toBe(false);
    expect(validDpi(100.5, viper.dpi)).toBe(false);
    expect(pollingCode(false, 8000)).toBeUndefined();
    expect(pollingHz(true, pollingCode(true, 8000)!)).toBe(8000);
    expect(pollingHz(false, 3)).toBeUndefined();
  });

  test("distingue carga, descarga e status sem leitura", () => {
    const command = { group: 7, id: 0x84, size: 2 };
    expect(viperCharging(viperReport(command, [0, 1]))).toBe(true);
    expect(viperCharging(viperReport(command, [0, 0]))).toBe(false);
    expect(viperCharging(viperReport(command, [0, 0xff]))).toBeUndefined();
    expect(viperCharging(viperReport({ ...command, size: 1 }))).toBeUndefined();
    expect(viperCharging()).toBeUndefined();
  });
});
