import { getCtx, out } from "./audio-bus";

function noise(c: AudioContext, duration: number, shape: (x: number) => number): AudioBufferSourceNode {
  const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * shape(i / data.length);
  const source = c.createBufferSource();
  source.buffer = buffer;
  return source;
}

export function click(): void {
  const c = getCtx(); const destination = out(); if (!c || !destination) return;
  const t = c.currentTime;
  const source = noise(c, 0.03, (x) => Math.pow(1 - x, 6));
  const filter = c.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 2400;
  const gain = c.createGain(); gain.gain.value = 0.35;
  source.connect(filter).connect(gain).connect(destination); source.start(t);
  const osc = c.createOscillator(); const oscGain = c.createGain();
  osc.frequency.setValueAtTime(180, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
  oscGain.gain.setValueAtTime(0.12, t); oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(oscGain).connect(destination); osc.start(t); osc.stop(t + 0.06);
}

export function hiss(duration = 0.35): void {
  const c = getCtx(); const destination = out(); if (!c || !destination) return;
  const source = noise(c, duration, (x) => Math.sin(Math.PI * x));
  const filter = c.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = 3000;
  const gain = c.createGain(); gain.gain.value = 0.05;
  source.connect(filter).connect(gain).connect(destination); source.start();
}

export function printer(): void {
  const c = getCtx(); const destination = out(); if (!c || !destination) return;
  for (let k = 0; k < 14; k++) {
    const t = c.currentTime + k * 0.06;
    const osc = c.createOscillator(); osc.type = "square"; osc.frequency.value = 900 + (k % 2) * 150;
    const gain = c.createGain(); gain.gain.setValueAtTime(0.03, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain).connect(destination); osc.start(t); osc.stop(t + 0.05);
  }
}

export function kick808(power = 1, length = 1.1): void {
  const c = getCtx(); const destination = out(); if (!c || !destination) return;
  const t = c.currentTime; const osc = c.createOscillator(); const gain = c.createGain();
  osc.type = "sine"; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
  gain.gain.setValueAtTime(0.9 * power, t); gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  osc.connect(gain).connect(destination); osc.start(t); osc.stop(t + length + 0.05);
}

export function shutter(): void {
  const c = getCtx(); const destination = out(); if (!c || !destination) return;
  for (const offset of [0, 0.07]) {
    const source = noise(c, 0.04, (x) => Math.pow(1 - x, 3));
    const filter = c.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = 1800;
    const gain = c.createGain(); gain.gain.value = 0.4;
    source.connect(filter).connect(gain).connect(destination); source.start(c.currentTime + offset);
  }
}

export function thud(): void {
  const c = getCtx(); const destination = out(); if (!c || !destination) return;
  const t = c.currentTime; const osc = c.createOscillator(); const gain = c.createGain();
  osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
  gain.gain.setValueAtTime(0.6, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(gain).connect(destination); osc.start(t); osc.stop(t + 0.16);
}

export function radioDial(): void {
  const c = getCtx();
  const destination = out();
  if (!c || !destination) return;
  const t = c.currentTime;
  for (let i = 0; i < 10; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220 + i * 42, t + i * 0.045);
    osc.frequency.exponentialRampToValueAtTime(90 + i * 12, t + i * 0.045 + 0.06);
    gain.gain.setValueAtTime(0.02, t + i * 0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.045 + 0.08);
    osc.connect(gain).connect(destination);
    osc.start(t + i * 0.045);
    osc.stop(t + i * 0.045 + 0.09);
  }
  hiss(0.22);
}
