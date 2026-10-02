// Subtle mechanical click + tape hiss blips via Web Audio.
let ctx: AudioContext | null = null;
const get = () => {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  void ctx.resume();
  return ctx;
};

export function click() {
  const c = get();
  if (!c) return;
  const t = c.currentTime;
  const b = c.createBuffer(1, c.sampleRate * 0.03, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
  const s = c.createBufferSource();
  s.buffer = b;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 2400;
  const g = c.createGain();
  g.gain.value = 0.35;
  s.connect(f).connect(g).connect(c.destination);
  s.start(t);
  const o = c.createOscillator();
  const og = c.createGain();
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.04);
  og.gain.setValueAtTime(0.12, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(og).connect(c.destination);
  o.start(t);
  o.stop(t + 0.06);
}

export function hiss(dur = 0.35) {
  const c = get();
  if (!c) return;
  const b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
  const s = c.createBufferSource();
  s.buffer = b;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 3000;
  const g = c.createGain();
  g.gain.value = 0.05;
  s.connect(f).connect(g).connect(c.destination);
  s.start();
}

export function printer() {
  const c = get();
  if (!c) return;
  for (let k = 0; k < 14; k++) {
    const t = c.currentTime + k * 0.06;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = 900 + (k % 2) * 150;
    const g = c.createGain();
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.05);
  }
}
