import { describe, expect, it } from "vitest";
import {
  buildFrequencyCycle,
  cycleDuration,
  locateFrequencySegment,
  type FrequencyTrack,
} from "@/lib/frequency";

const tracks: FrequencyTrack[] = [
  { id: "1", title: "A", artist: "A", src: "/a.mp3", durationSec: 30, source: "site" },
  { id: "2", title: "B", artist: "B", src: "/b.mp3", durationSec: 31, source: "site" },
  { id: "3", title: "C", artist: "C", src: "/c.mp3", durationSec: 29, source: "site" },
  { id: "4", title: "D", artist: "D", src: "/d.mp3", durationSec: 30, source: "site" },
];

describe("frequency scheduler", () => {
  it("keeps cycle duration deterministic", () => {
    const a = buildFrequencyCycle(tracks, 808, 2);
    const b = buildFrequencyCycle(tracks, 808, 2);
    expect(cycleDuration(a)).toBe(cycleDuration(b));
    expect(a).toEqual(b);
  });

  it("changes shuffle order with the cycle seed", () => {
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

  it("loops back to the same deterministic program after one cycle", () => {
    const segments = buildFrequencyCycle(tracks, 808, 0);
    const total = cycleDuration(segments);
    const a = locateFrequencySegment(12, tracks, 808);
    const b = locateFrequencySegment(total + 12, tracks, 808);
    expect(a.segment.kind).toBe(b.segment.kind);
    expect(a.segment.kind === "music" && b.segment.kind === "music" ? a.segment.track.id : "x")
      .toBe(a.segment.kind === "music" && b.segment.kind === "music" ? b.segment.track.id : "x");
  });
});
