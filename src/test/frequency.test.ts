import { describe, expect, it } from "vitest";
import {
  buildFrequencyCycle,
  cycleDuration,
  locateFrequencySegment,
  type FrequencyTrack,
} from "@/lib/frequency";
import { RADIO_TRACKS } from "@/lib/data";

const tracks: FrequencyTrack[] = [
  { id: "1", title: "A", artist: "A", src: "/a.mp3", durationSec: 30, kind: "music", rotationWeight: 1, position: 1, failureCount: 0, temporarilyDisabled: false, source: "radio" },
  { id: "2", title: "B", artist: "B", src: "/b.mp3", durationSec: 31, kind: "music", rotationWeight: 1, position: 2, failureCount: 0, temporarilyDisabled: false, source: "radio" },
  { id: "3", title: "C", artist: "C", src: "/c.mp3", durationSec: 29, kind: "music", rotationWeight: 1, position: 3, failureCount: 0, temporarilyDisabled: false, source: "radio" },
  { id: "4", title: "D", artist: "D", src: "/d.mp3", durationSec: 30, kind: "music", rotationWeight: 1, position: 4, failureCount: 0, temporarilyDisabled: false, source: "radio" },
];

describe("frequency scheduler", () => {
  it("keeps cycle duration deterministic", () => {
    const a = buildFrequencyCycle(tracks, 808, 2);
    const b = buildFrequencyCycle(tracks, 808, 2);
    expect(cycleDuration(a)).toBe(cycleDuration(b));
    expect(a).toEqual(b);
  });

  it("changes the randomized order with the cycle seed", () => {
    const a = buildFrequencyCycle(tracks, 808, 1).filter((x) => x.kind === "music").map((x) => x.track.id);
    const b = buildFrequencyCycle(tracks, 808, 2).filter((x) => x.kind === "music").map((x) => x.track.id);
    expect(a).not.toEqual(b);
  });

  it("inserts the station tag after every third music item", () => {
    const segments = buildFrequencyCycle(tracks, 808, 0);
    const tagIndexes = segments.map((segment, index) => segment.kind === "tag" ? index : -1).filter((index) => index >= 0);
    expect(tagIndexes.length).toBe(1);
    expect(segments[tagIndexes[0]!]!.musicIndex).toBe(3);
  });

  it("locates a shared second inside the correct music segment", () => {
    const segments = buildFrequencyCycle(tracks, 808, 0);
    const total = cycleDuration(segments);
    const located = locateFrequencySegment(31, tracks, 808);
    expect(located.offsetSec).toBeGreaterThanOrEqual(0);
    expect(located.offsetSec).toBeLessThan(located.segment.durationSec);
    expect(located.cycleDuration).toBe(total);
  });

  it("advances to the next deterministic cycle after one cycle duration", () => {
    const segments = buildFrequencyCycle(tracks, 808, 0);
    const total = cycleDuration(segments);
    const located = locateFrequencySegment(total + 12, tracks, 808);
    expect(located.cycle).toBe(1);
    expect(located.offsetSec).toBeGreaterThanOrEqual(0);
    expect(located.offsetSec).toBeLessThan(located.segment.durationSec);
  });

  it("keeps the nine production radio URLs separate from the site preview tapes", () => {
    expect(RADIO_TRACKS).toHaveLength(9);
    expect(RADIO_TRACKS.every((track) => track.src.includes("files.catbox.moe"))).toBe(true);
    expect(RADIO_TRACKS.some((track) => track.src.includes("nova-wave.mp3"))).toBe(false);
    expect(RADIO_TRACKS.some((track) => track.src.includes("phantom-mode.mp3"))).toBe(false);
  });
});
