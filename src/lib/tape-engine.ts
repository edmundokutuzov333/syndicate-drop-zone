// Plays real 30s studio snippets with an analog tape-hiss layer on top.
export type TapeSpec = { src: string };

export class TapeEngine {
  ctx: AudioContext | null = null;
  audio: HTMLAudioElement | null = null;
  analyser: AnalyserNode | null = null;
  hiss: AudioBufferSourceNode | null = null;
  node: MediaElementAudioSourceNode | null = null;

  start(spec: TapeSpec, onEnd?: () => void) {
    this.stop();
    const ctx = this.ctx ?? new AudioContext();
    this.ctx = ctx;
    void ctx.resume();
    const audio = new Audio(spec.src);
    audio.crossOrigin = "anonymous";
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const node = ctx.createMediaElementSource(audio);
    node.connect(analyser).connect(ctx.destination);

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.02;
    const hiss = ctx.createBufferSource();
    hiss.buffer = buf;
    hiss.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2500;
    hiss.connect(hp).connect(ctx.destination);
    hiss.start();

    audio.onended = () => { this.stop(); onEnd?.(); };
    void audio.play();
    Object.assign(this, { audio, analyser, hiss, node });
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
    this.audio?.pause();
    this.audio = null;
    this.node?.disconnect();
    this.node = null;
    this.hiss?.stop();
    this.hiss = null;
    this.analyser = null;
  }
}
