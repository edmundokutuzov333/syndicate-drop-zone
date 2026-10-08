import { getCtx, getRadioVolume, isMuted, subscribeMute } from "@/lib/audio-bus";
import {
  getLiveRadioBlocks,
  getLiveRadioStation,
  getLiveRadioTracks,
  type LiveRadioBlock,
  type LiveRadioStation,
  type LiveRadioTrack,
} from "@/lib/site-content";
import {
  getFrequencyClock,
  getFrequencyListenerCount,
  markRadioTrackFailure,
  sendFrequencyHeartbeat,
  awardNightListener,
} from "@/lib/frequency-api";
import { kick808, radioDial } from "@/lib/sfx";
import { tape } from "@/lib/tape-engine";
import { claimAudioOwner, releaseAudioOwner, ownsAudio } from "@/lib/audio-session";
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
const MUTE_RETRY_DELAY_MS = 800;
const ALLOWED_RADIO_SOURCES = new Set(RADIO_TRACKS.map((track) => track.src));

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
  return seededShuffle(weighted, seed).filter(
    (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
  );
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
    segments.push({
      kind: lastIndex % interval === 0 ? "tag" : "static",
      durationSec: lastIndex % interval === 0 ? TAG_SECONDS : STATIC_SECONDS,
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

function formatTrackProps(track: FrequencyTrack) {
  return { track: track.id, title: track.title, artist: track.artist };
}

function effectiveVolume(volume: number): number {
  return isMuted() ? 0 : clamp(volume, 0, 1);
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

type PreparedAudio = {
  audio: HTMLAudioElement;
  trackId: string;
};

export class FrequencyEngine {
  private audio: HTMLAudioElement | null = null;
  private preloaded: PreparedAudio | null = null;
  private tagAudio: HTMLAudioElement | null = null;
  private currentTrack: FrequencyTrack | null = null;
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
  private blocks: LiveRadioBlock[] = [];
  private queue: FrequencyTrack[] = [];
  private queueIndex = -1;
  private cycle = 0;
  private musicCount = 0;
  private transitionStartedAt = 0;
  private transitionDurationSec = 0;
  private timer: number | null = null;
  private heartbeat: number | null = null;
  private clockTimer: number | null = null;
  private listenerTimer: number | null = null;
  private visibilityCleanup: (() => void) | null = null;
  private programPromise: Promise<void> | null = null;
  private clockPromise: Promise<void> | null = null;
  private lifecycleVersion = 0;
  private mediaRequestVersion = 0;
  private clockLastSuccessAt = 0;
  private serverOffsetMs = 0;
  private stationStartedAt = Date.now();
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

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<FrequencyState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private getFreshSyncStatus(): FrequencySyncStatus {
    if (!this.clockLastSuccessAt) return this.state.syncStatus;
    const age = Date.now() - this.clockLastSuccessAt;
    if (age > 90_000) return "offline_clock";
    if (age > 35_000) return "sync_degraded";
    return "sync_ok";
  }

  getPlaybackPosition() {
    if (!this.state.active) {
      return {
        elapsed: 0,
        duration: this.state.duration,
        remaining: this.state.duration,
        phase: this.state.phase,
        syncStatus: this.getFreshSyncStatus(),
      };
    }

    if (this.state.phase === "music" || this.state.phase === "jingle") {
      const audioTime = this.audio?.currentTime;
      const duration = parseDuration(this.audio?.duration) || this.state.duration || this.currentTrack?.durationSec || DEFAULT_DURATION;
      const elapsed = Number.isFinite(audioTime) ? Math.max(0, audioTime) : this.state.elapsed;
      return {
        elapsed: Math.min(elapsed, duration),
        duration,
        remaining: Math.max(0, duration - elapsed),
        phase: this.state.phase,
        syncStatus: this.getFreshSyncStatus(),
      };
    }

    if (this.state.phase === "tag" || this.state.phase === "static") {
      const elapsed = Math.max(0, (Date.now() - this.transitionStartedAt) / 1000);
      return {
        elapsed: Math.min(elapsed, this.transitionDurationSec),
        duration: this.transitionDurationSec,
        remaining: Math.max(0, this.transitionDurationSec - elapsed),
        phase: this.state.phase,
        syncStatus: this.getFreshSyncStatus(),
      };
    }

    return {
      elapsed: this.state.elapsed,
      duration: this.state.duration,
      remaining: Math.max(0, this.state.duration - this.state.elapsed),
      phase: this.state.phase,
      syncStatus: this.getFreshSyncStatus(),
    };
  }

  prepare = (): Promise<void> => {
    const program = this.programPromise ?? (this.programPromise = this.loadProgram().finally(() => {
      this.programPromise = null;
    }));
    const clock = this.clockPromise ?? (this.clockPromise = this.clock().finally(() => {
      this.clockPromise = null;
    }));
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
    return Array.from({ length: 24 }, (_, index) =>
      clamp(base * (0.55 + Math.abs(Math.sin(elapsed * (2.1 + index * 0.07) + index))), 0, 1),
    );
  };

  private async loadProgram() {
    const [rawTracks, rawStation, rawBlocks] = await Promise.all([
      getLiveRadioTracks(),
      getLiveRadioStation(),
      getLiveRadioBlocks(),
    ]);

    this.station = rawStation;
    this.blocks = rawBlocks;
    this.stationStartedAt = Date.now();

    const metadataBySource = new Map(
      rawTracks
        .filter((track) => ALLOWED_RADIO_SOURCES.has(track.src))
        .map((track) => [track.src, track]),
    );

    // A rádio é um catálogo fechado. Os únicos áudios elegíveis são os nove
    // ficheiros fornecidos para a Frequência 808. Blocos editoriais nunca podem
    // introduzir previews, assets ou outras fontes no player.
    this.tracks = RADIO_TRACKS
      .map((seed, index) => {
        const metadata = metadataBySource.get(seed.src);
        return {
          id: metadata?.id ?? seed.id,
          title: metadata?.title ?? seed.title,
          artist: metadata?.artist ?? seed.artist,
          src: seed.src,
          durationSec: parseDuration(metadata?.durationSec) || DEFAULT_DURATION,
          kind: "music" as const,
          rotationWeight: Math.max(1, metadata?.rotationWeight ?? 1),
          position: metadata?.position ?? index + 1,
          failureCount: metadata?.failureCount ?? 0,
          temporarilyDisabled: metadata?.temporarilyDisabled ?? false,
          source: "radio" as const,
        };
      })
      .filter((track) => !track.temporarilyDisabled && ALLOWED_RADIO_SOURCES.has(track.src));

    this.rebuildQueue(true);
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
        this.clockLastSuccessAt = Date.now();
        this.set({ syncStatus: "sync_ok" });
        return;
      }
    } catch {}

    this.set({ syncStatus: this.clockLastSuccessAt ? "sync_degraded" : "offline_clock" });
  }

  private rebuildQueue(forceFresh = false) {
    const available = this.tracks.filter((track) => !track.temporarilyDisabled && track.kind === "music");
    if (!available.length) {
      this.queue = [];
      this.queueIndex = -1;
      this.set({ next: null });
      return;
    }

    const seed = this.station.stationSeed + this.cycle * 7919 + (forceFresh ? Date.now() : 0);
    let nextQueue = weightedShuffle(available, seed);

    if (this.currentTrack && nextQueue.length > 1 && nextQueue[0]?.id === this.currentTrack.id) {
      const swapIndex = nextQueue.findIndex((track) => track.id !== this.currentTrack?.id);
      if (swapIndex > 0) {
        [nextQueue[0], nextQueue[swapIndex]] = [nextQueue[swapIndex]!, nextQueue[0]!];
      }
    }

    const forced = this.cycle === 0 && this.station.forcedTrackId
      ? nextQueue.find((track) => track.id === this.station.forcedTrackId)
      : null;

    if (forced) {
      nextQueue = [forced, ...nextQueue.filter((track) => track.id !== forced.id)];
    }

    this.queue = nextQueue;
    this.queueIndex = -1;
  }

  private peekNextTrack(): FrequencyTrack | null {
    const nextIndex = this.queueIndex + 1;
    if (nextIndex < this.queue.length) return this.queue[nextIndex] ?? null;
    return null;
  }

  private selectNextTrack(): FrequencyTrack | null {
    let next = this.peekNextTrack();
    if (!next) {
      this.cycle += 1;
      this.rebuildQueue();
      next = this.peekNextTrack();
    }
    if (!next) return null;

    this.queueIndex += 1;
    this.set({ next: this.peekNextTrack() });
    return next;
  }

  private ensureMusicAudio(track: FrequencyTrack): HTMLAudioElement {
    const src = track.src;

    if (this.audio && this.audio.src === src) return this.audio;

    if (this.preloaded?.trackId === track.id) {
      const prepared = this.preloaded.audio;
      this.preloaded = null;
      this.attachAudioListeners(prepared, track);
      this.audio = prepared;
      return prepared;
    }

    const audio = new Audio();
    audio.preload = "auto";
    audio.src = src;
    this.attachAudioListeners(audio, track);
    this.audio = audio;
    return audio;
  }

  private attachAudioListeners(audio: HTMLAudioElement, track: FrequencyTrack) {
    if (audio.dataset.sdtBound === "1") return;
    audio.dataset.sdtBound = "1";

    audio.addEventListener("loadedmetadata", () => {
      const duration = parseDuration(audio.duration);
      if (duration) {
        track.durationSec = duration;
        if (this.currentTrack?.id === track.id) this.set({ duration });
      }
    });

    audio.addEventListener("error", () => {
      if (this.state.active && this.currentTrack?.id === track.id && this.audio === audio) {
        void this.handleTrackError(track, "audio_error");
      } else if (this.preloaded?.trackId === track.id) {
        this.preloaded = null;
      }
    });

    audio.addEventListener("ended", () => {
      if (this.state.active && this.audio === audio && this.currentTrack?.id === track.id) {
        void this.handleTrackEnded(track);
      }
    });

    audio.addEventListener("timeupdate", () => {
      if (this.currentTrack?.id !== track.id || this.audio !== audio || !this.state.playing) return;
      this.emitMilestones(track, audio.currentTime, parseDuration(audio.duration) || track.durationSec);
    });

    audio.addEventListener("play", () => {
      if (this.currentTrack?.id === track.id && this.audio === audio) {
        this.set({ playing: true, error: null });
        this.setMediaSession(track);
      }
    });

    audio.addEventListener("pause", () => {
      if (
        this.currentTrack?.id === track.id &&
        this.audio === audio &&
        this.state.active &&
        this.state.phase === "music"
      ) {
        this.set({ playing: false });
        this.setMediaSessionState("paused");
      }
    });
  }

  private async preloadNext(track: FrequencyTrack | null) {
    if (!track || track.kind !== "music" || track.id === this.currentTrack?.id) return;
    if (this.preloaded?.trackId === track.id) return;

    this.preloaded?.audio.pause();

    const audio = new Audio();
    audio.preload = "auto";
    audio.src = track.src;
    this.preloaded = { audio, trackId: track.id };
    this.attachAudioListeners(audio, track);

    try {
      audio.load();
    } catch {}
  }

  private applyVolumes() {
    const volume = effectiveVolume(this.state.volume);
    if (this.audio) this.audio.volume = volume;
    if (this.preloaded) this.preloaded.audio.volume = volume;
    if (this.tagAudio) this.tagAudio.volume = volume;
  }

  private stopStatic() {
    try {
      this.staticSource?.stop();
    } catch {}
    this.staticSource = null;
  }

  private staticSource: AudioBufferSourceNode | null = null;

  private playStatic(durationSec: number) {
    const ctx = getCtx();
    if (!ctx || durationSec <= 0) {
      window.setTimeout(() => void this.playNextAfterTransition(), Math.max(0, durationSec * 1000));
      return;
    }

    try {
      this.staticSource?.stop();
    } catch {}

    const gain = ctx.createGain();
    gain.gain.value = effectiveVolume(this.state.volume) * 0.2;
    const buffer = ctx.createBuffer(
      1,
      Math.max(1, Math.ceil(ctx.sampleRate * Math.min(1.2, durationSec))),
      ctx.sampleRate,
    );
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const envelope = Math.min(
        1,
        i / (ctx.sampleRate * 0.03),
        (data.length - i) / (ctx.sampleRate * 0.07),
      );
      data[i] = (Math.random() * 2 - 1) * 0.14 * Math.max(0, envelope);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.onended = () => {
      if (this.staticSource !== source) return;
      this.staticSource = null;
      void this.playNextAfterTransition();
    };

    this.staticSource = source;
    this.transitionStartedAt = Date.now();
    this.transitionDurationSec = durationSec;
    this.set({ phase: "static", playing: true, elapsed: 0, duration: durationSec });
    this.setMediaSessionState("playing");
    source.start();
  }

  private async playTag(durationSec: number) {
    if (!this.station.station_tag_url) {
      this.playStatic(Math.max(STATIC_SECONDS, durationSec));
      return;
    }

    this.tagAudio ??= new Audio();
    this.tagAudio.preload = "auto";
    this.tagAudio.src = this.station.station_tag_url;
    this.tagAudio.currentTime = 0;
    this.tagAudio.volume = effectiveVolume(this.state.volume);

    this.transitionStartedAt = Date.now();
    this.transitionDurationSec = durationSec;
    this.set({ phase: "tag", playing: true, elapsed: 0, duration: durationSec });
    this.setMediaSessionState("playing");

    const requestVersion = ++this.mediaRequestVersion;
    try {
      await this.tagAudio.play();
    } catch {
      if (requestVersion !== this.mediaRequestVersion || !this.state.active) return;
    }

    window.setTimeout(() => void this.playNextAfterTransition(), Math.max(0, durationSec * 1000));
  }

  private async playNextAfterTransition() {
    if (!this.state.active || !this.state.playing) return;
    this.stopStatic();
    if (this.tagAudio) this.tagAudio.pause();
    const next = this.selectNextTrack();
    if (!next) {
      this.set({
        playing: false,
        error: "A rotação ficou sem faixas disponíveis.",
      });
      return;
    }

    await this.playMusic(next, 0);
  }

  private async playMusic(track: FrequencyTrack, offsetSec = 0) {
    const previousTrack = this.currentTrack;
    const audio = this.ensureMusicAudio(track);

    if (this.audio && this.audio !== audio && !this.audio.paused) {
      this.audio.pause();
    }

    this.currentTrack = track;
    this.trackMilestones.clear();
    this.trackMilestones.add(0);

    const duration = parseDuration(audio.duration) || track.durationSec || DEFAULT_DURATION;
    this.set({
      phase: "music",
      current: track,
      next: this.peekNextTrack(),
      duration,
      elapsed: clamp(offsetSec, 0, Math.max(0, duration - 0.05)),
      error: null,
      playing: true,
    });

    try {
      audio.currentTime = clamp(offsetSec, 0, Math.max(0, duration - 0.05));
    } catch {}

    audio.volume = effectiveVolume(this.state.volume);

    const requestVersion = ++this.mediaRequestVersion;
    try {
      if (audio.paused) await audio.play();
    } catch (error) {
      if (requestVersion !== this.mediaRequestVersion) return;
      analyticsTrack("radio_track_error", {
        ...formatTrackProps(track),
        reason: error instanceof Error ? error.name : "play_rejected",
      });
      return this.handleTrackError(track, "play_rejected");
    }

    if (requestVersion !== this.mediaRequestVersion || !this.state.active) return;

    analyticsTrack("radio_track_start", formatTrackProps(track));
    this.setMediaSession(track);
    await this.preloadNext(this.peekNextTrack());
    void previousTrack;
  }

  private async handleTrackEnded(track: FrequencyTrack) {
    analyticsTrack("radio_track_end", formatTrackProps(track));
    this.trackMilestones.clear();

    const next = this.peekNextTrack();
    if (!next && this.queueIndex >= this.queue.length - 1) {
      this.cycle += 1;
      this.rebuildQueue();
    }

    this.musicCount += 1;
    const shouldTag = this.station.tagInterval > 0 && this.musicCount % this.station.tagInterval === 0;

    if (shouldTag) {
      this.playTag(TAG_SECONDS);
    } else {
      this.playStatic(STATIC_SECONDS);
    }
  }

  private emitMilestones(track: FrequencyTrack, elapsed: number, duration: number) {
    if (!duration || duration <= 0) return;
    const ratio = elapsed / duration;
    for (const mark of [25, 50, 75] as const) {
      if (ratio >= mark / 100 && !this.trackMilestones.has(mark)) {
        this.trackMilestones.add(mark);
        analyticsTrack(
          ("radio_track_" + mark) as "radio_track_25" | "radio_track_50" | "radio_track_75",
          formatTrackProps(track),
        );
      }
    }
  }

  private async handleTrackError(track: FrequencyTrack, reason: string) {
    const currentCount = this.failureCounts.get(track.id) ?? track.failureCount ?? 0;
    if (currentCount >= 3) return;

    analyticsTrack("radio_track_error", { ...formatTrackProps(track), reason });

    const localCount = currentCount + 1;
    this.failureCounts.set(track.id, localCount);

    const serverCount = await markRadioTrackFailure(track.id);
    const count = Math.max(localCount, serverCount);

    track.failureCount = count;

    if (count >= 3) {
      track.temporarilyDisabled = true;
      this.queue = this.queue.filter((item) => item.id !== track.id);
      this.set({
        error: "A faixa foi retirada da rotação por falhas consecutivas.",
      });
    } else {
      this.set({
        error: "Interferência detectada. A emissão está a recuperar a faixa.",
      });
    }

    if (count === 1) {
      window.setTimeout(() => void this.retryFailedTrack(track), MUTE_RETRY_DELAY_MS);
      return;
    }

    analyticsTrack("radio_skip", {
      ...formatTrackProps(track),
      reason: count >= 3 ? "disabled_after_failures" : "failed_twice",
    });

    void this.playNextAfterFailure(track);
  }

  private async retryFailedTrack(track: FrequencyTrack) {
    if (!this.state.active || !this.state.playing || this.currentTrack?.id !== track.id) return;
    try {
      this.audio?.pause();
      if (this.audio) this.audio.currentTime = 0;
    } catch {}
    await this.playMusic(track, 0);
  }

  private async playNextAfterFailure(failedTrack: FrequencyTrack) {
    if (!this.state.active || !this.state.playing) return;
    if (this.currentTrack?.id === failedTrack.id && this.audio) this.audio.pause();
    const next = this.selectNextTrack();
    if (!next) {
      this.set({
        playing: false,
        error: "Não existem mais faixas disponíveis.",
      });
      return;
    }
    await this.playMusic(next, 0);
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
      if (!this.state.active) return;
      void this.clock();
    }, 20_000);

    this.listenerTimer = window.setInterval(() => {
      if (this.state.active && this.state.playing) void this.refreshListenerCount();
    }, 10_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && this.state.active) {
        void this.clock();
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
    try {
      navigator.mediaSession.playbackState = state;
    } catch {}
  }

  private clearMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      for (const action of ["play", "pause"]) {
        try {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, null);
        } catch {}
      }
    } catch {}
  }

  private invalidatePlayback() {
    this.mediaRequestVersion += 1;
    this.audio?.pause();
    this.preloaded?.audio.pause();
    this.preloaded = null;
    this.tagAudio?.pause();
    this.stopStatic();
    this.clearLoops();
  }

  start = async () => {
    if (this.state.active && this.state.playing) return;

    const lifecycle = ++this.lifecycleVersion;
    this.invalidatePlayback();
    claimAudioOwner("radio");
    tape.stop();
    this.set({ active: true, playing: true, error: null });
    radioDial();
    kick808();

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

    const primeTrack = this.tracks.find((track) => track.kind === "music" && !track.temporarilyDisabled) ?? null;
    if (primeTrack) {
      const primeAudio = this.ensureMusicAudio(primeTrack);
      primeAudio.volume = effectiveVolume(this.state.volume);
      try {
        void primeAudio.play();
      } catch {}
    }

    await this.prepare();
    if (lifecycle !== this.lifecycleVersion || !this.state.active) return;

    this.rebuildQueue(true);
    if (primeTrack) {
      const preferredIndex = this.queue.findIndex((track) => track.id === primeTrack.id);
      if (preferredIndex > 0) {
        [this.queue[0], this.queue[preferredIndex]] = [this.queue[preferredIndex]!, this.queue[0]!];
      }
    }
    const first = this.selectNextTrack();
    if (!first) {
      this.set({
        playing: false,
        error: "Não existem faixas publicadas para a Frequência 808.",
      });
      return;
    }

    await this.playMusic(first, 0);
    if (lifecycle !== this.lifecycleVersion || !this.state.active) return;

    this.startPresenceLoops();
  };

  pause = () => {
    if (!this.state.active || !this.state.playing) return;
    const position = this.getPlaybackPosition();

    this.audio?.pause();
    this.tagAudio?.pause();
    this.stopStatic();
    this.clearLoops();

    analyticsTrack("radio_pause");
    this.set({
      playing: false,
      elapsed: position.elapsed,
      duration: position.duration,
    });
    this.setMediaSessionState("paused");
  };

  resume = async () => {
    if (!this.state.active) return this.start();

    const lifecycle = ++this.lifecycleVersion;
    this.set({ playing: true, error: null });
    analyticsTrack("radio_resume");

    if (this.audio && this.currentTrack) {
      this.audio.volume = effectiveVolume(this.state.volume);
      try {
        void this.audio.play();
      } catch {}
    } else {
      const first = this.currentTrack ?? this.selectNextTrack();
      if (first) void this.playMusic(first, 0);
    }

    await this.prepare();
    if (lifecycle !== this.lifecycleVersion || !this.state.active || !this.state.playing) return;

    this.startPresenceLoops();
  };

  stop = () => {
    if (this.state.active) analyticsTrack("radio_stop");
    this.lifecycleVersion += 1;
    this.invalidatePlayback();
    this.clearMediaSession();
    if (ownsAudio("radio")) releaseAudioOwner("radio");
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = -1;
    this.set({
      active: false,
      playing: false,
      phase: null,
      current: null,
      next: null,
      elapsed: 0,
      duration: 0,
    });
  };

  setVolume = (value: number) => {
    const safe = clamp(value, 0, 1);
    try {
      window.localStorage.setItem("sdt-radio-volume", String(safe));
    } catch {}
    this.set({ volume: safe });
    this.applyVolumes();
  };

  level() {
    if (!this.state.playing) return 0;
    const position = this.getPlaybackPosition();
    return clamp(
      0.22 + 0.68 * Math.abs(Math.sin(position.elapsed * 3.3 + (this.currentTrack?.position ?? 0))),
      0,
      1,
    );
  }

  isOnAir(artistName: string) {
    const current = this.state.current;
    return Boolean(
      this.state.phase === "music" &&
      current &&
      current.artist.toLowerCase().includes(artistName.toLowerCase()),
    );
  }

  destroy() {
    this.invalidatePlayback();
    this.muteCleanup?.();
    this.muteCleanup = null;
  }
}

export const frequency = new FrequencyEngine();
