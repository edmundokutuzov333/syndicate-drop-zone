import { type CameraState, type CaptureMode, type CaptureStatus } from "@/lib/camera/types";

type CameraControlsProps = {
  camera: CameraState;
  mode: CaptureMode;
  captureStatus: CaptureStatus;
  onModeChange: (mode: CaptureMode) => void;
  onSwitchCamera: () => Promise<void>;
};

function formatResolution(width: number, height: number): string {
  if (width >= 3840 && height >= 2160) return "4K";
  if (width >= 2560 && height >= 1440) return "2K";
  if (width >= 1920 && height >= 1080) return "1080P";
  if (width >= 1280 && height >= 720) return "720P";
  if (width > 0 && height > 0) return width + "×" + height;
  return "---";
}

export function CameraControls({
  camera,
  mode,
  captureStatus,
  onModeChange,
  onSwitchCamera,
}: CameraControlsProps) {
  const cameraLabel =
    camera.facingMode === "user" ? "FRONT" : "BACK";
  const fps = camera.frameRate > 0 ? String(camera.frameRate) : "--";
  const mic = camera.microphoneEnabled ? "MIC ON" : "MIC OFF";
  const recording =
    captureStatus === "recording"
      ? "REC"
      : mode === "video"
        ? "REC STBY"
        : "REC OFF";
  const locked =
    captureStatus === "recording" ||
    captureStatus === "countdown" ||
    captureStatus === "processing";

  return (
    <>
      <div className="camera-hud camera-hud-top">
        <span className="camera-hud-indicator">
          <span
            className={
              "camera-rec-dot " +
              (captureStatus === "recording" ? "is-recording" : "")
            }
          />
          {recording}
        </span>

        <span>{mic}</span>
        <span>{formatResolution(camera.width, camera.height)}</span>
        <button
          type="button"
          className="camera-camera-switch"
          onClick={() => void onSwitchCamera()}
          disabled={
            locked ||
            camera.status !== "active" ||
            camera.devices.length < 2
          }
          aria-label="Trocar câmara"
        >
          {cameraLabel}
        </button>
        <span>{fps}</span>
      </div>

      <div className="camera-mode-switch">
        <button
          type="button"
          className={mode === "photo" ? "is-active" : ""}
          onClick={() => onModeChange("photo")}
          disabled={locked}
        >
          PHOTO
        </button>
        <span>|</span>
        <button
          type="button"
          className={mode === "video" ? "is-active" : ""}
          onClick={() => onModeChange("video")}
          disabled={locked}
        >
          VIDEO
        </button>
      </div>
    </>
  );
}