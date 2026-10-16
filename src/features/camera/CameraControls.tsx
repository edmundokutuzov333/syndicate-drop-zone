import { type CameraState, type CaptureMode, type CaptureStatus } from "@/lib/camera/types";
import { isReal4KSource } from "@/lib/camera/capture-engine";

type CameraControlsProps = {
  camera: CameraState;
  mode: CaptureMode;
  captureStatus: CaptureStatus;
  onModeChange: (mode: CaptureMode) => void;
  onSwitchCamera: () => Promise<void>;
  onFlashToggle: () => void;
};

function formatResolution(width: number, height: number): string {
  if (isReal4KSource(width, height)) return "4K";
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
  onFlashToggle,
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
    captureStatus === "processing" ||
    captureStatus === "preview";

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
            camera.status !== "active"
          }
          aria-label="Trocar câmara"
        >
          {cameraLabel}
        </button>
        <button
          type="button"
          className={"camera-flash-toggle " + (camera.flashEnabled ? "is-active" : "")}
          onClick={onFlashToggle}
          disabled={locked || camera.status !== "active"}
          aria-pressed={camera.flashEnabled}
          aria-label={camera.flashEnabled ? "Desligar flash" : "Ligar flash"}
          title={
            camera.flashMode === "hardware"
              ? "Flash físico"
              : camera.flashMode === "software"
                ? "Flash de software"
                : "Flash"
          }
        >
          FLASH {camera.flashEnabled ? "ON" : "OFF"}
        </button>
        <span>{fps}</span>
      </div>

      <div className="camera-mode-switch" role="group" aria-label="Modo de captura">
        <span className="camera-mode-switch-kicker">MODO</span>
        <button
          type="button"
          className={mode === "photo" ? "is-active is-photo-selected" : ""}
          onClick={() => onModeChange("photo")}
          disabled={locked}
          aria-label="Modo fotografia"
          aria-pressed={mode === "photo"}
          title="Mudar para fotografia"
        >
          <span className="camera-mode-switch-icon camera-mode-photo-icon" aria-hidden="true">◉</span>
          <span>FOTO</span>
        </button>
        <button
          type="button"
          className={mode === "video" ? "is-active is-video-selected" : ""}
          onClick={() => onModeChange("video")}
          disabled={locked}
          aria-label="Modo vídeo"
          aria-pressed={mode === "video"}
          title="Mudar para gravação de vídeo"
        >
          <span className="camera-mode-switch-icon camera-mode-video-icon" aria-hidden="true">●</span>
          <span>VÍDEO</span>
        </button>
      </div>
    </>
  );
}