import {
  buildCaptureResult,
  chooseRecorderMimeType,
  createRecordingStream,
  getExtension,
} from "./recorder";
import { type CaptureFormat, type CaptureResult } from "./types";
import { WebGLEngine } from "@/lib/webgl/webgl-engine";

const MIN_4K_LONG_EDGE = 3840;
const MIN_4K_SHORT_EDGE = 2160;

export function isReal4KSource(width: number, height: number): boolean {
  return (
    Math.max(width, height) >= MIN_4K_LONG_EDGE &&
    Math.min(width, height) >= MIN_4K_SHORT_EDGE
  );
}

export function get4KCaptureDimensions(
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  return sourceWidth >= sourceHeight
    ? { width: 3840, height: 2160 }
    : { width: 2160, height: 3840 };
}

export function getMaxCaptureDimensions(
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(sourceWidth)),
    height: Math.max(1, Math.round(sourceHeight)),
  };
}

function getCaptureDimensions(
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  if (isReal4KSource(sourceWidth, sourceHeight)) {
    const target = get4KCaptureDimensions(sourceWidth, sourceHeight);
    return target;
  }

  const target = getMaxCaptureDimensions(sourceWidth, sourceHeight);
  return target;
}

type CaptureEngineOptions = {
  getSourceStream: () => MediaStream | null;
  getFilterId: () => string;
  getFacingMode: () => "user" | "environment";
};

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function stamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    "_" +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function buildFilename(
  format: CaptureFormat,
  filterId: string,
  facingMode: "user" | "environment",
  width: number,
  height: number,
): string {
  const camera = facingMode === "user" ? "FRONT" : "BACK";
  const sourceTag = isReal4KSource(width, height)
    ? "4K"
    : `${width}x${height}`;
  return `SDT_${stamp()}_${filterId.toUpperCase()}_${camera}_${sourceTag}.${getExtension(format)}`;
}

export class CaptureEngine {
  private canvas: HTMLCanvasElement | null = null;
  private webgl: WebGLEngine | null = null;
  private videoWidth = 0;
  private videoHeight = 0;
  private recording: MediaRecorder | null = null;
  private recordingCleanup: (() => Promise<void>) | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private preferredFormat: Extract<CaptureFormat, "mp4" | "mov" | "mkv" | "webm"> = "webm";
  private recordingFilterId: string | null = null;
  private recordingFacingMode: "user" | "environment" | null = null;
  private readonly options: CaptureEngineOptions;

  constructor(options: CaptureEngineOptions) {
    this.options = options;
  }

  attach(canvas: HTMLCanvasElement | null, webgl: WebGLEngine | null): void {
    this.canvas = canvas;
    this.webgl = webgl;
  }

  setSourceSize(width: number, height: number): void {
    this.videoWidth = width;
    this.videoHeight = height;
  }

  setPreferredFormat(
    format: Extract<CaptureFormat, "mp4" | "mov" | "mkv" | "webm">,
  ): void {
    this.preferredFormat = format;
  }

  get isRecording(): boolean {
    return this.recording?.state === "recording";
  }

  async capturePhoto(
    format: Extract<CaptureFormat, "jpg" | "png">,
    filterId = this.options.getFilterId(),
    facingMode = this.options.getFacingMode(),
  ): Promise<CaptureResult> {
    this.assertCaptureReady();

    if (this.videoWidth <= 0 || this.videoHeight <= 0) {
      throw new Error("CAMERA_RESOLUTION_UNAVAILABLE");
    }

    const canvas = this.canvas!;
    const webgl = this.webgl!;
    const target = getCaptureDimensions(this.videoWidth, this.videoHeight);

    await webgl.waitForFilter(filterId);

    return webgl.withOutputResolution(
      target.width,
      target.height,
      async () => {
        await waitForFrame();
        webgl.render(performance.now());

        const mimeType = format === "png" ? "image/png" : "image/jpeg";
        const quality = format === "png" ? undefined : 0.98;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (value) => {
              if (!value) {
                reject(new Error("IMAGE_CAPTURE_FAILED"));
                return;
              }

              resolve(value);
            },
            mimeType,
            quality,
          );
        });

