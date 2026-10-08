import { getCtx, out } from "@/lib/audio-bus";
import { getLiveTapes } from "@/lib/site-content";
import { getFrequencyClock, getFrequencyListenerCount, sendFrequencyHeartbeat, awardNightListener } from "@/lib/frequency-api";
import { kick808, radioDial } from "@/lib/sfx";
import { tape } from "@/lib/tape-engine";
import { TAPES as STATIC_TAPES } from "@/lib/data";

export type FrequencyTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  durationSec: number;
  source: "site";
};

export type FrequencySegment =
  | { kind: "music"; durationSec: number; track: FrequencyTrack; musicIndex: number }
  | { kind: "static"; durationSec: number; musicIndex: number }
  | { kind: "tag"; durationSec: number; musicIndex: number };

export type FrequencyState = {
  active: boolean;
  playing: boolean;
  phase: FrequencySegment["kind"] | null;
  current: FrequencyTrack | null;
  next: FrequencyTrack | null;
  elapsed: number;
  duration: number;
  listenerCount: number;
  error: string | null;
};

const TAG_SECONDS = 3.0;
const STATIC_SECONDS = 0.9;
const DEFAULT_DURATION = 30;
const TAG_SRC = "/audio/Frequencia_808_tag.mp3";

function parseDuration(label: string): number {
  const parts = String(label).split(":").map(Number);
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return DEFAULT_DURATION;
  return Math.max(1, parts[0] * 60 + parts[1]);
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = Math.abs(seed) || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function buildFrequencyCycle(
  tracks: readonly FrequencyTrack[],
  seed: number,
  cycle: number,
): FrequencySegment[] {
  const shuffled = seededShuffle(tracks, seed + cycle);
  const segments: FrequencySegment[] = [];

  shuffled.forEach((track, index) => {
    const musicIndex = index + 1;
    segments.push({ kind: "music", durationSec: track.durationSec, track, musicIndex });
    if (index < shuffled.length - 1) {
      segments.push({ kind: musicIndex % 3 === 0 ? "tag" : "static", durationSec: musicIndex % 3 === 0 ? TAG_SECONDS : STATIC_SECONDS, musicIndex });
    }
  });

  if (shuffled.length > 0) {
    const lastIndex = shuffled.length;
    segments.push({ kind: lastIndex % 3 === 0 ? "tag" : "static", durationSec: lastIndex % 3 === 0 ? TAG_SECONDS : STATIC_SECONDS, musicIndex: lastIndex });
  }
  return segments;
}

export function cycleDuration(segments: readonly FrequencySegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.durationSec, 0);
}

export function locateFrequencySegment(
  elapsedSec: number,
  tracks: readonly FrequencyTrack[],
  seed: number,
) {
  const safeElapsed = Math.max(0, elapsedSec);
  const firstCycle = buildFrequencyCycle(tracks, seed, Math.floor(safeElapsed / Math.max(1, cycleDuration(buildFrequencyCycle(tracks, seed, 0)))));
  const total = Math.max(1, cycleDuration(firstCycle));
  const cycle = Math.floor(safeElapsed / total);
  const cycleSegments = buildFrequencyCycle(tracks, seed, cycle);
  const within = safeElapsed - cycle * total;
  let cursor = 0;
  for (let index = 0; index < cycleSegments.length; index++) {
    const segment = cycleSegments[index]!;
    if (within < cursor + segment.durationSec || index === cycleSegments.length - 1) {
      return {
        segment,
        segmentIndex: index,
        offsetSec: Math.max(0, within - cursor),
        cycle,
        cycleSegments,
        cycleDuration: total,
      };
    }
    cursor += segment.durationSec;
  }
  return {
    segment: cycleSegments[cycleSegments.length - 1]!,
    segmentIndex: Math.max(0, cycleSegments.length - 1),
    offsetSec: 0,
    cycle,
    cycleSegments,
    cycleDuration: total,
  };
}

