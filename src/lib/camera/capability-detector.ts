import { type RecorderCapabilities, type WebglCapabilities } from "./types";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
];

export function detectCameraCapabilities(): {
  mediaDevices: boolean;
  microphone: boolean;
  recorder: RecorderCapabilities;
  webgl: WebglCapabilities;
  screenOrientation: boolean;
  captureStream: boolean;
  devicePixelRatio: number;
} {
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  const mediaDevices = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const microphone = mediaDevices;
  const webgl2 = Boolean(canvas?.getContext("webgl2"));
  const webgl1 = Boolean(canvas?.getContext("webgl"));
  const supportedMimes =
    typeof MediaRecorder === "undefined"
      ? []
      : MIME_CANDIDATES.filter((mime) => MediaRecorder.isTypeSupported(mime));

  return {
    mediaDevices,
    microphone,
    recorder: {
      supported: supportedMimes.length > 0,
      mimeTypes: supportedMimes,
      canvasCaptureSupported: Boolean(canvas && typeof canvas.captureStream === "function"),
      audioCaptureSupported:
        typeof window !== "undefined" &&
        ("AudioContext" in window || "webkitAudioContext" in window),
    },
    webgl: {
      webgl2,
      webgl1,
    },
    screenOrientation:
      typeof screen !== "undefined" && "orientation" in screen,
    captureStream: Boolean(canvas && typeof canvas.captureStream === "function"),
    devicePixelRatio:
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  };
}
