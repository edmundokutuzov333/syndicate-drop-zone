import {
  type CaptureFormat,
  type CaptureFormatCapability,
  type CaptureMode,
  type CaptureTimer,
} from "@/lib/camera/types";

type CaptureControlsProps = {
  mode: CaptureMode;
  timer: CaptureTimer;
  format: CaptureFormat;
  formatOptions: CaptureFormatCapability[];
  busy: boolean;
  recording: boolean;
  countdown: number | null;
  onTimerChange: (timer: CaptureTimer) => void;
  onFormatChange: (format: CaptureFormat) => void;
  onCapture: () => void;
};

export function CaptureControls({
  mode,
  timer,
  format,
  formatOptions,
  busy,
  recording,
  countdown,
  onTimerChange,
  onFormatChange,
  onCapture,
}: CaptureControlsProps) {
  const timerValues: CaptureTimer[] = ["off", 3, 10];

  return (
    <div className="camera-capture">
      <div className="camera-capture-tools">
        <div className="camera-timer-strip" aria-label="Temporizador">
          <span>TIMER</span>
          {timerValues.map((value) => (
            <button
              key={String(value)}
              type="button"
              className={timer === value ? "is-active" : ""}
              disabled={busy}
              onClick={() => onTimerChange(value)}
            >
              {value === "off" ? "OFF" : value + "S"}
            </button>
          ))}
        </div>

        <label className="camera-format-select">
          <span>OUT</span>
          <select
            value={format}
            disabled={busy}
            onChange={(event) =>
              onFormatChange(event.target.value as CaptureFormat)
            }
          >
            {formatOptions.map((option) => (
              <option
                key={option.format}
                value={option.format}
                disabled={!option.supported}
              >
                {option.extension.toUpperCase()} {option.supported ? "" : "· UNAVAILABLE"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        className={"camera-shutter " + (recording ? "is-recording" : "")}
        disabled={busy}
        onClick={onCapture}
        aria-label={
          recording
            ? "Parar gravação"
            : mode === "photo"
              ? "Capturar fotografia"
              : "Iniciar gravação"
        }
      >
        <span className="camera-shutter-outer" />
        <span className="camera-shutter-inner" />
        {countdown !== null ? (
          <span className="camera-shutter-countdown">{countdown}</span>
        ) : null}
      </button>
    </div>
  );
}