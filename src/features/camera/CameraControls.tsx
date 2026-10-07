import { type CaptureMode, type CaptureTimer } from "@/lib/camera/types";

type CameraControlsProps = {
  mode: CaptureMode;
  timer: CaptureTimer;
  onModeChange: (mode: CaptureMode) => void;
  onTimerChange: (timer: CaptureTimer) => void;
};

const timers: CaptureTimer[] = ["off", 3, 10];

export function CameraControls({ mode, timer, onModeChange, onTimerChange }: CameraControlsProps) {
  return (
    <div className="camera-control-row">
      <div className="camera-control-group">
        <span className="camera-control-label">MODE</span>
        {(["photo", "video"] as const).map((value) => (
          <button key={value} type="button" className={`camera-control-button ${mode === value ? "is-active" : ""}`} onClick={() => onModeChange(value)}>
            {value.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="camera-control-group">
        <span className="camera-control-label">TIMER</span>
        {timers.map((value) => (
          <button key={String(value)} type="button" className={`camera-control-button ${timer === value ? "is-active" : ""}`} onClick={() => onTimerChange(value)}>
            {value === "off" ? "OFF" : `${value}S`}
          </button>
        ))}
      </div>
    </div>
  );
}
