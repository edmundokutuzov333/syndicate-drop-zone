import { getCtx, out } from "./audio-bus";
import { track } from "./track";
import { grantKey } from "./key";

export type Track = { id: string; title: string; feat: string; src: string };

export type TapeState = { id: string | null; playing: boolean; t: number; dur: number; error: boolean };

export const IDLE_STATE: TapeState = { id: null, playing: false, t: 0, dur: 0, error: false };

export class TapeEngine {
  private audio: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> | null = null;
  private hissGain: GainNode | null = null;
  private current: Track | null = null;
  private queue: Track[] = [];
  private state: TapeState = IDLE_STATE;
  private subscribers = new Set<() => void>();
  private tenSecondMarks = new Set<string>();

  getState = (): TapeState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  };

  setQueue(queue: readonly Track[]): void {
    this.queue = queue.map(({ id, title, feat, src }) => ({ id, title, feat, src }));
  }

  getQueue(): Track[] {
    return this.queue;
  }

  getCurrentTrack(): Track | null {
    return this.current;
  }

  private set(patch: Partial<TapeState>): void {
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach((listener) => listener());
  }

  private boot(): HTMLAudioElement | null {
    if (this.audio) return this.audio;
    const c = getCtx();
    const destination = out();
    if (!c || !destination) return null;

    const audio = new Audio();
    audio.preload = "none";
    audio.crossOrigin = "anonymous";

    const source = c.createMediaElementSource(audio);
    const analyser = c.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser).connect(destination);

    const noiseBuffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * 2)), c.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.02;

    const hissSource = c.createBufferSource();
    hissSource.buffer = noiseBuffer;
    hissSource.loop = true;
    const highPass = c.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = 2500;
    const hissGain = c.createGain();
    hissGain.gain.value = 0;
    hissSource.connect(highPass).connect(hissGain).connect(destination);
    hissSource.start();

    audio.addEventListener("timeupdate", () => {
      this.set({ t: audio.currentTime });
      if (this.current && audio.currentTime >= 10 && !this.tenSecondMarks.has(this.current.id)) {
        this.tenSecondMarks.add(this.current.id);
        grantKey();
        track("tape_10s", { tape: this.current.id });
        track("key_earned", { tape: this.current.id });
      }
    });
    audio.addEventListener("loadedmetadata", () => this.set({ dur: Number.isFinite(audio.duration) ? audio.duration : 0 }));
    audio.addEventListener("play", () => {
      this.set({ playing: true, error: false });
      this.fadeHiss(0.9);
      if (this.current) track("tape_play", { tape: this.current.id });
    });
    audio.addEventListener("pause", () => {
      this.set({ playing: false });
      this.fadeHiss(0);
    });
    audio.addEventListener("ended", () => {
      if (!this.next()) this.stop();
    });
    audio.addEventListener("error", () => {
      this.set({ playing: false, error: true });
      this.fadeHiss(0);
    });

    this.audio = audio;
    this.analyser = analyser;
    this.bins = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    this.hissGain = hissGain;
    return audio;
  }

  private fadeHiss(value: number): void {
    const c = getCtx();
    if (c && this.hissGain) this.hissGain.gain.setTargetAtTime(value, c.currentTime, 0.08);
  }

  play(trackValue: Track): void {
    const audio = this.boot();
    if (!audio) return;
    this.setQueue(this.queue.length ? this.queue : [trackValue]);
    const sameTrack = this.current?.id === trackValue.id;

    if (!sameTrack) {
      this.current = { ...trackValue };
      audio.src = trackValue.src;
      audio.load();
      this.set({ id: trackValue.id, t: 0, dur: 0, error: false });
      this.media(trackValue);
    }

    const promise = audio.play();
    if (promise && typeof promise.catch === "function") {
      void promise.catch(() => this.set({ playing: false, error: true }));
    }
  }

  toggle(trackValue: Track): void {
    if (this.state.id === trackValue.id && this.state.playing) this.pause();
    else this.play(trackValue);
  }

  pause(): void {
    this.audio?.pause();
  }

  stop(): void {
    this.audio?.pause();
    if (this.audio) this.audio.removeAttribute("src");
    this.current = null;
    this.set({ ...IDLE_STATE });
  }

  seek(seconds: number): void {
    if (!this.audio || !Number.isFinite(seconds)) return;
    const limit = this.state.dur || seconds;
    this.audio.currentTime = Math.max(0, Math.min(seconds, limit));
  }

  next(): boolean {
    return this.step(1);
  }

  prev(): boolean {
    return this.step(-1);
  }

  private step(direction: 1 | -1): boolean {
    const index = this.queue.findIndex((item) => item.id === this.state.id);
    const nextTrack = index < 0 ? undefined : this.queue[index + direction];
    if (!nextTrack) return false;
    this.play(nextTrack);
    return true;
  }

  level(): number {
    if (!this.analyser || !this.bins) return 0;
    this.analyser.getByteFrequencyData(this.bins);
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += this.bins[i] ?? 0;
    return sum / (16 * 255);
  }

  private media(trackValue: Track): void {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackValue.title,
        artist: trackValue.feat,
        album: "O Sindicato do Trap — 1ª Edição",
      });
      navigator.mediaSession.setActionHandler("play", () => void this.audio?.play());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => void this.next());
      navigator.mediaSession.setActionHandler("previoustrack", () => void this.prev());
    } catch {
      // Media Session is optional.
    }
  }
}

export const tape = new TapeEngine();
