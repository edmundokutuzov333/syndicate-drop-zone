export type AudioOwner = "radio" | "tape" | null;

let owner: AudioOwner = null;
let generation = 0;
const listeners = new Set<(next: AudioOwner) => void>();

function notify(next: AudioOwner) {
  listeners.forEach((listener) => listener(next));
}

export function getAudioOwner(): AudioOwner {
  return owner;
}

export function subscribeAudioOwner(listener: (next: AudioOwner) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function claimAudioOwner(next: Exclude<AudioOwner, null>): number {
  generation += 1;
  owner = next;
  notify(next);
  return generation;
}

export function releaseAudioOwner(expected?: Exclude<AudioOwner, null>): void {
  if (expected && owner !== expected) return;
  generation += 1;
  owner = null;
  notify(null);
}

export function ownsAudio(ownerValue: Exclude<AudioOwner, null>): boolean {
  return owner === ownerValue;
}
