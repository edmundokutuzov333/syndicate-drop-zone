import { type CaptureMode, type CaptureResult, type RecorderCapabilities } from "./types";

const MIME_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

export function getRecorderCapabilities(): RecorderCapabilities {
  const supported = typeof MediaRecorder === "undefined"
    ? []
    : MIME_CANDIDATES.filter((mime) => MediaRecorder.isTypeSupported(mime));
  return {
    supported: supported.length > 0,
    mimeTypes: supported,
    canvasCaptureSupported: typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype,
  };
}

export function chooseRecorderMimeType(): string | null {
  return getRecorderCapabilities().mimeTypes[0] ?? null;
}

export function createCanvasCaptureStream(canvas: HTMLCanvasElement, frameRate = 30): MediaStream | null {
  return typeof canvas.captureStream === "function" ? canvas.captureStream(frameRate) : null;
}

export function buildCaptureResult(mode: CaptureMode, blob: Blob): CaptureResult {
  return { mode, blob, url: URL.createObjectURL(blob), mimeType: blob.type || "application/octet-stream" };
}

export function revokeCaptureResult(result: CaptureResult): void {
  URL.revokeObjectURL(result.url);
}
