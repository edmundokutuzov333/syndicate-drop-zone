import reference from "../../../../docs/camping-v3/reference/reference-sectors.json";
import type { SectorStat } from "./sector-stats";

type ReferencePayload = {
  version: number;
  sourceSha256: string;
  sourceDimensions: [number, number];
  sampling: string;
  azimuthSectors: number;
  elevationBands: [number, number][];
  values: [number, number, number, number][][];
};

const payload = reference as ReferencePayload;

export const REFERENCE_SOURCE_SHA256 = payload.sourceSha256;
export const REFERENCE_SOURCE_DIMENSIONS = payload.sourceDimensions;
export const REFERENCE_SECTOR_STATS: SectorStat[] = payload.values.flatMap((band, bandIndex) =>
  band.map((values, sectorIndex) => ({
    az0: sectorIndex * (360 / payload.azimuthSectors),
    az1: (sectorIndex + 1) * (360 / payload.azimuthSectors),
    el0: payload.elevationBands[bandIndex]?.[0] ?? -90,
    el1: payload.elevationBands[bandIndex]?.[1] ?? 90,
    L: values[0],
    a: values[1],
    b: values[2],
    lumaStd: values[3],
  })),
);

if (payload.version !== 1 || REFERENCE_SECTOR_STATS.length !== 72) {
  throw new Error("CAMPING reference-sector baseline is invalid.");
}
