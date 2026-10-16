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
import vamp from "@/shaders/camera/filters/vamp.frag.glsl?raw";
import astroHaze from "@/shaders/camera/filters/astro-haze.frag.glsl?raw";
import cyberMugshot from "@/shaders/camera/filters/cyber-mugshot.frag.glsl?raw";
import threshold from "@/shaders/camera/filters/threshold.frag.glsl?raw";
import xrayMesh from "@/shaders/camera/filters/xray-mesh.frag.glsl?raw";
import cathodeCrt from "@/shaders/camera/filters/cathode-crt.frag.glsl?raw";
import halation from "@/shaders/camera/filters/halation.frag.glsl?raw";
import kineticMelt from "@/shaders/camera/filters/kinetic-melt.frag.glsl?raw";
import paperFilm from "@/shaders/camera/filters/paper-film.frag.glsl?raw";
import crtClassic from "@/shaders/camera/filters/crt-classic.frag.glsl?raw";
import vhsTracking from "@/shaders/camera/filters/vhs-tracking.frag.glsl?raw";
import nightCctv from "@/shaders/camera/filters/night-cctv.frag.glsl?raw";
import datamosh from "@/shaders/camera/filters/datamosh.frag.glsl?raw";
import fireBloom from "@/shaders/camera/filters/fire-bloom.frag.glsl?raw";
import neonCyberpunk from "@/shaders/camera/filters/neon-cyberpunk.frag.glsl?raw";
import analogInterference from "@/shaders/camera/filters/analog-interference.frag.glsl?raw";

const shared = [common, grain, distortion, chromatic, feedback].join("\n");

const BODIES: Record<FilterId, string> = {
  op1um,
  xerox,
  corrupt,
  nightvision,
  thermal,
  redroom,
  vamp,
  "astro-haze": astroHaze,
  "cyber-mugshot": cyberMugshot,
  threshold,
  "xray-mesh": xrayMesh,
  "cathode-crt": cathodeCrt,
  halation,
  "kinetic-melt": kineticMelt,
  "paper-film": paperFilm,
  "crt-classic": crtClassic,
  "vhs-tracking": vhsTracking,
  "night-cctv": nightCctv,
  datamosh,
  "fire-bloom": fireBloom,
  "neon-cyberpunk": neonCyberpunk,
  "analog-interference": analogInterference,
};

export function getFilterFragmentShader(id: FilterId): string {
  return `${shared}\n${BODIES[id]}`;
}