function sameFrequencySegment(a: FrequencySegment, b: FrequencySegment): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "music" && b.kind === "music") return a.track.id === b.track.id;
  return a.musicIndex === b.musicIndex;
}

function sameAudioSource(audio: HTMLAudioElement, src: string): boolean {
  const current = audio.currentSrc || audio.src;
  if (!current) return false;
  try {
    return new URL(current, document.baseURI).href === new URL(src, document.baseURI).href;
  } catch {
    return current === src;
  }
}

function makeSiteQueue(): FrequencyTrack[] {
  return STATIC_TAPES.map((item) => ({
    id: item.id,
    title: item.title,
    artist: item.feat,
    src: item.src,
    durationSec: parseDuration(item.dur),
    source: "site" as const,
  }));
}

export class FrequencyEngine {
  private audio: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> | null = null;
  private currentStatic: AudioBufferSourceNode | null = null;
  private stationStartedAt = Date.now() - 6 * 3600_000;
  private seed = 8080808;
  private serverOffsetMs = 0;
  private tracks: FrequencyTrack[] = makeSiteQueue();
  private timer: number | null = null;
  private heartbeat: number | null = null;
  private listenerTimer: number | null = null;
  private visibilityCleanup: (() => void) | null = null;
  private staticTimer: number | null = null;
  private mediaWaitCleanup: (() => void) | null = null;
  private syncVersion = 0;
  private mediaRequestVersion = 0;
  private lifecycleVersion = 0;
  private programPromise: Promise<void> | null = null;
  private clockPromise: Promise<void> | null = null;
  private state: FrequencyState = {
    active: false,
    playing: false,
    phase: null,
    current: null,
    next: null,
    elapsed: 0,
    duration: 0,
    listenerCount: 0,
    error: null,
  };
  private listeners = new Set<() => void>();

  getState = () => this.state;

  getPlaybackPosition() {
    if (!this.state.active || !this.tracks.length) {
      return { elapsed: 0, duration: this.state.duration, phase: this.state.phase };
    }
    const serverNow = Date.now() + this.serverOffsetMs;
    const elapsedSec = Math.max(0, (serverNow - this.stationStartedAt) / 1000);
    const located = locateFrequencySegment(elapsedSec, this.tracks, this.seed);
    return {
      elapsed: located.offsetSec,
      duration: located.segment.durationSec,
      phase: located.segment.kind,
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  prepare = (): Promise<void> => {
    const program = this.programPromise ?? (
      this.programPromise = this.loadProgram().finally(() => {
        this.programPromise = null;
      })
    );
    const clock = this.clockPromise ?? (
      this.clockPromise = this.clock().finally(() => {
        this.clockPromise = null;
      })
    );
    return Promise.all([program, clock]).then(() => undefined);
  };

  getSpectrum = (): number[] => {
    if (!this.analyser || !this.bins) return [];
    this.analyser.getByteFrequencyData(this.bins);
    const bins = this.bins;
    const result: number[] = [];
    const width = Math.max(1, Math.floor(bins.length / 24));
    for (let i = 0; i < 24; i++) {
      const start = i * width;
      const end = Math.min(bins.length, start + width);
      let sum = 0;
      for (let j = start; j < end; j++) sum += bins[j] ?? 0;
      result.push(end > start ? sum / ((end - start) * 255) : 0);
    }
    return result;
  };

  private set(patch: Partial<FrequencyState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (this.audio) return this.audio;
    const c = getCtx();
    const destination = out();
    if (!c || !destination) return null;

    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    const source = c.createMediaElementSource(audio);
    const analyser = c.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser).connect(destination);

    audio.addEventListener("loadedmetadata", () => this.set({ duration: Number.isFinite(audio.duration) ? audio.duration : this.state.duration }));
    audio.addEventListener("error", () => {
      this.set({ error: "A faixa da emissão não respondeu. A rádio activa o sinal de emergência." });
    });
    audio.addEventListener("play", () => this.set({ playing: true }));
    audio.addEventListener("pause", () => {
      if (this.state.phase !== "static") this.set({ playing: false });
    });
    audio.addEventListener("ended", () => {
      if (this.state.active && this.state.playing) this.scheduleNext(0);
    });

    this.audio = audio;
    this.sourceNode = source;
    this.analyser = analyser;
    this.bins = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    return audio;
  }

  private async loadProgram() {
    try {
      const tapes = await getLiveTapes();
      const mapped = tapes.filter((tape) => tape.src).map((tape) => ({
        id: tape.id,
        title: tape.title,
        artist: tape.feat,
        src: tape.src,
        durationSec: parseDuration(tape.dur),
        source: "site" as const,
      }));
      if (mapped.length) this.tracks = mapped;
    } catch {}
  }

  private async clock() {
    const clock = await getFrequencyClock();
    if (clock) {
      this.serverOffsetMs = new Date(clock.server_now).getTime() - Date.now();
      this.stationStartedAt = new Date(clock.station_started_at).getTime();
      this.seed = Number(clock.program_seed) || this.seed;
    }
  }

  private scheduleNext(delayMs: number) {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.syncToClock(), Math.max(40, delayMs + 10));
  }

