import {
  type CaptureFormat,
  type CaptureMode,
  type CaptureFormatCapability,
  type CaptureResult,
  type RecorderCapabilities,
} from "./types";

const VIDEO_MIME_CANDIDATES: Record<Extract<CaptureFormat, "mp4" | "mov" | "mkv" | "webm">, string[]> = {
  mp4: [
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1.4D401F,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
  ],
  mov: [
    "video/quicktime;codecs=ap4h,pcm_s24le",
    "video/quicktime;codecs=apch,pcm_s24le",
    "video/quicktime;codecs=ap4h",
    "video/quicktime;codecs=apch",
    "video/quicktime",
  ],
  mkv: [
    "video/x-matroska;codecs=hvc1,flac",
    "video/x-matroska;codecs=hevc,flac",
    "video/x-matroska;codecs=hvc1,mp4a.40.2",
    "video/x-matroska;codecs=hevc,mp4a.40.2",
    "video/x-matroska;codecs=hevc",
    "video/matroska;codecs=hevc,mp4a.40.2",
  ],
  webm: [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ],
};

function canUseMediaRecorder(mimeType: string): boolean {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType);
}

function firstSupportedMime(
  format: Extract<CaptureFormat, "mp4" | "mov" | "mkv" | "webm">,
): string | undefined {
  return VIDEO_MIME_CANDIDATES[format].find(canUseMediaRecorder);
}

export function getRecorderCapabilities(): RecorderCapabilities {
  const mimeTypes = Object.values(VIDEO_MIME_CANDIDATES)
    .flat()
    .filter((mime, index, all) => all.indexOf(mime) === index)
    .filter(canUseMediaRecorder);

  return {
    supported: mimeTypes.length > 0,
    mimeTypes,
    canvasCaptureSupported:
      typeof HTMLCanvasElement !== "undefined" &&
      typeof HTMLCanvasElement.prototype.captureStream === "function",
    audioCaptureSupported:
      typeof window !== "undefined" &&
      ("AudioContext" in window || "webkitAudioContext" in window),
  };
}

export function chooseRecorderMimeType(
  requestedFormat: Extract<CaptureFormat, "mp4" | "mov" | "mkv" | "webm">,
): string | null {
  return firstSupportedMime(requestedFormat) ?? null;
}

export function createCanvasCaptureStream(
  canvas: HTMLCanvasElement,
  frameRate = 60,
): MediaStream | null {
  return typeof canvas.captureStream === "function"
    ? canvas.captureStream(frameRate)
    : null;
}

type RecordingStream = {
  stream: MediaStream;
  cleanup: () => Promise<void>;
};

export async function createRecordingStream(
  canvas: HTMLCanvasElement,
  sourceStream: MediaStream,
  frameRate = 60,
): Promise<RecordingStream> {
  const canvasStream = createCanvasCaptureStream(canvas, frameRate);

  if (!canvasStream) {
    throw new Error("CANVAS_CAPTURE_UNSUPPORTED");
  }

  const audioTracks = sourceStream
    .getAudioTracks()
    .filter((track) => track.readyState === "live" && track.enabled);

  let audioContext: AudioContext | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;

  if (audioTracks.length > 0 && typeof window !== "undefined") {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (AudioContextCtor) {
      try {
        audioContext = new AudioContextCtor();
        destination = audioContext.createMediaStreamDestination();

        const audioSource = audioContext.createMediaStreamSource(
          new MediaStream(audioTracks),
        );
        audioSource.connect(destination);

        if (audioContext.state === "suspended") {
          try {
            await audioContext.resume();
          } catch {
            destination = null;
            await audioContext.close().catch(() => undefined);
            audioContext = null;
          }
        }
      } catch {
        destination = null;
        await audioContext?.close().catch(() => undefined);
        audioContext = null;
      }
    }
  }

  const recordingStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(destination?.stream.getAudioTracks() ?? audioTracks),
  ]);

  return {
    stream: recordingStream,
    cleanup: async () => {
      recordingStream.getTracks().forEach((track) => track.stop());
      canvasStream.getTracks().forEach((track) => track.stop());
      destination?.stream.getTracks().forEach((track) => track.stop());
      await audioContext?.close().catch(() => undefined);
    },
  };
}

export function getExtension(format: CaptureFormat): string {
  return format === "jpg" ? "jpg" : format;
}

export function getImageFormatCapabilities(): CaptureFormatCapability[] {
  return [
    {
      format: "jpg",
      label: "JPEG · sRGB",
      extension: "jpg",
      mimeType: "image/jpeg",
      supported: typeof HTMLCanvasElement !== "undefined",
    },
    {
      format: "png",
      label: "PNG · sRGB",
      extension: "png",
      mimeType: "image/png",
      supported: typeof HTMLCanvasElement !== "undefined",
    },
    {
      format: "tiff",
      label: "TIFF · Adobe RGB / CMYK",
      extension: "tiff",
      supported: false,
      reason: "NATIVE_TIFF_ENCODER_UNAVAILABLE",
    },
  ];
}

export function getVideoFormatCapabilities(): CaptureFormatCapability[] {
  const definitions: Array<{
    format: Extract<CaptureFormat, "mp4" | "mov" | "mkv" | "webm">;
    label: string;
    reason: string;
  }> = [
    {
      format: "mp4",
      label: "MP4 · H.264 / AAC-LC",
      reason: "H264_AAC_MEDIARRECORDER_UNAVAILABLE",
    },
    {
      format: "mov",
      label: "MOV · ProRes 422 HQ / 4444 · PCM",
      reason: "PRORES_PCM_MEDIARRECORDER_UNAVAILABLE",
    },
    {
      format: "mkv",
      label: "MKV · H.265 / HEVC · AAC / FLAC",
      reason: "HEVC_CONTAINER_MEDIARRECORDER_UNAVAILABLE",
    },
    {
      format: "webm",
      label: "WEBM · VP9 / VP8",
      reason: "WEBM_MEDIARRECORDER_UNAVAILABLE",
    },
  ];

  return definitions.map(({ format, label, reason }) => {
    const mimeType = firstSupportedMime(format);

    return {
      format,
      label,
      extension: format,
      mimeType,
      supported: Boolean(mimeType),
      ...(mimeType ? {} : { reason }),
    };
  });
}

export function buildCaptureResult(
  mode: CaptureMode,
  blob: Blob,
  format: CaptureFormat,
  filename: string,
  width: number,
  height: number,
  durationMs?: number,
): CaptureResult {
  return {
    mode,
    blob,
    url: URL.createObjectURL(blob),
    mimeType: blob.type || "application/octet-stream",
    format,
    filename,
    width,
    height,
    durationMs,
  };
}

export function revokeCaptureResult(result: CaptureResult): void {
  URL.revokeObjectURL(result.url);
}