        return buildCaptureResult(
          "photo",
          blob,
          format,
          buildFilename(
            format,
            filterId,
            facingMode,
            target.width,
            target.height,
          ),
          target.width,
          target.height,
        );
      },
    );
  }

  async startVideo(
    filterId = this.options.getFilterId(),
    facingMode = this.options.getFacingMode(),
  ): Promise<void> {
    this.assertCaptureReady();

    if (this.videoWidth <= 0 || this.videoHeight <= 0) {
      throw new Error("CAMERA_RESOLUTION_UNAVAILABLE");
    }

    if (this.isRecording) return;

    await this.webgl!.waitForFilter(filterId);

    const sourceStream = this.options.getSourceStream();
    if (!sourceStream) throw new Error("CAMERA_STREAM_UNAVAILABLE");

    const requested = this.preferredFormat;
    const mimeType = chooseRecorderMimeType(requested);

    if (!mimeType) {
      throw new Error("VIDEO_FORMAT_UNSUPPORTED");
    }

    const target = getCaptureDimensions(this.videoWidth, this.videoHeight);
    await this.webgl!.setOutputResolution(target.width, target.height);
    await waitForFrame();
    this.webgl!.render(performance.now());

    try {
      const recordingStream = await createRecordingStream(
        this.canvas!,
        sourceStream,
        60,
      );

      this.recordingCleanup = recordingStream.cleanup;
      this.chunks = [];
      this.startedAt = performance.now();

      const recorder = new MediaRecorder(recordingStream.stream, {
        mimeType,
        videoBitsPerSecond: 45_000_000,
        audioBitsPerSecond: 192_000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        this.recording = null;
        void this.cleanupRecording();
        void this.webgl?.restorePreviewResolution();
      };

      this.recording = recorder;
      this.recordingFilterId = filterId;
      this.recordingFacingMode = facingMode;
      recorder.start(250);
    } catch (error) {
      await this.cleanupRecording();
      await this.webgl!.restorePreviewResolution();
      throw error;
    }
  }

  async stopVideo(): Promise<CaptureResult | null> {
    const recorder = this.recording;
    if (!recorder) return null;

    const durationMs = performance.now() - this.startedAt;
    const target = getCaptureDimensions(this.videoWidth, this.videoHeight);
    const recordingFilterId =
      this.recordingFilterId ?? this.options.getFilterId();
    const recordingFacingMode =
      this.recordingFacingMode ?? this.options.getFacingMode();

    return new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const blob = recorder.mimeType
            ? new Blob(this.chunks, { type: recorder.mimeType })
            : new Blob(this.chunks);

          const extension = recorder.mimeType.includes("mp4")
            ? "mp4"
            : recorder.mimeType.includes("quicktime")
              ? "mov"
              : recorder.mimeType.includes("matroska")
                ? "mkv"
                : "webm";

          const format = extension as CaptureFormat;

          await this.cleanupRecording();

          await this.webgl?.restorePreviewResolution();

          resolve(
            buildCaptureResult(
              "video",
              blob,
              format,
              buildFilename(
                format,
                recordingFilterId,
                recordingFacingMode,
                target.width,
                target.height,
              ),
              target.width,
              target.height,
              Math.round(durationMs),
            ),
          );
        } catch (error) {
          await this.webgl?.restorePreviewResolution();
          reject(error);
        }
      };

      recorder.onerror = () => {
        void this.cleanupRecording().finally(() => {
          void this.webgl?.restorePreviewResolution();
          reject(new Error("VIDEO_RECORDING_FAILED"));
        });
      };

      recorder.stop();
    });
  }

  async dispose(): Promise<void> {
    if (this.recording?.state === "recording") {
      try {
        await this.stopVideo();
      } catch {
        await this.cleanupRecording();
        await this.webgl?.restorePreviewResolution();
      }
    } else {
      await this.cleanupRecording();
      await this.webgl?.restorePreviewResolution();
    }

    this.recording = null;
    this.recordingFilterId = null;
    this.recordingFacingMode = null;
    this.canvas = null;
    this.webgl = null;
  }

  private assertCaptureReady(): void {
    if (!this.canvas) throw new Error("CAPTURE_CANVAS_UNAVAILABLE");
    if (!this.webgl) throw new Error("CAPTURE_WEBGL_UNAVAILABLE");
  }

  private async cleanupRecording(): Promise<void> {
    const cleanup = this.recordingCleanup;

    this.recordingCleanup = null;
    this.recording = null;
    this.recordingFilterId = null;
    this.recordingFacingMode = null;
    this.chunks = [];

    if (cleanup) {
      await cleanup();
    }
  }
}