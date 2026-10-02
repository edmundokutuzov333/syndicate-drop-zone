// Synthesized "leaked tape" loops: distorted 808s + tape hiss, generated with Web Audio.
export type TapeSpec = { bpm: number; root: number; pattern: number[]; hat: number };

export class TapeEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  timer: number | null = null;
  hiss: AudioBufferSourceNode | null = null;
  analyser: AnalyserNode | null = null;

  start(spec: TapeSpec) {
    this.stop();
    const ctx = this.ctx ?? new AudioContext();
    this.ctx = ctx;
    void ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 512) - 1;
      curve[i] = Math.tanh(x * 3.2);
    }
    shaper.curve = curve;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    master.connect(shaper).connect(lp).connect(analyser).connect(ctx.destination);
    this.master = master;
    this.analyser = analyser;

    // tape hiss
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.035;
    const hiss = ctx.createBufferSource();
    hiss.buffer = buf;
    hiss.loop = true;
    hiss.connect(lp);
    hiss.start();
    this.hiss = hiss;

    const step = 60 / spec.bpm / 4;
    let n = 0;
    let next = ctx.currentTime + 0.05;
    const tick = () => {
      while (next < ctx.currentTime + 0.2) {
        const s = n % 16;
        const note = spec.pattern[s] ?? -1;
        if (note >= 0) this.kick808(next, spec.root * Math.pow(2, note / 12));
        if (s % spec.hat === 0) this.hat(next, s % 4 === 2 ? 0.12 : 0.05);
        if (s === 4 || s === 12) this.snare(next);
        next += step;
        n++;
      }
    };
    tick();
    this.timer = window.setInterval(tick, 50);
  }

  kick808(t: number, f: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f * 3, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.75);
  }

  hat(t: number, v: number) {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = b;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(hp).connect(g).connect(this.master!);
    s.start(t);
  }

  snare(t: number) {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = b;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.connect(bp).connect(g).connect(this.master!);
    s.start(t);
  }

  level(): number {
    if (!this.analyser) return 0;
    const a = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(a);
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += a[i] ?? 0;
    return sum / (16 * 255);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.hiss?.stop();
    this.hiss = null;
    this.master?.disconnect();
    this.master = null;
  }
}
