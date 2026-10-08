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

  it("uses exactly the nine supplied direct Discord audio sources", () => {
    expect(RADIO_TRACKS.map((track) => track.src)).toEqual([
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557765898171842621/A_BAG_Complete.mp3?ex=6ac8fe0c&is=6ac7ac8c&hm=1494126ae70966427cf777eb721772f3d4ef00814f3b7412937c89cf1b266b14&",
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557765662632575076/CHOPPER_1.mp3?ex=6ac8fdd3&is=6ac7ac53&hm=24be6c48e7ed9407277b217d90625b7208763f014fde12da7a6cdb4f2298cef4&",
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557765539441410178/FREESTYLE_SUJO.mp3?ex=6ac8fdb6&is=6ac7ac36&hm=1505bde309c1d01f5fe53938aa22637dac8accffce29b90fb90a63c94fa55c42&",
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557765583716614184/IM_FLEXIN_UP-KHRIYS_FT_GOMONEY.mp3?ex=6ac8fdc1&is=6ac7ac41&hm=5b7ee0a19fb3207d340c10bea0ebc551b0937b66a6de1cf8cf0f9cbaf58c9179&",
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557765540070559885/MONEY_TALK_2.1_MELHOR_QUALIDADE.mp3?ex=6ac8fdb6&is=6ac7ac36&hm=ff97f95b66b387da151f5fcc10e5a2d8767569ff4d8861632469148e7a50d148&",
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557765342690942986/TSANTO_DOUGH_1.mp3?ex=6ac8fd87&is=6ac7ac07&hm=9e02b411d4a7d54858462fcf40b4940708052c51b51ac2e01c5857200c5c6f71&",
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557766706838114324/Unmastered_PHANTOM_Kingston_Siriro_Elton_Penicela_-_Fashion_de_Phantom.mp3?ex=6ac8fecc&is=6ac7ad4c&hm=9c70066a9c203dbb469d1cf40fa26b3f2eeb987c45fff12942eefbc1f83741d1&",
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557766760034345020/Phantom_Bruno_The_Goat_Alemao_Wav__Elton_Penicela_-_A_Nova_Wave.mp3?ex=6ac8fed9&is=6ac7ad59&hm=65d0da1218a5d5b655ff7a83b3e8658942e24fde6dbd0817f36b9a36ae475be4&",
      "https://cdn.discordapp.com/attachments/1313921250678014022/1557766742204223548/PHANTOM_Mode_2_-_The_Final_Movie_W__INF8M8US_HEYYG_KINGSTON_SIRIRO.mp3?ex=6ac8fed5&is=6ac7ad55&hm=2359055ed92ca9baa8799a4abeaf9ec0bb9295072b4883b658a86c581705f89a&",
    ]);
    expect(new Set(RADIO_TRACKS.map((track) => track.src)).size).toBe(9);
    expect(RADIO_TRACKS.every((track) => track.kind === "music")).toBe(true);
    expect(RADIO_TRACKS.every((track) => track.src.startsWith("https://cdn.discordapp.com/attachments/"))).toBe(true);
    expect(RADIO_TRACKS.every((track) => !track.src.includes("files.catbox.moe"))).toBe(true);
    expect(RADIO_TRACKS.map((track) => track.title)).toEqual([
      "A Bag",
      "Chopper",
      "Freestyle Sujo",
      "I'M Flexin up",
      "Money Talk",
      "Tsanto Dough",
      "FASHIIION D’PHANTOM",
      "A Nova Wave",
      "Phantom Mode (The final movie)",
    ]);
    expect(RADIO_TRACKS.map((track) => track.artist)).toEqual([
      "KHRYIS",
      "KHRYIS",
      "KHRYIS",
      "KHRYIS",
      "KHRYIS",
      "KHRYIS",
      "PHANTOM, Kingston Siriro, Elton Penicela",
      "PHANTOM, Bruno The GOAT, Alemão Wav, Elton Penicela",
      "PHANTOM, INF8M8US, HeyyG, Kingston Siriro",
    ]);
  });

  it("keeps the nine production radio URLs separate from the site preview tapes", () => {
    expect(RADIO_TRACKS).toHaveLength(9);
    expect(RADIO_TRACKS.some((track) => track.src.includes("/assets/tapes/"))).toBe(false);
    expect(RADIO_TRACKS.some((track) => track.src.includes("nova-wave.mp3"))).toBe(false);
    expect(RADIO_TRACKS.some((track) => track.src.includes("phantom-mode.mp3"))).toBe(false);
  });
});
