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
    defaults: { intensity: 0.92, noise: 0.42, distortion: 0.075, chromatic: 0.0038, feedback: 0.12 },
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
    defaults: { intensity: 0.96, noise: 0.62, distortion: 0.015, chromatic: 0, feedback: 0 },
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
    defaults: { intensity: 1, noise: 0.38, distortion: 0.28, chromatic: 0.018, feedback: 0.24 },
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
    defaults: { intensity: 0.9, noise: 0.34, distortion: 0.02, chromatic: 0.0015, feedback: 0.04 },
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
    defaults: { intensity: 0.92, noise: 0.3, distortion: 0.055, chromatic: 0.001, feedback: 0 },
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
    defaults: { intensity: 0.96, noise: 0.46, distortion: 0.045, chromatic: 0.007, feedback: 0.13 },
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