import { type PerformanceTier, type RenderMetrics } from "./types";

export function detectPerformanceTier(): PerformanceTier {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = "deviceMemory" in navigator
    ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4)
    : 4;
  if (cores >= 8 && memory >= 8) return "high";
  if (cores <= 4 || memory <= 4) return "low";
  return "medium";
}

export function adaptiveRenderPolicy(metrics: RenderMetrics): Pick<RenderMetrics, "renderScale" | "dpr"> {
  if (metrics.frameTimeMs > 45 || metrics.fps < 22) {
    return { renderScale: Math.max(0.65, metrics.renderScale - 0.05), dpr: Math.min(metrics.dpr, 1.5) };
  }
  if (metrics.frameTimeMs < 25 && metrics.fps >= 30) {
    return { renderScale: Math.min(1, metrics.renderScale + 0.02), dpr: metrics.dpr };
  }
  return { renderScale: metrics.renderScale, dpr: metrics.dpr };
}
