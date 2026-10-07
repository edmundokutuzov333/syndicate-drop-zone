import {
  buildCaptureResult,
  chooseRecorderMimeType,
  createRecordingStream,
  getExtension,
} from "./recorder";
import { type CaptureFormat, type CaptureResult } from "./types";
import { WebGLEngine } from "@/lib/webgl/webgl-engine";

const TARGET_WIDTH = 3840;
const TARGET_HEIGHT = 2160;

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
): string {
  const camera = facingMode === "user" ? "FRONT" : "BACK";
  return `SDT_${stamp()}_${filterId.toUpperCase()}_${camera}_4K.${getExtension(format)}`;
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
  private preferredFormat: CaptureFormat = "webm";
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

  setPreferredFormat(format: CaptureFormat): void {
    this.preferredFormat = format;
  }

  get isRecording(): boolean {
    return this.recording?.state === "recording";
  }

  async capturePhoto(format: Extract<CaptureFormat, "jpg" | "png">): Promise<CaptureResult> {
    this.assertCaptureReady();

    if (this.videoWidth < TARGET_WIDTH || this.videoHeight < TARGET_HEIGHT) {
      throw new Error("CAPTURE_4K_SOURCE_REQUIRED");
    }

    const canvas = this.canvas!;
    const webgl = this.webgl!;

    return webgl.withOutputResolution(
      TARGET_WIDTH,
      TARGET_HEIGHT,
      async () => {
        await waitForFrame();

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
          buildFilename(format, this.options.getFilterId(), this.options.getFacingMode()),
          TARGET_WIDTH,
          TARGET_HEIGHT,
        );
      },
    );
  }

  async startVideo(): Promise<void> {
    this.assertCaptureReady();

    if (this.videoWidth < TARGET_WIDTH || this.videoHeight < TARGET_HEIGHT) {
      throw new Error("CAPTURE_4K_SOURCE_REQUIRED");
    }

    if (this.isRecording) return;

    const sourceStream = this.options.getSourceStream();
    if (!sourceStream) throw new Error("CAMERA_STREAM_UNAVAILABLE");

    const requested = this.preferredFormat;
    const mimeType = chooseRecorderMimeType(requested);

    if (!mimeType) {
      throw new Error("VIDEO_FORMAT_UNSUPPORTED");
    }

    await this.webgl!.setOutputResolution(TARGET_WIDTH, TARGET_HEIGHT);

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

    return new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, {
            type: recorder.mimeType || undefined,
          });

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
                this.options.getFilterId(),
                this.options.getFacingMode(),
              ),
              TARGET_WIDTH,
              TARGET_HEIGHT,
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
    if (this.recording && this.recording.state === "recording") {
      this.recording.stop();
    }

    await this.cleanupRecording();
    await this.webgl?.restorePreviewResolution();

    this.recording = null;
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
    this.chunks = [];

    if (cleanup) {
      await cleanup();
    }
  }
}