import { describe, expect, it } from "vitest";
import { calculateOrientationState } from "@/lib/camera/orientation-manager";
import { captureTimerReducer, createCaptureTimerState } from "@/lib/camera/capture-timer";
import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";
import { adaptiveRenderPolicy } from "@/lib/camera/performance-manager";
import { getRecorderCapabilities } from "@/lib/camera/recorder";

describe("camera engineering foundation", () => {
  it("calculates orientation state without requiring a stream", () => {
    expect(calculateOrientationState(90, 0, 0)).toMatchObject({
      screenAngle: 90,
      renderRotation: 90,
      captureRotation: 270,
    });
  });

  it("transitions capture timer state", () => {
    const capturing = captureTimerReducer(createCaptureTimerState(3), { type: "START" });
    expect(capturing).toEqual({ status: "capturing", timer: 3 });
    expect(captureTimerReducer(capturing, { type: "DONE" }).status).toBe("done");
    expect(captureTimerReducer(capturing, { type: "CANCEL" }).status).toBe("cancelled");
  });

  it("keeps the six visible filter ids stable", () => {
    expect(FILTER_REGISTRY.listVisible().map((filter) => filter.id)).toEqual([
      "op1um",
      "xerox",
      "corrupt",
      "nightvision",
      "thermal",
      "redroom",
    ]);
  });

  it("degrades render policy only when metrics are poor", () => {
    const policy = adaptiveRenderPolicy({
      fps: 18,
      frameTimeMs: 60,
      droppedFrames: 4,
      deviceTier: "medium",
      dpr: 2,
      renderScale: 1,
    });
    expect(policy.renderScale).toBeLessThan(1);
    expect(policy.dpr).toBe(1.5);
  });

  it("detects recorder capability without opening a device", () => {
    const capabilities = getRecorderCapabilities();
    expect(capabilities).toHaveProperty("supported");
    expect(capabilities).toHaveProperty("mimeTypes");
    expect(capabilities).toHaveProperty("canvasCaptureSupported");
  });
});
