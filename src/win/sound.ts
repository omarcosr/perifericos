import { address, dll, view } from "./ffi";

const notes: readonly (readonly [frequency: number, ms: number][])[] = [
  [], [[720, 130]], [[650, 90], [0, 45], [650, 115]], [[520, 105], [820, 140]], [[820, 105], [520, 150]],
];
const SAMPLE_RATE = 24000;
let playback: ReturnType<typeof openPlayer> | undefined;
let current: Uint8Array | undefined;

function openPlayer() {
  return dll("winmm", { PlaySoundW: { args: ["i64", "i64", "u32"], returns: "i32" } });
}

function wave(sound: number): Uint8Array | undefined {
  const sequence = notes[sound];
  if (!sequence?.length) return undefined;
  const frames = sequence.reduce((total, [, ms]) => total + ms * SAMPLE_RATE / 1000, 0);
  const bytes = new Uint8Array(44 + frames * 2);
  const data = view(bytes);
  const encoder = new TextEncoder();
  bytes.set(encoder.encode("RIFF"), 0);
  data.setUint32(4, bytes.length - 8, true);
  bytes.set(encoder.encode("WAVEfmt "), 8);
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true); // PCM
  data.setUint16(22, 1, true); // mono
  data.setUint32(24, SAMPLE_RATE, true);
  data.setUint32(28, SAMPLE_RATE * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  bytes.set(encoder.encode("data"), 36);
  data.setUint32(40, frames * 2, true);
  let sample = 0;
  for (const [frequency, ms] of sequence) {
    const count = ms * SAMPLE_RATE / 1000;
    for (let i = 0; i < count; i++, sample++) {
      const envelope = Math.min(1, i / 192, (count - i - 1) / 600);
      data.setInt16(44 + sample * 2, 4000 * envelope * Math.sin(2 * Math.PI * frequency * i / SAMPLE_RATE), true);
    }
  }
  return bytes;
}

export function stopSound(): void {
  if (current) playback?.PlaySoundW(0n, 0n, 0);
  current = undefined;
}

export function playSound(sound: number): boolean {
  const bytes = wave(sound);
  if (!bytes) return false;
  playback ??= openPlayer();
  stopSound();
  current = bytes; // SND_MEMORY | SND_ASYNC retains the sample pointer until playback ends.
  if (playback.PlaySoundW(address(current), 0n, 0x07)) return true;
  current = undefined;
  return false;
}