  private stopPresenceLoops() {
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    if (this.listenerTimer) window.clearInterval(this.listenerTimer);
    this.heartbeat = null;
    this.listenerTimer = null;
    this.visibilityCleanup?.();
    this.visibilityCleanup = null;
  }

  private invalidatePlayback() {
    this.syncVersion += 1;
    this.mediaRequestVersion += 1;
    this.mediaWaitCleanup?.();
    this.mediaWaitCleanup = null;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.audio?.pause();
    this.currentStatic?.stop();
    this.currentStatic = null;
    if (this.staticTimer) window.clearTimeout(this.staticTimer);
    this.staticTimer = null;
  }

  private setMediaSessionState(state: MediaSessionPlaybackState) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {}
  }

  private async syncToClock() {
    if (!this.state.active || !this.state.playing) return;

    const syncVersion = ++this.syncVersion;
    const serverNow = Date.now() + this.serverOffsetMs;
    const elapsedSec = Math.max(0, (serverNow - this.stationStartedAt) / 1000);
    if (!this.tracks.length) return;

    const located = locateFrequencySegment(elapsedSec, this.tracks, this.seed);
    const current =
      located.segment.kind === "music"
        ? located.segment.track
        : this.tracks[(located.segment.musicIndex) % this.tracks.length];
    const nextMusic = located.cycleSegments
      .slice(located.segmentIndex + 1)
      .find((segment) => segment.kind === "music");
    const next = nextMusic?.kind === "music" ? nextMusic.track : this.tracks[0] ?? null;
    const remainingMs = Math.max(0, (located.segment.durationSec - located.offsetSec) * 1000);

    this.set({
      phase: located.segment.kind,
      current,
      next,
      elapsed: located.offsetSec,
      duration: located.segment.durationSec,
      error: null,
    });

    if (located.segment.kind === "static") {
      this.audio?.pause();
      this.playStatic(remainingMs);
    } else {
      this.currentStatic?.stop();
      this.currentStatic = null;
      if (this.staticTimer) window.clearTimeout(this.staticTimer);
      this.staticTimer = null;

      const targetSrc = located.segment.kind === "tag" ? TAG_SRC : located.segment.track.src;
      const mediaOk = await this.playMedia(targetSrc, located.offsetSec, syncVersion);

      if (!mediaOk && syncVersion === this.syncVersion && this.state.active && this.state.playing) {
        this.playStatic(remainingMs);
        this.set({
          error:
            located.segment.kind === "tag"
              ? "A identificação 808 não respondeu. A rádio segue em sinal de emergência."
              : "A faixa não respondeu. A rádio segue em sinal de emergência.",
        });
        if (located.segment.kind === "tag") {
          kick808(0.42, Math.min(0.8, remainingMs / 1000));
        }
      }
    }

    if (syncVersion !== this.syncVersion || !this.state.active || !this.state.playing) return;

    const nowElapsed = Math.max(
      0,
      (Date.now() + this.serverOffsetMs - this.stationStartedAt) / 1000,
    );
    const nowLocated = locateFrequencySegment(nowElapsed, this.tracks, this.seed);

    if (
      located.segment.kind !== "static" &&
      nowLocated.segment.kind !== "static" &&
      sameFrequencySegment(nowLocated.segment, located.segment) &&
      this.audio &&
      !this.audio.paused
    ) {
      try {
        const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
        const offset = duration > 0
          ? Math.min(nowLocated.offsetSec, Math.max(0, duration - 0.05))
          : nowLocated.offsetSec;
        if (Math.abs(this.audio.currentTime - offset) > 0.25) {
          this.audio.currentTime = offset;
        }
      } catch {}
    }

    this.updateMediaSession(
      located.segment.kind === "music"
        ? located.segment.track
        : this.tracks[(located.segment.musicIndex) % this.tracks.length] ?? null,
    );

    const delay = sameFrequencySegment(nowLocated.segment, located.segment)
      ? Math.max(0, (nowLocated.segment.durationSec - nowLocated.offsetSec) * 1000)
      : 0;
    this.scheduleNext(delay);
  }

  private updateMediaSession(trackValue: FrequencyTrack | null) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !trackValue) return;
    try {
      const session = navigator.mediaSession;
      session.metadata = new MediaMetadata({
        title: "Frequência 808 · " + trackValue.title,
        artist: trackValue.artist,
        album: "O Sindicato do Trap — Rádio Pirata",
      });
      session.playbackState = this.state.playing ? "playing" : "paused";
      session.setActionHandler("play", () => void this.resume());
      session.setActionHandler("pause", () => this.pause());
      for (const action of ["nexttrack", "previoustrack", "seekbackward", "seekforward", "seekto"] as MediaSessionAction[]) {
        try { session.setActionHandler(action, null); } catch {}
      }
    } catch {}
  }

  private clearMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      for (const action of ["play", "pause", "nexttrack", "previoustrack", "seekbackward", "seekforward", "seekto"] as MediaSessionAction[]) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      }
    } catch {}
  }

  private playStatic(remainingMs: number) {
    this.audio?.pause();
    if (this.staticTimer) window.clearTimeout(this.staticTimer);
    this.staticTimer = null;
    const c = getCtx();
    const destination = this.analyser;
    if (!c || !destination) return;
    this.currentStatic?.stop();
    const bufferSeconds = Math.max(0.08, Math.min(1.2, remainingMs / 1000 + 0.02));
    const buffer = c.createBuffer(1, Math.max(1, Math.ceil(c.sampleRate * bufferSeconds)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.min(1, i / (c.sampleRate * 0.05), (data.length - i) / (c.sampleRate * 0.08));
      data[i] = (Math.random() * 2 - 1) * 0.18 * Math.max(0, env);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = remainingMs > bufferSeconds * 1000;
    const gain = c.createGain();
    gain.gain.value = 0.25;
    src.connect(gain).connect(destination);
    src.onended = () => {
      if (this.currentStatic !== src) return;
      this.currentStatic = null;
      if (this.staticTimer) window.clearTimeout(this.staticTimer);
      this.staticTimer = null;
    };
    this.currentStatic = src;
    this.set({ playing: true, error: null });
    src.start();
    this.setMediaSessionState("playing");
    if (src.loop) {
      this.staticTimer = window.setTimeout(() => {
        try { src.stop(); } catch {}
      }, Math.max(20, remainingMs));
    }
  }

  private async playMedia(src: string, offsetSec: number, syncVersion: number): Promise<boolean> {
    const audio = this.ensureAudio();
    if (!audio || !src) return false;

    const requestVersion = ++this.mediaRequestVersion;
    this.mediaWaitCleanup?.();
    this.mediaWaitCleanup = null;

    const sourceAlreadyLoaded = sameAudioSource(audio, src);
    if (!sourceAlreadyLoaded) {
      audio.src = src;
      audio.load();
    }

    if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
      const ready = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          audio.removeEventListener("loadedmetadata", onReady);
          audio.removeEventListener("error", onError);
          if (this.mediaWaitCleanup === cleanup) this.mediaWaitCleanup = null;
          resolve(value);
        };
        const onReady = () => finish(true);
        const onError = () => finish(false);
        const timeout = window.setTimeout(() => finish(false), 8000);
        const cleanup = () => finish(false);
        this.mediaWaitCleanup = cleanup;
        audio.addEventListener("loadedmetadata", onReady, { once: true });
        audio.addEventListener("error", onError, { once: true });
      });

      if (!ready || requestVersion !== this.mediaRequestVersion || syncVersion !== this.syncVersion) {
        return false;
      }
    }

    if (
      requestVersion !== this.mediaRequestVersion ||
      syncVersion !== this.syncVersion ||
      !this.state.active ||
      !this.state.playing
    ) {
      return false;
    }

    try {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const safeOffset = duration > 0
        ? Math.min(Math.max(0, offsetSec), Math.max(0, duration - 0.05))
        : Math.max(0, offsetSec);
      audio.currentTime = safeOffset;
    } catch {}

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        if (requestVersion !== this.mediaRequestVersion || syncVersion !== this.syncVersion) {
          return false;
        }
        this.set({
          error:
            "O browser bloqueou esta faixa externa. A emissão continua com sinal de emergência.",
        });
        return false;
      }
    }

    if (
      requestVersion !== this.mediaRequestVersion ||
      syncVersion !== this.syncVersion ||
      !this.state.active ||
      !this.state.playing
    ) {
      return false;
    }

    this.set({ playing: true, error: null });
    this.setMediaSessionState("playing");
    return true;
  }

  private startLocalPlaybackForGesture() {
    const audio = this.ensureAudio();
    if (!audio) {
      this.set({
        playing: false,
        error: "O motor de áudio não está disponível neste browser.",
      });
      return;
    }

    const elapsedSec = Math.max(
      0,
      (Date.now() + this.serverOffsetMs - this.stationStartedAt) / 1000,
    );
    const located = locateFrequencySegment(elapsedSec, this.tracks, this.seed);
    const current =
      located.segment.kind === "music"
        ? located.segment.track
        : this.tracks[(located.segment.musicIndex) % this.tracks.length];
    const nextMusic = located.cycleSegments
      .slice(located.segmentIndex + 1)
      .find((segment) => segment.kind === "music");
    const next = nextMusic?.kind === "music" ? nextMusic.track : this.tracks[0] ?? null;
    const remainingMs = Math.max(0, (located.segment.durationSec - located.offsetSec) * 1000);

    this.set({
      active: true,
      playing: true,
      phase: located.segment.kind,
      current,
      next,
      elapsed: located.offsetSec,
      duration: located.segment.durationSec,
      error: null,
    });

    if (located.segment.kind === "static") {
      this.playStatic(remainingMs);
      this.scheduleNext(remainingMs);
      return;
    }

    this.currentStatic?.stop();
    this.currentStatic = null;
    if (this.staticTimer) window.clearTimeout(this.staticTimer);
    this.staticTimer = null;

    const targetSrc = located.segment.kind === "tag" ? TAG_SRC : located.segment.track.src;
    if (!targetSrc) {
      this.playStatic(remainingMs);
      this.set({ error: "Sem faixa local disponível. A rádio entrou em sinal de emergência." });
      this.scheduleNext(remainingMs);
      return;
    }

    const requestVersion = ++this.mediaRequestVersion;
    this.mediaWaitCleanup?.();
    this.mediaWaitCleanup = null;
    audio.src = targetSrc;
    audio.load();
    try {
      audio.currentTime = located.offsetSec;
    } catch {}

    void audio.play().catch(() => {
      if (requestVersion !== this.mediaRequestVersion || !this.state.active || !this.state.playing) return;
      this.playStatic(remainingMs);
      this.set({
        error:
          "O browser bloqueou o áudio. A emissão continua com sinal de emergência.",
      });
    });

    this.updateMediaSession(
      located.segment.kind === "music"
        ? located.segment.track
        : this.tracks[(located.segment.musicIndex) % this.tracks.length] ?? null,
    );
    this.setMediaSessionState("playing");
    this.scheduleNext(remainingMs);
  }

  private getStationHour() {
    return new Date(Date.now() + this.serverOffsetMs).getHours();
  }

  async start() {
    if (this.state.active && this.state.playing) return;

    const lifecycle = ++this.lifecycleVersion;
    this.invalidatePlayback();
    tape.stop();
    this.set({ active: true, playing: true, error: null });
    radioDial();

    // Prime the real local tape during the user's click before any awaited network work.
    this.startLocalPlaybackForGesture();

    await this.prepare();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;

    await this.syncToClock();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;

    this.startPresenceLoops();
    const storedMember = typeof window !== "undefined" ? window.localStorage.getItem("sdt-member") : null;
    if (storedMember) void awardNightListener(storedMember, 3);
  }

  pause() {
    if (!this.state.active) return;
    this.lifecycleVersion += 1;
    this.syncVersion += 1;
    this.mediaRequestVersion += 1;
    this.mediaWaitCleanup?.();
    this.mediaWaitCleanup = null;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.audio?.pause();
    this.currentStatic?.stop();
    this.currentStatic = null;
    if (this.staticTimer) window.clearTimeout(this.staticTimer);
    this.staticTimer = null;
    this.stopPresenceLoops();
    this.set({ playing: false });
    this.setMediaSessionState("paused");
  }

  stop() {
    this.lifecycleVersion += 1;
    this.invalidatePlayback();
    this.stopPresenceLoops();

    if (this.audio) this.audio.removeAttribute("src");
    this.clearMediaSession();
    this.set({ active: false, playing: false, phase: null, current: null, next: null, elapsed: 0, duration: 0 });
  }

  async resume() {
    if (!this.state.active) return this.start();

    const lifecycle = ++this.lifecycleVersion;
    this.invalidatePlayback();
    this.set({ playing: true, error: null });
    this.startLocalPlaybackForGesture();

    await this.prepare();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;

    await this.syncToClock();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;

    this.startPresenceLoops();
    const storedMember = typeof window !== "undefined" ? window.localStorage.getItem("sdt-member") : null;
    if (storedMember) void awardNightListener(storedMember, 3);
  }

  private async refreshListenerCount() {
    const count = await getFrequencyListenerCount();
    if (this.state.active) this.set({ listenerCount: count });
  }

  private startPresenceLoops() {
    this.stopPresenceLoops();

    this.heartbeat = window.setInterval(() => {
      if (!this.state.active || !this.state.playing) return;
      void this.clock();
      void sendFrequencyHeartbeat();
      void this.refreshListenerCount();
      const storedMember = typeof window !== "undefined" ? window.localStorage.getItem("sdt-member") : null;
      if (storedMember) void awardNightListener(storedMember, 3);
    }, 20_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && this.state.active && this.state.playing) {
        void this.clock().then(() => this.syncToClock());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.visibilityCleanup = () => document.removeEventListener("visibilitychange", onVisibility);
    this.listenerTimer = window.setInterval(() => {
      if (this.state.active && this.state.playing) void this.refreshListenerCount();
    }, 10_000);

    void sendFrequencyHeartbeat();
    void this.refreshListenerCount();
  }

  level() {
    if (!this.analyser || !this.bins) return 0;
    this.analyser.getByteFrequencyData(this.bins);
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += this.bins[i] ?? 0;
    return sum / (16 * 255);
  }

  isOnAir(artistName: string) {
    const current = this.state.current;
    return Boolean(
      this.state.phase === "music" &&
        current &&
        current.artist.toLowerCase().includes(artistName.toLowerCase()),
    );
  }
}

export const frequency = new FrequencyEngine();
