import { type FilterDefinition, type FilterId } from "@/lib/camera/types";

const DEFINITIONS: FilterDefinition[] = [
  { id: "op1um", index: "01", label: "OP1UM", shaderKey: "op1um:v0", visible: true, supportsFeedback: true },
  { id: "xerox", index: "02", label: "XEROX", shaderKey: "xerox:v0", visible: true, supportsFeedback: false },
  { id: "corrupt", index: "03", label: "CORRUPT", shaderKey: "corrupt:v0", visible: true, supportsFeedback: true },
  { id: "nightvision", index: "04", label: "NIGHTVISION", shaderKey: "nightvision:v0", visible: true, supportsFeedback: false },
  { id: "thermal", index: "05", label: "THERMAL", shaderKey: "thermal:v0", visible: true, supportsFeedback: false },
  { id: "redroom", index: "06", label: "REDROOM", shaderKey: "redroom:v0", visible: true, supportsFeedback: true },
];

export const FILTER_REGISTRY = {
  get(id: FilterId): FilterDefinition {
    return DEFINITIONS.find((definition) => definition.id === id) ?? DEFINITIONS[0]!;
  },
  listVisible(): FilterDefinition[] { return DEFINITIONS.filter((definition) => definition.visible); },
  has(id: string): id is FilterId { return DEFINITIONS.some((definition) => definition.id === id); },
};
