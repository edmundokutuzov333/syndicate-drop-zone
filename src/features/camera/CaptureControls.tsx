import { type CaptureMode, type CaptureTimer } from "@/lib/camera/types";

type CaptureControlsProps = { mode: CaptureMode; timer: CaptureTimer };

export function CaptureControls({ mode, timer }: CaptureControlsProps) {
  return (
    <div className="camera-capture-row">
      <button type="button" className="camera-capture-button" disabled>
        <span className="camera-capture-core" />
        <span>{mode === "photo" ? "CAPTURE" : "REC"}</span>
      </button>
      <div className="camera-capture-meta">
        <span>INPUT: OFF</span>
        <span>TIMER: {timer === "off" ? "OFF" : `${timer}S`}</span>
      </div>
    </div>
  );
}
