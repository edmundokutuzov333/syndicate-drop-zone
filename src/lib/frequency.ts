import { getCtx, getRadioVolume, isMuted, subscribeMute } from "@/lib/audio-bus";
import { getLiveRadioBlocks, getLiveRadioStation, getLiveRadioTracks, type LiveRadioBlock, type LiveRadioStation, type LiveRadioTrack } from "@/lib/site-content";
import { getFrequencyClock, getFrequencyListenerCount, markRadioTrackFailure, sendFrequencyHeartbeat, awardNightListener } from "@/lib/frequency-api";
import { kick808, radioDial } from "@/lib/sfx";
import { tape } from "@/lib/tape-engine";
import { RADIO_TRACKS } from "@/lib/data";
import { track as analyticsTrack, getAnalyticsSessionId } from "@/lib/track";

export type FrequencyTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  durationSec: number;
  kind: "music" | "jingle" | "sfx";
  rotationWeight: number;
  position: number;
  failureCount: number;
  temporarilyDisabled: boolean;
  source: "radio";
};

export type FrequencySegment =
  | { kind: "music"; durationSec: number; track: FrequencyTrack; musicIndex: number }
  | { kind: "jingle"; durationSec: number; track: FrequencyTrack; musicIndex: number }
  | { kind: "static"; durationSec: number; musicIndex: number }
  | { kind: "tag"; durationSec: number; musicIndex: number };

export type FrequencySyncStatus = "sync_ok" | "sync_degraded" | "offline_clock";

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
  syncStatus: FrequencySyncStatus;
  volume: number;
};

const TAG_SECONDS = 3;
const STATIC_SECONDS = 0.85;
const DEFAULT_DURATION = 180;
const METADATA_TIMEOUT_MS = 7000;
const MUTE_RETRY_DELAY_MS = 800;

type PreparedAudio = {
  audio: HTMLAudioElement;
  trackId: string;
};

function parseDuration(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = Math.abs(Math.floor(seed)) || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function weightedShuffle(items: readonly FrequencyTrack[], seed: number): FrequencyTrack[] {
  const weighted: FrequencyTrack[] = [];
  for (const item of items) {
    for (let i = 0; i < Math.min(12, Math.max(1, item.rotationWeight)); i++) weighted.push(item);
  }
  return seededShuffle(weighted, seed).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
}

function mapRadioTrack(track: LiveRadioTrack): FrequencyTrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    src: track.src,
    durationSec: parseDuration(track.durationSec) || DEFAULT_DURATION,
    kind: track.kind,
    rotationWeight: Math.max(1, track.rotationWeight || 1),
    position: track.position,
    failureCount: track.failureCount,
    temporarilyDisabled: track.temporarilyDisabled,
    source: "radio",
  };
}

