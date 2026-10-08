export type AudioOwner = "radio" | "tape" | null;

let owner: AudioOwner = null;
let generation = 0;

export function getAudioOwner(): AudioOwner {
  return owner;
}

export function claimAudioOwner(next: Exclude<AudioOwner, null>): number {
  generation += 1;
  owner = next;
  return generation;
}

export function releaseAudioOwner(expected?: Exclude<AudioOwner, null>): void {
  if (expected && owner !== expected) return;
  generation += 1;
  owner = null;
}

export function ownsAudio(ownerValue: Exclude<AudioOwner, null>): boolean {
  return owner === ownerValue;
}
