export const HEADSET_PACKET_SIZE = 64;
export const VIPER_PACKET_SIZE = 91;
export const VIPER_DPI_MIN = 100;
export const VIPER_DPI_MAX = 35000;

export function headsetPacket(child: number, command: number, property = 0): Uint8Array {
  const packet = new Uint8Array(HEADSET_PACKET_SIZE);
  packet.set([2, 8 | child, command, property]);
  return packet;
}

export function headsetReply(packet: Uint8Array, length: number, child: number, command: number): number | undefined {
  if (length < 6 || packet[0] !== 1 || packet[1] !== child || packet[2] !== command) return undefined;
  if (packet[3]) throw new Error(`O headset recusou o comando (${packet[3]}).`);
  return packet[4] | (packet[5] << 8);
}

export function headsetBattery(raw: number): number | undefined {
  return raw >= 0 && raw <= 1000 ? Math.floor(raw / 10) : undefined;
}

export interface ViperCommand { group: number; id: number; size: number }

function viperChecksum(report: Uint8Array): number {
  let crc = 0;
  for (let i = 3; i < 89; i++) crc ^= report[i];
  return crc;
}

export function viperReport(command: ViperCommand, args: readonly number[] = []): Uint8Array {
  const report = new Uint8Array(VIPER_PACKET_SIZE);
  if (command.size > 80 || args.length > command.size) throw new Error("Argumentos Razer inválidos.");
  report[2] = 0x1f;
  report[6] = command.size;
  report[7] = command.group;
  report[8] = command.id;
  report.set(args, 9);
  report[89] = viperChecksum(report);
  return report;
}

export function viperStatus(report: Uint8Array, command: ViperCommand): number | undefined {
  if (report.length !== VIPER_PACKET_SIZE || report[0] || report[2] !== 0x1f || report[3] || report[4] || report[5] ||
      report[7] !== command.group || report[8] !== command.id || report[6] > 80 ||
      report[89] !== viperChecksum(report) || report[1] > 5) return undefined;
  return report[1];
}

export function viperBattery(raw: number): number { return Math.floor((raw * 100 + 127) / 255); }

export function validDpi(dpi: number): boolean {
  return Number.isInteger(dpi) && dpi >= VIPER_DPI_MIN && dpi <= VIPER_DPI_MAX;
}

export function viperDpi(report: Uint8Array): { x: number; y: number } | undefined {
  if (report[6] < 5) return undefined;
  const x = (report[10] << 8) | report[11];
  const y = (report[12] << 8) | report[13];
  return validDpi(x) && validDpi(y) ? { x, y } : undefined;
}

export function pollingChoices(wireless: boolean): readonly number[] {
  return wireless ? [125, 500, 1000, 2000, 4000, 8000] : [125, 500, 1000];
}

export function pollingCode(wireless: boolean, hz: number): number | undefined {
  return pollingChoices(wireless).includes(hz) ? (wireless ? 8000 : 1000) / hz : undefined;
}

export function pollingHz(wireless: boolean, code: number): number | undefined {
  const base = wireless ? 8000 : 1000;
  return code && code <= base / 125 && !(code & (code - 1)) ? base / code : undefined;
}
