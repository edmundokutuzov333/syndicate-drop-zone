import { type CaptureMode } from "@/lib/camera/types";

type CaptureControlsProps = {
  mode: CaptureMode;
};

export function CaptureControls({ mode }: CaptureControlsProps) {
  return (
    <div className="camera-capture">
      <button
        type="button"
        className="camera-shutter"
        disabled
        aria-label={mode === "photo" ? "Shutter. Captura disponível na Fase 3." : "Rec. Gravação disponível na Fase 3."}
      >
        <span className="camera-shutter-outer" />
        <span className="camera-shutter-inner" />
      </button>
    </div>
  );
}