export function buildFrequencyCycle(
  tracks: readonly FrequencyTrack[],
  seed: number,
  cycle: number,
  tagInterval = 3,
): FrequencySegment[] {
  const music = tracks.filter((track) => track.kind === "music" && !track.temporarilyDisabled);
  const jingles = tracks.filter((track) => track.kind === "jingle" && !track.temporarilyDisabled);
  const shuffled = weightedShuffle(music, seed + cycle * 7919);
  const segments: FrequencySegment[] = [];
  const interval = Math.max(1, Math.floor(tagInterval));

  shuffled.forEach((track, index) => {
    const musicIndex = index + 1;
    segments.push({ kind: "music", durationSec: track.durationSec, track, musicIndex });

    if (jingles.length && musicIndex % 6 === 0) {
      const jingle = seededShuffle(jingles, seed + cycle * 137 + musicIndex)[0];
      if (jingle) segments.push({ kind: "jingle", durationSec: jingle.durationSec, track: jingle, musicIndex });
    }

    if (index < shuffled.length - 1) {
      const withTag = musicIndex % interval === 0;
      segments.push({
        kind: withTag ? "tag" : "static",
        durationSec: withTag ? TAG_SECONDS : STATIC_SECONDS,
        musicIndex,
      });
    }
  });

  if (shuffled.length > 0) {
    const lastIndex = shuffled.length;
    const withTag = lastIndex % interval === 0;
    segments.push({
      kind: withTag ? "tag" : "static",
      durationSec: withTag ? TAG_SECONDS : STATIC_SECONDS,
      musicIndex: lastIndex,
    });
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
  tagInterval = 3,
) {
  const safeElapsed = Math.max(0, elapsedSec);
  const reference = buildFrequencyCycle(tracks, seed, 0, tagInterval);
  const baseDuration = Math.max(1, cycleDuration(reference));
  const cycle = Math.floor(safeElapsed / baseDuration);
  const cycleSegments = buildFrequencyCycle(tracks, seed, cycle, tagInterval);
  const total = Math.max(1, cycleDuration(cycleSegments));
  const within = safeElapsed % total;
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
  if (a.kind === "music" || a.kind === "jingle") return a.track.id === b.track.id;
  return a.musicIndex === b.musicIndex;
}

function formatTrackProps(track: FrequencyTrack) {
  return { track: track.id, title: track.title, artist: track.artist };
}

function readCachedDuration(src: string): number {
  try {
    const raw = window.localStorage.getItem("sdt-radio-durations");
    if (!raw) return 0;
    const cache = JSON.parse(raw) as Record<string, number>;
    return parseDuration(cache[src]);
  } catch {
    return 0;
  }
}

function cacheDuration(src: string, duration: number): void {
  if (!duration) return;
  try {
    const raw = window.localStorage.getItem("sdt-radio-durations");
    const cache = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    cache[src] = duration;
    window.localStorage.setItem("sdt-radio-durations", JSON.stringify(cache));
  } catch {}
}

async function probeDuration(src: string): Promise<number> {
  if (typeof window === "undefined" || !src) return 0;
  const cached = readCachedDuration(src);
  if (cached) return cached;

  const audio = new Audio();
  audio.preload = "metadata";
  audio.src = src;
  const duration = await new Promise<number>((resolve) => {
    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("error", onError);
      resolve(value);
    };
    const onReady = () => finish(parseDuration(audio.duration));
    const onDuration = () => {
      const value = parseDuration(audio.duration);
      if (value) finish(value);
    };
    const onError = () => finish(0);
    const timeout = window.setTimeout(() => finish(0), METADATA_TIMEOUT_MS);
    audio.addEventListener("loadedmetadata", onReady);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("error", onError);
    audio.load();
  });

  if (duration) cacheDuration(src, duration);
  return duration;
}

function effectiveVolume(volume: number): number {
  return isMuted() ? 0 : clamp(volume, 0, 1);
}

