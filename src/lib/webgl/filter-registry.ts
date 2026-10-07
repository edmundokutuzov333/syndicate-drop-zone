import { type FilterDefinition, type FilterId } from "@/lib/camera/types";

const DEFINITIONS: FilterDefinition[] = [
  {
    id: "op1um",
    index: "01",
    label: "OP1UM",
    shaderKey: "op1um:v2",
    complexity: "medium",
    visible: true,
    supportsFeedback: true,
    enabled: true,
    defaults: { intensity: 0.98, noise: 0.55, distortion: 0.11, chromatic: 0.0062, feedback: 0.22 },
  },
  {
    id: "xerox",
    index: "02",
    label: "XEROX",
    shaderKey: "xerox:v2",
    complexity: "low",
    visible: true,
    supportsFeedback: false,
    enabled: true,
    defaults: { intensity: 0.94, noise: 0.72, distortion: 0.032, chromatic: 0.0012, feedback: 0.06 },
  },
  {
    id: "corrupt",
    index: "03",
    label: "CORRUPT",
    shaderKey: "corrupt:v2",
    complexity: "high",
    visible: true,
    supportsFeedback: true,
    enabled: true,
    defaults: { intensity: 1, noise: 0.48, distortion: 0.42, chromatic: 0.035, feedback: 0.48 },
  },
  {
    id: "nightvision",
    index: "04",
    label: "NIGHTVISION",
    shaderKey: "nightvision:v2",
    complexity: "medium",
    visible: true,
    supportsFeedback: false,
    enabled: true,
    defaults: { intensity: 0.98, noise: 0.46, distortion: 0.06, chromatic: 0.0025, feedback: 0.16 },
  },
  {
    id: "thermal",
    index: "05",
    label: "THERMAL",
    shaderKey: "thermal:v2",
    complexity: "medium",
    visible: true,
    supportsFeedback: false,
    enabled: true,
    defaults: { intensity: 0.98, noise: 0.38, distortion: 0.12, chromatic: 0.003, feedback: 0.24 },
  },
  {
    id: "redroom",
    index: "06",
    label: "REDROOM",
    shaderKey: "redroom:v2",
    complexity: "medium",
    visible: true,
    supportsFeedback: true,
    enabled: true,
    defaults: { intensity: 1, noise: 0.56, distortion: 0.10, chromatic: 0.012, feedback: 0.31 },
  },
];

export const FILTER_REGISTRY = {
  get(id: FilterId): FilterDefinition {
    return DEFINITIONS.find((definition) => definition.id === id) ?? DEFINITIONS[0]!;
  },
  listVisible(): FilterDefinition[] {
    return DEFINITIONS.filter((definition) => definition.visible);
  },
  has(id: string): id is FilterId {
    return DEFINITIONS.some((definition) => definition.id === id);
  },
};