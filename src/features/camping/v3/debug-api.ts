import type { SectorStat } from "./sector-stats";

export type CampingDebugPoseId = "entrada" | "producao" | "foto" | "esquerda" | "direita" | "tecto" | "chao";

export type CampingDebugMetrics = {
  triangles: number;
  drawCalls: number;
  textureMB: number;
  geometries: number;
  textures: number;
  fps: number;
  pixelRatio: number;
  pose: CampingDebugPoseId | null;
};

export type CampingReferenceMatch = {
  score: number | null;
  worst: { az: number; el: number; dE: number }[];
  referenceDataUrl?: string;
  renderedDataUrl?: string;
  diffDataUrl?: string;
  referenceSourceSha256?: string;
  error?: string;
};

export type CampingDebugApi = {
  readonly ready: boolean;
  freeze: () => void;
  metrics: () => CampingDebugMetrics | null;
  setPose: (id: CampingDebugPoseId) => boolean;
  referenceMatch: () => CampingReferenceMatch;
  setReferenceImage: (dataUrl: string) => Promise<boolean>;
};

declare global {
  interface Window {
    __SDT3D__?: CampingDebugApi;
  }
}
