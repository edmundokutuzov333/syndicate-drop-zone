import { describe, expect, it } from "vitest";
import { RADIO_TRACKS } from "@/lib/data";
import { mapLiveRadioCatalogRows } from "@/lib/site-content";

describe("live radio catalog source of truth", () => {
  it("uses only enabled rows from the backend and preserves backend ordering", () => {
    const rows = [
      { id: "track-3", title: "Third", artist: "A", audio_url: RADIO_TRACKS[2]!.src, kind: "music", track_position: 3 },
      { id: "track-disabled", title: "Disabled", artist: "A", audio_url: RADIO_TRACKS[1]!.src, kind: "music", track_position: 2, temporarily_disabled: true },
      { id: "track-1", title: "First", artist: "A", audio_url: RADIO_TRACKS[0]!.src, kind: "music", track_position: 1 },
    ];
    const mapped = mapLiveRadioCatalogRows(rows, false);
    expect(mapped.map((track) => track.id)).toEqual(["track-1", "track-3"]);
    expect(mapped.some((track) => track.id === "track-disabled")).toBe(false);
  });

  it("does not resurrect static tracks when the production backend catalog is empty", () => {
    expect(mapLiveRadioCatalogRows([], false)).toEqual([]);
    expect(mapLiveRadioCatalogRows([{ id: "disabled", audio_url: RADIO_TRACKS[0]!.src, temporarily_disabled: true }], false)).toEqual([]);
  });

  it("rejects audio sources that are not in the approved radio source list", () => {
    expect(mapLiveRadioCatalogRows([{ id: "unknown", audio_url: "https://example.invalid/private.mp3", track_position: 1 }], false)).toEqual([]);
  });

  it("keeps authored emergency fallbacks in development only", () => {
    const fallback = mapLiveRadioCatalogRows([], true);
    expect(fallback).toHaveLength(9);
    expect(fallback.map((track) => track.src)).toEqual(RADIO_TRACKS.map((track) => track.src));
  });
});
