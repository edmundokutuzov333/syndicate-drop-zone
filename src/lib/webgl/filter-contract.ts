import type { FilterId } from "@/lib/camera/types";

export type MasterOverlayId = "cathode-crt" | "paper-film";
export type FilterPipelineKind =
  | "single"
  | "xray-mesh"
  | "halation"
  | "kinetic-melt";

export type ShaderParameter = {
  name: string;
  defaultValue: number | number[];
  min?: number;
  max?: number;
  step?: number;
};

export type FilterShaderContract = {
  id: FilterId;
  pipeline: FilterPipelineKind;
  parameters: readonly ShaderParameter[];
  masterOverlay?: MasterOverlayId;
};

export const FILTER_PARAMETER_CONTRACTS: readonly FilterShaderContract[] = [
  {
    id: "threshold",
    pipeline: "single",
    parameters: [
      { name: "uThreshold", defaultValue: 0.45, min: 0, max: 1, step: 0.001 },
      { name: "uEdgeSmoothness", defaultValue: 0.015, min: 0, max: 0.25, step: 0.001 },
      { name: "uFlickerIntensity", defaultValue: 0.05, min: 0, max: 1, step: 0.001 },
    ],
  },
  {
    id: "xray-mesh",
    pipeline: "xray-mesh",
    parameters: [
      { name: "uMeshColor", defaultValue: [0, 1, 0.4], min: 0, max: 1, step: 0.01 },
      { name: "uLineWidth", defaultValue: 1.5, min: 0.25, max: 8, step: 0.25 },
      { name: "uDepthFade", defaultValue: 0.8, min: 0, max: 2, step: 0.01 },
    ],
  },
  {
    id: "cathode-crt",
    pipeline: "single",
    parameters: [
      { name: "uDistortionK", defaultValue: 0.12, min: -0.5, max: 1, step: 0.005 },
      { name: "uScanlineCount", defaultValue: 800, min: 100, max: 1600, step: 10 },
      { name: "uChromaticOffset", defaultValue: 0.008, min: 0, max: 0.08, step: 0.001 },
      { name: "uApplyToAllFilters", defaultValue: 0, min: 0, max: 1, step: 1 },
    ],
    masterOverlay: "cathode-crt",
  },
  {
    id: "halation",
    pipeline: "halation",
    parameters: [
      { name: "uGlowRadius", defaultValue: 0.025, min: 0.002, max: 0.12, step: 0.001 },
      { name: "uHalationIntensity", defaultValue: 0.3, min: 0, max: 1, step: 0.01 },
      { name: "uGlowThreshold", defaultValue: 0.7, min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    id: "kinetic-melt",
    pipeline: "kinetic-melt",
    parameters: [
      { name: "uMeltStrength", defaultValue: 0.08, min: 0, max: 0.4, step: 0.005 },
      { name: "uVelocityThreshold", defaultValue: 0.02, min: 0, max: 0.2, step: 0.001 },
      { name: "uPersistence", defaultValue: 0.92, min: 0.5, max: 0.995, step: 0.001 },
    ],
  },
  {
    id: "paper-film",
    pipeline: "single",
    parameters: [
      { name: "uGrainIntensity", defaultValue: 0.06, min: 0, max: 0.25, step: 0.005 },
      { name: "uDirtFrequency", defaultValue: 0.4, min: 0, max: 1, step: 0.01 },
      { name: "uJitterAmount", defaultValue: 0.001, min: 0, max: 0.01, step: 0.0001 },
      { name: "uApplyToAllFilters", defaultValue: 0, min: 0, max: 1, step: 1 },
    ],
    masterOverlay: "paper-film",
  },
] as const;

export const MASTER_OVERLAY_CONTRACTS = {
  "cathode-crt": {
    enabledByDefault: false,
    parameters: FILTER_PARAMETER_CONTRACTS.find(
      (contract) => contract.id === "cathode-crt",
    )!.parameters,
  },
  "paper-film": {
    enabledByDefault: false,
    parameters: FILTER_PARAMETER_CONTRACTS.find(
      (contract) => contract.id === "paper-film",
    )!.parameters,
  },
} as const;

export function getFilterShaderContract(id: FilterId): FilterShaderContract | null {
  return (
    FILTER_PARAMETER_CONTRACTS.find((contract) => contract.id === id) ?? null
  );
}
