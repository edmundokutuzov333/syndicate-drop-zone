// Resposta de impulso determinística para reverberação curta de uma sala pequena.
export type IrOptions = { sampleRate: number; rt60: number; preDelayMs: number; brightness: number; seed: number };
export const IR_DEFAULTS: IrOptions = { sampleRate: 48000, rt60: 0.42, preDelayMs: 7, brightness: 0.55, seed: 808 };

function mulberry32(seed: number) {
  return () => {
    let a = seed | 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    seed = a;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeImpulseResponse(options: Partial<IrOptions> = {}): [Float32Array, Float32Array] {
  const p = { ...IR_DEFAULTS, ...options };
  const sampleRate = Math.max(8000, Math.floor(p.sampleRate));
  const rt60 = Math.max(0.05, p.rt60);
  const preDelayMs = Math.max(0, Math.min(100, p.preDelayMs));
  const brightness = Math.max(0.01, Math.min(1, p.brightness));
  const length = Math.max(1, Math.floor(sampleRate * (rt60 * 1.15 + preDelayMs / 1000)));
  const preDelay = Math.floor((preDelayMs / 1000) * sampleRate);
  const output: [Float32Array, Float32Array] = [new Float32Array(length), new Float32Array(length)];

  for (let channel = 0; channel < 2; channel += 1) {
    const random = mulberry32((p.seed | 0) + channel * 7919);
    const buffer = output[channel]!;
    let lowPass = 0;
    for (let i = preDelay; i < length; i += 1) {
      const t = (i - preDelay) / sampleRate;
      const envelope = Math.pow(10, (-3 * t) / rt60);
      const cutoff = brightness * Math.exp(-t * 3.2) + 0.04;
      lowPass += (((random() * 2 - 1) * envelope) - lowPass) * Math.min(1, cutoff);
      buffer[i] = lowPass;
    }
    for (const [ms, gain] of [[11, 0.5], [17, 0.38], [26, 0.3]] as const) {
      const index = preDelay + Math.floor((ms / 1000) * sampleRate + channel * 9);
      if (index < length) buffer[index] = (buffer[index] ?? 0) + gain * (channel ? -1 : 1);
    }
  }

  let peak = 1e-9;
  for (const channel of output) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  for (const channel of output) for (let i = 0; i < channel.length; i += 1) channel[i] = (channel[i] ?? 0) / peak * 0.9;
  return output;
}
