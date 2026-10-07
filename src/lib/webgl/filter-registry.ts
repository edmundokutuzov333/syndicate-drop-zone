import { type FilterDefinition, type FilterId } from "@/lib/camera/types";

const DEFINITIONS: FilterDefinition[] = [
  { id: "op1um", index: "01", label: "OP1UM", shaderKey: "op1um:v0", complexity: "medium", visible: true, supportsFeedback: true, enabled: false },
  { id: "xerox", index: "02", label: "XEROX", shaderKey: "xerox:v0", complexity: "low", visible: true, supportsFeedback: false, enabled: false },
  { id: "corrupt", index: "03", label: "CORRUPT", shaderKey: "corrupt:v0", complexity: "high", visible: true, supportsFeedback: true, enabled: false },
  { id: "nightvision", index: "04", label: "NIGHTVISION", shaderKey: "nightvision:v0", complexity: "medium", visible: true, supportsFeedback: false, enabled: false },
  { id: "thermal", index: "05", label: "THERMAL", shaderKey: "thermal:v0", complexity: "medium", visible: true, supportsFeedback: false, enabled: false },
  { id: "redroom", index: "06", label: "REDROOM", shaderKey: "redroom:v0", complexity: "medium", visible: true, supportsFeedback: true, enabled: false },
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
