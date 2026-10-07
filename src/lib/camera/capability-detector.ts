import { type RecorderCapabilities } from "./types";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
];

export function detectCameraCapabilities() {
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  const mediaDevices = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const webgl2 = Boolean(canvas?.getContext("webgl2"));
  const webgl = Boolean(canvas?.getContext("webgl"));
  const supportedMimes = typeof MediaRecorder === "undefined"
    ? []
    : MIME_CANDIDATES.filter((mime) => MediaRecorder.isTypeSupported(mime));
  const recorder: RecorderCapabilities = {
    supported: supportedMimes.length > 0,
    mimeTypes: supportedMimes,
    canvasCaptureSupported: Boolean(canvas && typeof canvas.captureStream === "function"),
  };
  return { mediaDevices, webgl2, webgl, recorder };
}
