import {
  type FilterComplexity,
  type PerformanceTier,
  type RenderMetrics,
} from "./types";

export type PreviewProfileInput = {
  deviceTier: PerformanceTier;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceFrameRate?: number;
  devicePixelRatio: number;
  filterComplexity: FilterComplexity;
};

export type InitialPreviewProfile = {
  renderScale: number;
  maxRenderScale: number;
  dpr: number;
  maxDpr: number;
  sourceDimensionsKnown: boolean;
  sourceFrameRateKnown: boolean;
};

export type AdaptivePreviewAction = "degrade" | "recover" | "hold";

export type AdaptivePreviewState = {
  renderScale: number;
  dpr: number;
  maxRenderScale: number;
  maxDpr: number;
  poorWindows: number;
  healthyWindows: number;
};

const MIN_RENDER_SCALE = 0.65;

export function getFilterRenderScaleCap(
  deviceTier: PerformanceTier,
  complexity: FilterComplexity,
): number {
  if (deviceTier === "high") {
    return complexity === "high" ? 0.9 : complexity === "medium" ? 0.96 : 1;
  }
  if (deviceTier === "medium") {
    return complexity === "high" ? 0.9 : 1;
  }
  if (complexity === "high") return 0.72;
  if (complexity === "medium") return 0.82;
  return 0.92;
}

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

function isValidPositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

export function getInitialPreviewProfile(
  input: PreviewProfileInput,
): InitialPreviewProfile {
  const width = isValidPositive(input.sourceWidth) ? Math.round(input.sourceWidth) : 0;
  const height = isValidPositive(input.sourceHeight) ? Math.round(input.sourceHeight) : 0;
  const sourceDimensionsKnown = width > 0 && height > 0;
  const sourceFrameRateKnown = isValidPositive(input.sourceFrameRate);
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const sourcePixelCount = width * height;

  let maxRenderScale =
    input.deviceTier === "high" ? 1 : input.deviceTier === "medium" ? 0.96 : 0.88;

  if (sourceDimensionsKnown && longEdge >= 3840 && shortEdge >= 2160) {
    maxRenderScale =
      input.deviceTier === "high" ? 0.9 : input.deviceTier === "medium" ? 0.82 : 0.7;
    // High-rate 4K sources carry more per-second texture work than 4K at 24/30 FPS.
    if (sourceFrameRateKnown && input.sourceFrameRate >= 50) {
      maxRenderScale = Math.max(MIN_RENDER_SCALE, maxRenderScale - 0.03);
    }
  } else if (sourceDimensionsKnown && longEdge >= 2560 && shortEdge >= 1440) {
    maxRenderScale =
      input.deviceTier === "high" ? 0.95 : input.deviceTier === "medium" ? 0.88 : 0.78;
    if (sourcePixelCount >= 4_000_000 && sourceFrameRateKnown && input.sourceFrameRate >= 50) {
      maxRenderScale = Math.max(MIN_RENDER_SCALE, maxRenderScale - 0.02);
    }
  }

  maxRenderScale = Math.max(MIN_RENDER_SCALE, maxRenderScale);
  const maxDprByTier = input.deviceTier === "high" ? 2 : input.deviceTier === "medium" ? 1.5 : 1;
  const requestedDpr = isValidPositive(input.devicePixelRatio) ? input.devicePixelRatio : 1;
  const maxDpr = Math.max(1, Math.min(requestedDpr, maxDprByTier));
  const filterCap = getFilterRenderScaleCap(input.deviceTier, input.filterComplexity);

  return {
    renderScale: Math.min(maxRenderScale, filterCap),
    maxRenderScale,
    dpr: maxDpr,
    maxDpr,
    sourceDimensionsKnown,
    sourceFrameRateKnown,
  };
}

/**
 * Uses measured render/upload work, not the interval between camera frames.
 * The callback cadence of a 24/30 FPS stream is not proof of renderer overload.
 */
export function evaluateAdaptivePreview(
  metrics: RenderMetrics,
  sourceFrameRate?: number,
): AdaptivePreviewAction {
  const frameRate = isValidPositive(sourceFrameRate)
    ? Math.max(15, Math.min(120, sourceFrameRate))
    : 30;
  const frameBudgetMs = 1000 / frameRate;
  const renderCost = isValidPositive(metrics.renderTimeMs) ? metrics.renderTimeMs : 0;
  const uploadCost = isValidPositive(metrics.textureUploadTimeMs) ? metrics.textureUploadTimeMs : 0;

  if (renderCost === 0 && uploadCost === 0) return "hold";
  if (renderCost > frameBudgetMs * 0.72 || uploadCost > frameBudgetMs * 0.3) return "degrade";
  if (renderCost > 0 && renderCost < frameBudgetMs * 0.45 && uploadCost < frameBudgetMs * 0.2) {
    return "recover";
  }
  return "hold";
}

/**
 * A single bad/healthy window cannot resize the preview. Overload needs two
 * consecutive windows; gradual recovery needs three healthy windows.
 */
export function stepAdaptivePreview(
  state: AdaptivePreviewState,
  action: AdaptivePreviewAction,
  activeScaleCap: number,
): AdaptivePreviewState {
  const cap = Math.max(MIN_RENDER_SCALE, Math.min(
    state.maxRenderScale,
    Number.isFinite(activeScaleCap) ? activeScaleCap : state.maxRenderScale,
  ));
  let renderScale = Math.min(state.renderScale, cap);
  let dpr = state.dpr;
  let poorWindows = state.poorWindows;
  let healthyWindows = state.healthyWindows;

  if (action === "degrade") {
    poorWindows = Math.min(8, poorWindows + 1);
    healthyWindows = 0;
    if (poorWindows >= 2) {
      renderScale = Math.max(MIN_RENDER_SCALE, Number((renderScale - 0.04).toFixed(2)));
    }
    if (poorWindows >= 4 && renderScale <= 0.7 && dpr > 1) {
      dpr = Math.max(1, Number((dpr - 0.1).toFixed(2)));
    }
  } else if (action === "recover") {
    healthyWindows = Math.min(8, healthyWindows + 1);
    poorWindows = 0;
    if (healthyWindows >= 3) {
      renderScale = Math.min(cap, Number((renderScale + 0.02).toFixed(2)));
    }
    if (healthyWindows >= 5 && dpr < state.maxDpr) {
      dpr = Math.min(state.maxDpr, Number((dpr + 0.1).toFixed(2)));
    }
  } else {
    poorWindows = 0;
    healthyWindows = 0;
  }

  return { ...state, renderScale, dpr, poorWindows, healthyWindows };
}

/** Compatibility helper. Production WebGL uses the hysteresis state machine above. */
export function adaptiveRenderPolicy(
  metrics: RenderMetrics,
  sourceFrameRate?: number,
): Pick<RenderMetrics, "renderScale" | "dpr"> {
  const action = evaluateAdaptivePreview(metrics, sourceFrameRate);
  if (action === "degrade") {
    return {
      renderScale: Math.max(MIN_RENDER_SCALE, Number((metrics.renderScale - 0.04).toFixed(2))),
      dpr: metrics.renderScale <= 0.7 ? Math.max(1, Number((metrics.dpr - 0.1).toFixed(2))) : metrics.dpr,
    };
  }
  if (action === "recover") {
    return { renderScale: Math.min(1, Number((metrics.renderScale + 0.02).toFixed(2))), dpr: metrics.dpr };
  }
  return { renderScale: metrics.renderScale, dpr: metrics.dpr };
}
