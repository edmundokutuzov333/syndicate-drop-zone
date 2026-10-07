import { type FilterId } from "@/lib/camera/types";
import common from "@/shaders/camera/common.glsl?raw";
import grain from "@/shaders/camera/grain.glsl?raw";
import distortion from "@/shaders/camera/distortion.glsl?raw";
import chromatic from "@/shaders/camera/chromatic.glsl?raw";
import feedback from "@/shaders/camera/feedback.glsl?raw";
import op1um from "@/shaders/camera/filters/op1um.frag.glsl?raw";
import xerox from "@/shaders/camera/filters/xerox.frag.glsl?raw";
import corrupt from "@/shaders/camera/filters/corrupt.frag.glsl?raw";
import nightvision from "@/shaders/camera/filters/nightvision.frag.glsl?raw";
import thermal from "@/shaders/camera/filters/thermal.frag.glsl?raw";
import redroom from "@/shaders/camera/filters/redroom.frag.glsl?raw";

const shared = [common, grain, distortion, chromatic, feedback].join("\n");

const BODIES: Record<FilterId, string> = {
  op1um,
  xerox,
  corrupt,
  nightvision,
  thermal,
  redroom,
};

export function getFilterFragmentShader(id: FilterId): string {
  return `${shared}\n${BODIES[id]}`;
}