export class FrequencyEngine {
  private audio: HTMLAudioElement | null = null;
  private preloaded: PreparedAudio | null = null;
  private tagAudio: HTMLAudioElement | null = null;
  private currentTrack: FrequencyTrack | null = null;
  private currentSegmentIndex = -1;
  private stationStartedAt = Date.now() - 6 * 3600_000;
  private seed = 8080808;
  private serverOffsetMs = 0;
  private blocks: LiveRadioBlock[] = [];
  private tracks: FrequencyTrack[] = RADIO_TRACKS.map((track, index) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    src: track.src,
    durationSec: DEFAULT_DURATION,
    kind: track.kind,
    rotationWeight: 1,
    position: index + 1,
    failureCount: 0,
    temporarilyDisabled: false,
    source: "radio",
  }));
  private station: LiveRadioStation = {
    forcedTrackId: null,
    forcedStartedAt: null,
    activeBlockId: null,
    autoplay: true,
    stationSeed: 8080808,
    crossfadeMs: 650,
    tagInterval: 3,
  };
  private timer: number | null = null;
  private heartbeat: number | null = null;
  private clockTimer: number | null = null;
  private listenerTimer: number | null = null;
  private visibilityCleanup: (() => void) | null = null;
  private mediaWaitCleanup: (() => void) | null = null;
  private lifecycleVersion = 0;
  private syncVersion = 0;
  private mediaRequestVersion = 0;
  private programPromise: Promise<void> | null = null;
  private clockPromise: Promise<void> | null = null;
  private staticSource: AudioBufferSourceNode | null = null;
  private staticGain: GainNode | null = null;
  private clockLastSuccessAt = 0;
  private trackMilestones = new Set<number>();
  private failureCounts = new Map<string, number>();
  private sessionStarted = false;
  private muteCleanup: (() => void) | null = null;
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
    syncStatus: "offline_clock",
    volume: 0.82,
  };
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      this.state.volume = getRadioVolume();
      this.muteCleanup = subscribeMute(() => this.applyVolumes());
    }
  }

  getState = () => this.state;

  getPlaybackPosition() {
    if (!this.state.active) {
      return { elapsed: 0, duration: this.state.duration, remaining: this.state.duration, phase: this.state.phase, syncStatus: this.state.syncStatus };
    }

    const elapsed = this.state.playing
      ? Math.max(0, (Date.now() + this.serverOffsetMs - this.stationStartedAt) / 1000)
      : this.state.elapsed;
    const located = this.tracks.length
      ? locateFrequencySegment(elapsed, this.tracks, this.seed, this.station.tagInterval)
      : null;

    return {
      elapsed: located?.offsetSec ?? this.state.elapsed,
      duration: located?.segment.durationSec ?? this.state.duration,
      remaining: Math.max(0, (located?.segment.durationSec ?? this.state.duration) - (located?.offsetSec ?? this.state.elapsed)),
      phase: located?.segment.kind ?? this.state.phase,
      syncStatus: this.getFreshSyncStatus(),
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  prepare = (): Promise<void> => {
    const program = this.programPromise ?? (this.programPromise = this.loadProgram().finally(() => { this.programPromise = null; }));
    const clock = this.clockPromise ?? (this.clockPromise = this.clock().finally(() => { this.clockPromise = null; }));
    return Promise.all([program, clock]).then(() => undefined);
  };

  autoStart = () => {
    if (!this.station.autoplay || (this.state.active && this.state.playing)) return;
    void this.start();
  };

  getSpectrum = (): number[] => {
    if (!this.state.playing) return [];
    const elapsed = this.getPlaybackPosition().elapsed;
    const base = 0.35 + 0.28 * Math.abs(Math.sin(elapsed * 4.7));
    return Array.from({ length: 24 }, (_, index) => clamp(base * (0.55 + Math.abs(Math.sin(elapsed * (2.1 + index * 0.07) + index))), 0, 1));
  };

  private getFreshSyncStatus(): FrequencySyncStatus {
    if (!this.clockLastSuccessAt) return this.state.syncStatus;
    const age = Date.now() - this.clockLastSuccessAt;
    if (age > 90_000) return "offline_clock";
    if (age > 35_000) return "sync_degraded";
    return "sync_ok";
  }

  private set(patch: Partial<FrequencyState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private async loadProgram() {
    const [rawTracks, rawStation, rawBlocks] = await Promise.all([
      getLiveRadioTracks(),
      getLiveRadioStation(),
      getLiveRadioBlocks(),
    ]);
    this.station = rawStation;
    this.blocks = rawBlocks;
    this.seed = rawStation.stationSeed || 8080808;

    const activeBlock = rawBlocks.find((block) => block.id === rawStation.activeBlockId);
    const forcedSource = rawStation.forcedTrackId
      ? rawTracks.find((track) => track.id === rawStation.forcedTrackId)
      : null;
    const catalog = activeBlock && activeBlock.trackIds.length
      ? rawTracks.filter((track) => activeBlock.trackIds.includes(track.id) || track.id === rawStation.forcedTrackId)
      : rawTracks;
    if (forcedSource && !catalog.some((track) => track.id === forcedSource.id)) catalog.push(forcedSource);

    this.tracks = await Promise.all(
      catalog
        .filter((track) => track.src && !track.temporarilyDisabled)
        .map(async (track) => {
          const duration = parseDuration(track.durationSec) || await probeDuration(track.src);
          return { ...mapRadioTrack(track), durationSec: duration || DEFAULT_DURATION };
        }),
    );
    this.tracks = this.tracks.filter((track) => Boolean(track.src));
    if (this.tracks.length === 0) {
      this.set({ error: "Não existem faixas publicadas para a Frequência 808." });
    }
  }

  private async clock() {
    try {
      const clock = await getFrequencyClock();
      if (clock) {
        this.serverOffsetMs = new Date(clock.server_now).getTime() - Date.now();
        this.stationStartedAt = new Date(clock.station_started_at).getTime();
        this.seed = Number(clock.program_seed) || this.seed;
        this.clockLastSuccessAt = Date.now();
        this.set({ syncStatus: "sync_ok" });
        return;
      }
    } catch {}

    this.set({ syncStatus: this.clockLastSuccessAt ? "sync_degraded" : "offline_clock" });
  }

  private scheduleNext(delayMs: number) {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.syncToClock(), Math.max(50, delayMs));
  }

  private clearLoops() {
    if (this.timer) window.clearTimeout(this.timer);
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    if (this.clockTimer) window.clearInterval(this.clockTimer);
    if (this.listenerTimer) window.clearInterval(this.listenerTimer);
    this.timer = null;
    this.heartbeat = null;
    this.clockTimer = null;
    this.listenerTimer = null;
    this.visibilityCleanup?.();
    this.visibilityCleanup = null;
  }

  private invalidatePlayback() {
    this.syncVersion += 1;
    this.mediaRequestVersion += 1;
    this.mediaWaitCleanup?.();
    this.mediaWaitCleanup = null;
    this.audio?.pause();
    this.preloaded?.audio.pause();
    this.preloaded = null;
    this.tagAudio?.pause();
    this.stopStatic();
    this.clearLoops();
  }

  private ensureMusicAudio(src: string, track: FrequencyTrack): HTMLAudioElement {
    if (this.audio && this.audio.src === src) return this.audio;

    if (this.preloaded?.trackId === track.id) {
      const prepared = this.preloaded.audio;
      this.preloaded = null;
      this.audio = prepared;
      return prepared;
    }

    const audio = new Audio();
    audio.preload = "auto";
    audio.src = src;
    audio.addEventListener("error", () => {
      if (this.currentTrack?.id === track.id && this.audio === audio) {
        void this.handleTrackError(track, "audio_error");
      } else if (this.preloaded?.trackId === track.id) {
        this.preloaded = null;
        void this.handleTrackError(track, "preload_error");
      }
    });
    audio.addEventListener("ended", () => {
      if (this.currentTrack?.id === track.id && this.audio === audio && this.state.active && this.state.playing) {
        analyticsTrack("radio_track_end", formatTrackProps(track));
        this.scheduleNext(0);
      }
    });
    audio.addEventListener("timeupdate", () => {
      if (this.currentTrack?.id !== track.id || this.audio !== audio || !this.state.playing) return;
      this.emitMilestones(track, audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : track.durationSec);
    });
    audio.addEventListener("play", () => {
      if (this.currentTrack?.id === track.id && this.audio === audio) this.set({ playing: true, error: null });
    });
    audio.addEventListener("pause", () => {
      if (this.currentTrack?.id === track.id && this.audio === audio && (this.state.phase === "music" || this.state.phase === "jingle")) {
        this.set({ playing: false });
      }
    });
    this.audio = audio;
    return audio;
  }

  private async preloadNext(track: FrequencyTrack | null) {
    if (!track || track.kind !== "music" || track.id === this.currentTrack?.id) return;
    if (this.preloaded?.trackId === track.id) return;
    this.preloaded?.audio.pause();

    const audio = new Audio();
    audio.preload = "auto";
    audio.src = track.src;
    this.preloaded = { audio, trackId: track.id };
    audio.addEventListener("error", () => {
      if (this.preloaded?.trackId === track.id) this.preloaded = null;
    });
    try { audio.load(); } catch {}
  }

  private applyVolumes() {
    const volume = effectiveVolume(this.state.volume);
    if (this.audio) this.audio.volume = volume;
    if (this.preloaded) this.preloaded.audio.volume = volume;
    if (this.tagAudio) this.tagAudio.volume = volume;
    if (this.staticGain) this.staticGain.gain.value = volume * 0.25;
  }

  private async fadeAudio(audio: HTMLAudioElement, from: number, to: number, durationMs: number) {
    if (durationMs <= 0) {
      audio.volume = to;
      return;
    }
    const started = performance.now();
    audio.volume = from;
    await new Promise<void>((resolve) => {
      const step = () => {
        const ratio = clamp((performance.now() - started) / durationMs, 0, 1);
        audio.volume = from + (to - from) * ratio;
        if (ratio >= 1) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  private stopStatic() {
    try { this.staticSource?.stop(); } catch {}
    this.staticSource = null;
    this.staticGain = null;
  }

  private playStatic(remainingMs: number) {
    this.audio?.pause();
    this.preloaded?.audio.pause();
    const ctx = getCtx();
    if (!ctx || remainingMs <= 0) {
      this.scheduleNext(remainingMs);
      return;
    }

    this.stopStatic();
    const gain = ctx.createGain();
    const buffer = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * Math.max(0.1, Math.min(1.2, remainingMs / 1000 + 0.05)))), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const envelope = Math.min(1, i / (ctx.sampleRate * 0.03), (data.length - i) / (ctx.sampleRate * 0.07));
      data[i] = (Math.random() * 2 - 1) * 0.14 * Math.max(0, envelope);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = remainingMs > buffer.duration * 1000;
    gain.gain.value = effectiveVolume(this.state.volume) * 0.25;
    source.connect(gain).connect(ctx.destination);
    source.onended = () => {
      if (this.staticSource !== source) return;
      this.staticSource = null;
      this.staticGain = null;
    };
    this.staticSource = source;
    this.staticGain = gain;
    this.setMediaSessionState("playing");
    source.start();
    this.set({ phase: "static", playing: true });
    if (source.loop) {
      window.setTimeout(() => { try { source.stop(); } catch {} }, Math.max(20, remainingMs));
    }
  }

  private async playTag(src: string, remainingMs: number) {
    this.audio?.pause();
    this.preloaded?.audio.pause();
    if (!this.tagAudio) {
      this.tagAudio = new Audio();
      this.tagAudio.preload = "auto";
    }
    this.tagAudio.src = src;
    this.tagAudio.volume = effectiveVolume(this.state.volume);
    this.tagAudio.currentTime = 0;
    try { await this.tagAudio.play(); } catch {}
    this.setMediaSessionState("playing");
    this.set({ phase: "tag", playing: true });
    window.setTimeout(() => this.scheduleNext(0), Math.max(0, remainingMs));
  }

  private async playJingle(track: FrequencyTrack, offsetSec: number, syncVersion: number) {
    const audio = this.ensureMusicAudio(track.src, track);
    if (this.audio && this.audio !== audio && !this.audio.paused) this.audio.pause();
    this.currentTrack = track;
    this.set({ phase: "jingle", current: track, duration: track.durationSec, elapsed: offsetSec, error: null });
    try {
      audio.currentTime = clamp(offsetSec, 0, Math.max(0, track.durationSec - 0.05));
    } catch {}
    audio.volume = effectiveVolume(this.state.volume);
    const requestVersion = ++this.mediaRequestVersion;
    if (audio.paused) {
      try { await audio.play(); } catch { return this.handleTrackError(track, "play_rejected"); }
    }
    if (requestVersion !== this.mediaRequestVersion || syncVersion !== this.syncVersion) return;
    analyticsTrack("radio_track_start", formatTrackProps(track));
    this.trackMilestones.clear();
    this.trackMilestones.add(0);
    this.setMediaSession(track);
  }

  private async playMusic(track: FrequencyTrack, offsetSec: number, syncVersion: number) {
    const previous = this.audio;
    const audio = this.ensureMusicAudio(track.src, track);
    const sameTrackAlreadyPlaying =
      this.currentTrack?.id === track.id &&
      previous === audio &&
      !audio.paused;

    this.currentTrack = track;
    this.set({ phase: "music", current: track, duration: track.durationSec, elapsed: offsetSec, error: null });

    if (sameTrackAlreadyPlaying) {
      const safeOffset = clamp(offsetSec, 0, Math.max(0, track.durationSec - 0.05));
      if (Math.abs(audio.currentTime - safeOffset) > 1.2) {
        try { audio.currentTime = safeOffset; } catch {}
      }
      this.applyVolumes();
      this.setMediaSession(track);
      await this.preloadNext(this.findNextMusic(track));
      return;
    }

    try {
      audio.currentTime = clamp(offsetSec, 0, Math.max(0, track.durationSec - 0.05));
    } catch {}

    const firstPlay = !this.state.active || !this.sessionStarted || !previous;
    audio.volume = firstPlay ? effectiveVolume(this.state.volume) : 0;
    this.applyVolumes();

    const requestVersion = ++this.mediaRequestVersion;
    try {
      if (audio.paused) await audio.play();
    } catch {
      return this.handleTrackError(track, "play_rejected");
    }

    if (requestVersion !== this.mediaRequestVersion || syncVersion !== this.syncVersion) return;
    analyticsTrack("radio_track_start", formatTrackProps(track));
    this.trackMilestones.clear();
    this.trackMilestones.add(0);
    this.setMediaSession(track);

    if (!firstPlay && previous && previous !== audio && !previous.paused) {
      const fade = Math.max(0, this.station.crossfadeMs);
      await Promise.all([
        this.fadeAudio(audio, 0, effectiveVolume(this.state.volume), fade / 2),
        this.fadeAudio(previous, previous.volume, 0, fade),
      ]);
      try { previous.pause(); previous.currentTime = 0; } catch {}
    } else {
      audio.volume = effectiveVolume(this.state.volume);
    }

    await this.preloadNext(this.findNextMusic(track));
  }

  private findNextMusic(current: FrequencyTrack | null): FrequencyTrack | null {
    if (!current || !this.tracks.length) return null;
    const cycle = buildFrequencyCycle(this.tracks, this.seed, 0, this.station.tagInterval);
    const index = cycle.findIndex((segment) => (segment.kind === "music" || segment.kind === "jingle") && segment.track.id === current.id);
    if (index < 0) return cycle.find((segment) => segment.kind === "music")?.track ?? null;
    return cycle.slice(index + 1).find((segment) => segment.kind === "music")?.track ?? cycle.find((segment) => segment.kind === "music")?.track ?? null;
  }

  private emitMilestones(track: FrequencyTrack, elapsed: number, duration: number) {
    if (!duration || duration <= 0) return;
    const ratio = elapsed / duration;
    const marks = [25, 50, 75] as const;
    for (const mark of marks) {
      if (ratio >= mark / 100 && !this.trackMilestones.has(mark)) {
        this.trackMilestones.add(mark);
        analyticsTrack(("radio_track_" + mark) as "radio_track_25" | "radio_track_50" | "radio_track_75", formatTrackProps(track));
      }
    }
  }

  private async handleTrackError(track: FrequencyTrack, reason: string) {
    analyticsTrack("radio_track_error", { ...formatTrackProps(track), reason });
    const localCount = (this.failureCounts.get(track.id) ?? track.failureCount ?? 0) + 1;
    this.failureCounts.set(track.id, localCount);
    const serverCount = await markRadioTrackFailure(track.id);
    const count = Math.max(localCount, serverCount);
    if (count >= 3) track.temporarilyDisabled = true;
    this.set({ error: count >= 3 ? "A faixa foi retirada da rotação por falhas consecutivas." : "Interferência detectada. A emissão está a recuperar a faixa." });

    if (count === 1) {
      window.setTimeout(() => void this.retryFailedTrack(track), MUTE_RETRY_DELAY_MS);
      return;
    }

    analyticsTrack("radio_skip", { ...formatTrackProps(track), reason: count >= 3 ? "disabled_after_failures" : "failed_twice" });
    this.scheduleNext(0);
  }

  private async retryFailedTrack(track: FrequencyTrack) {
    if (!this.state.active || !this.state.playing) return;
    const position = this.getPlaybackPosition();
    const located = locateFrequencySegment(
      Math.max(0, (Date.now() + this.serverOffsetMs - this.stationStartedAt) / 1000),
      this.tracks,
      this.seed,
      this.station.tagInterval,
    );
    if (located.segment.kind === "music" && located.segment.track.id === track.id) {
      await this.playMusic(track, located.offsetSec, ++this.syncVersion);
      if (this.state.playing) return;
    }
    void position;
  }

  private async syncToClock() {
    if (!this.state.active || !this.state.playing || !this.tracks.length) return;
    const syncVersion = ++this.syncVersion;
    const now = Date.now() + this.serverOffsetMs;
    const elapsedSec = Math.max(0, (now - this.stationStartedAt) / 1000);
    const forcedTrack = this.station.forcedTrackId
      ? this.tracks.find((track) => track.id === this.station.forcedTrackId) ?? null
      : null;
    const forcedStartedAt = this.station.forcedTrackId && this.station.forcedTrackId === forcedTrack?.id && this.station.forcedTrackId
      ? Number(this.station.forcedStartedAt ? new Date(this.station.forcedStartedAt).getTime() : 0)
      : 0;
    const forcedElapsed = forcedStartedAt ? Math.max(0, (now - forcedStartedAt) / 1000) : Number.POSITIVE_INFINITY;
    const located = forcedTrack && Number.isFinite(forcedElapsed) && forcedElapsed < forcedTrack.durationSec
      ? {
          segment: { kind: "music" as const, durationSec: forcedTrack.durationSec, track: forcedTrack, musicIndex: 1 },
          segmentIndex: 0,
          offsetSec: forcedElapsed,
          cycle: 0,
          cycleSegments: [{ kind: "music" as const, durationSec: forcedTrack.durationSec, track: forcedTrack, musicIndex: 1 }],
          cycleDuration: forcedTrack.durationSec,
        }
      : locateFrequencySegment(elapsedSec, this.tracks, this.seed, this.station.tagInterval);
    const current = located.segment.kind === "music" || located.segment.kind === "jingle"
      ? located.segment.track
      : this.currentTrack;
    const nextMusic = located.cycleSegments.slice(located.segmentIndex + 1).find((segment) => segment.kind === "music");
    const next = nextMusic?.kind === "music" ? nextMusic.track : null;
    const remainingMs = Math.max(0, (located.segment.durationSec - located.offsetSec) * 1000);

    this.currentSegmentIndex = located.segmentIndex;
    this.set({
      phase: located.segment.kind,
      current,
      next,
      elapsed: located.offsetSec,
      duration: located.segment.durationSec,
      error: null,
      syncStatus: this.getFreshSyncStatus(),
    });

    if (located.segment.kind === "static") {
      await this.playStatic(remainingMs);
    } else if (located.segment.kind === "tag") {
      await this.playTag(this.station.station_tag_url, remainingMs);
    } else if (located.segment.kind === "jingle") {
      await this.playJingle(located.segment.track, located.offsetSec, syncVersion);
    } else {
      await this.playMusic(located.segment.track, located.offsetSec, syncVersion);
    }

    if (syncVersion !== this.syncVersion || !this.state.active || !this.state.playing) return;

    const nowAfter = Date.now() + this.serverOffsetMs;
    const afterLocated = locateFrequencySegment(
      Math.max(0, (nowAfter - this.stationStartedAt) / 1000),
      this.tracks,
      this.seed,
      this.station.tagInterval,
    );

    if (sameFrequencySegment(afterLocated.segment, located.segment)) {
      this.scheduleNext(Math.max(0, (afterLocated.segment.durationSec - afterLocated.offsetSec) * 1000));
    } else {
      this.scheduleNext(0);
    }

    const preloadTarget = afterLocated.cycleSegments.slice(afterLocated.segmentIndex + 1).find((segment) => segment.kind === "music");
    if (preloadTarget?.kind === "music") void this.preloadNext(preloadTarget.track);
  }

  private startPresenceLoops() {
    this.clearLoops();
    this.heartbeat = window.setInterval(() => {
      if (!this.state.active || !this.state.playing) return;
      void this.clock();
      void sendFrequencyHeartbeat();
      void this.refreshListenerCount();
      const storedMember = typeof window !== "undefined" ? window.localStorage.getItem("sdt-member") : null;
      if (storedMember) void awardNightListener(storedMember, new Date().getHours());
    }, 20_000);
    this.clockTimer = window.setInterval(() => {
      if (!this.state.active || !this.state.playing) return;
      void this.clock().then(() => void this.syncToClock());
    }, 20_000);
    this.listenerTimer = window.setInterval(() => {
      if (this.state.active && this.state.playing) void this.refreshListenerCount();
    }, 10_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && this.state.active && this.state.playing) {
        void this.clock().then(() => this.syncToClock());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.visibilityCleanup = () => document.removeEventListener("visibilitychange", onVisibility);
  }

  private async refreshListenerCount() {
    const count = await getFrequencyListenerCount();
    if (this.state.active) this.set({ listenerCount: count });
  }

  private setMediaSession(trackValue: FrequencyTrack) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Frequência 808 · " + trackValue.title,
        artist: trackValue.artist,
        album: "Rádio Sindicato do Trap",
      });
      navigator.mediaSession.playbackState = this.state.playing ? "playing" : "paused";
      navigator.mediaSession.setActionHandler("play", () => void this.resume());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
    } catch {}
  }

  private setMediaSessionState(state: MediaSessionPlaybackState) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try { navigator.mediaSession.playbackState = state; } catch {}
  }

  private clearMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      for (const action of ["play", "pause"]) {
        try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, null); } catch {}
      }
    } catch {}
  }

  start = async () => {
    if (this.state.active && this.state.playing) return;
    const lifecycle = ++this.lifecycleVersion;
    this.invalidatePlayback();
    this.set({ active: true, playing: true, error: null });
    radioDial();
    if (!this.sessionStarted) {
      this.sessionStarted = true;
      let shouldEmitSession = true;
      try {
        shouldEmitSession = sessionStorage.getItem("sdt-radio-session") !== "1";
        if (shouldEmitSession) sessionStorage.setItem("sdt-radio-session", "1");
      } catch {}
      if (shouldEmitSession) analyticsTrack("radio_session_start", { sid: getAnalyticsSessionId() });
    }
    analyticsTrack("radio_start");
    tape.stop();

    // Prime the real radio source synchronously from the user gesture. No awaited work precedes this.
    const firstTrack = this.tracks.find((track) => track.kind === "music" && !track.temporarilyDisabled) ?? null;
    if (firstTrack) {
      const localAudio = this.ensureMusicAudio(firstTrack.src, firstTrack);
      localAudio.volume = effectiveVolume(this.state.volume);
      try { void localAudio.play(); } catch {}
    }

    await this.prepare();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;
    await this.syncToClock();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;
    this.startPresenceLoops();
  };

  pause = () => {
    if (!this.state.active || !this.state.playing) return;
    this.syncVersion += 1;
    this.mediaRequestVersion += 1;
    this.audio?.pause();
    this.tagAudio?.pause();
    this.stopStatic();
    this.clearLoops();
    const position = this.getPlaybackPosition();
    analyticsTrack("radio_pause");
    this.set({ playing: false, elapsed: position.elapsed, duration: position.duration });
    this.setMediaSessionState("paused");
  };

  resume = async () => {
    if (!this.state.active) return this.start();
    const lifecycle = ++this.lifecycleVersion;
    this.set({ playing: true, error: null });
    analyticsTrack("radio_resume");
    this.startLocalPlaybackForGesture();
    await this.prepare();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;
    await this.syncToClock();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;
    this.startPresenceLoops();
  };

  private startLocalPlaybackForGesture() {
    if (!this.tracks.length) return;
    const elapsedSec = Math.max(0, (Date.now() + this.serverOffsetMs - this.stationStartedAt) / 1000);
    const located = locateFrequencySegment(elapsedSec, this.tracks, this.seed, this.station.tagInterval);
    const track = located.segment.kind === "music" || located.segment.kind === "jingle" ? located.segment.track : this.currentTrack;
    if (!track) return;
    const audio = this.ensureMusicAudio(track.src, track);
    audio.volume = effectiveVolume(this.state.volume);
    try { void audio.play(); } catch {}
    this.currentTrack = track;
    this.set({ phase: located.segment.kind, current: track, elapsed: located.offsetSec, duration: located.segment.durationSec });
  }

  stop = () => {
    if (this.state.active) analyticsTrack("radio_stop");
    this.lifecycleVersion += 1;
    this.invalidatePlayback();
    this.clearMediaSession();
    this.set({ active: false, playing: false, phase: null, current: null, next: null, elapsed: 0, duration: 0 });
  };

  setVolume = (value: number) => {
    const safe = clamp(value, 0, 1);
    try { window.localStorage.setItem("sdt-radio-volume", String(safe)); } catch {}
    this.set({ volume: safe });
    this.applyVolumes();
  };

  level() {
    if (!this.state.playing) return 0;
    const position = this.getPlaybackPosition();
    return clamp(0.22 + 0.68 * Math.abs(Math.sin(position.elapsed * 3.3 + (this.currentTrack?.position ?? 0))), 0, 1);
  }

  isOnAir(artistName: string) {
    const current = this.state.current;
    return Boolean(this.state.phase === "music" && current && current.artist.toLowerCase().includes(artistName.toLowerCase()));
  }

  private emitInitialVolumeEvent() {
    this.applyVolumes();
  }

  destroy() {
    this.muteCleanup?.();
    this.muteCleanup = null;
  }
}

export const frequency = new FrequencyEngine();
