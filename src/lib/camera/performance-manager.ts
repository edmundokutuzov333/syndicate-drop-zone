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

export function adaptiveRenderPolicy(
  metrics: RenderMetrics,
): Pick<RenderMetrics, "renderScale" | "dpr"> {
  const poorFrameBudget = metrics.frameTimeMs > 24 || metrics.fps < 45;
  const healthyFrameBudget =
    metrics.frameTimeMs > 0 &&
    metrics.frameTimeMs < 17.5 &&
    metrics.fps >= 55;

  if (poorFrameBudget) {
    return {
      renderScale: Math.max(
        0.65,
        Number((metrics.renderScale - 0.06).toFixed(2)),
      ),
      dpr: Math.max(1, Number((metrics.dpr - 0.25).toFixed(2))),
    };
  }

  if (healthyFrameBudget) {
    return {
      renderScale: Math.min(
        1,
        Number((metrics.renderScale + 0.025).toFixed(3)),
      ),
      dpr: metrics.dpr,
    };
  }

  return {
    renderScale: metrics.renderScale,
    dpr: metrics.dpr,
  };
}