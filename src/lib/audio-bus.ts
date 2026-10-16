const MUTE_KEY = "sdt-mute";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function readStoredMute(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredMute(value: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Storage may be unavailable.
  }
}

function syncGain(value: boolean): void {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.01);
}

function ensureBus(c: AudioContext): GainNode {
  if (!master) {
    master = c.createGain();
    master.gain.value = readStoredMute() ? 0 : 1;
    master.connect(c.destination);
  }
  return master;
}

export function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    ensureBus(ctx);
    void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

export function out(): GainNode | null {
  const c = getCtx();
  return c ? ensureBus(c) : null;
}

const VOLUME_KEY = "sdt-radio-volume";

function readVolume(): number {
  try {
    const raw = Number(window.localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.82;
  } catch {
    return 0.82;
  }
}

function writeVolume(value: number): void {
  try { window.localStorage.setItem(VOLUME_KEY, String(value)); } catch { /* Volume persistence is optional when storage is blocked. */ }
}

export function getRadioVolume(): number {
  if (typeof window === "undefined") return 0.82;
  return readVolume();
}

export function setRadioVolume(value: number): void {
  if (typeof window === "undefined") return;
  const safe = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.82));
  writeVolume(safe);
  window.dispatchEvent(new Event("sdt-radio-volume"));
}

export function subscribeRadioVolume(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("sdt-radio-volume", listener);
  return () => window.removeEventListener("sdt-radio-volume", listener);
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return readStoredMute();
}

export function setMuted(value: boolean): void {
  if (typeof window === "undefined") return;
  writeStoredMute(value);
  syncGain(value);
  window.dispatchEvent(new Event("sdt-mute"));
}

export function subscribeMute(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key !== MUTE_KEY) return;
    syncGain(isMuted());
    listener();
  };

  window.addEventListener("sdt-mute", listener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("sdt-mute", listener);
    window.removeEventListener("storage", onStorage);
  };
}
