import { useMemo, useState } from "react";
import { CameraControls } from "./CameraControls";
import { CameraViewport } from "./CameraViewport";
import { CaptureControls } from "./CaptureControls";
import { FilterRail } from "./FilterRail";
import { PermissionGate } from "./PermissionGate";
import { type CaptureMode, type CaptureTimer, type FilterId } from "@/lib/camera/types";
import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";

export function CameraPage() {
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [timer, setTimer] = useState<CaptureTimer>("off");
  const [filter, setFilter] = useState<FilterId>("op1um");
  const selectedFilter = useMemo(() => FILTER_REGISTRY.get(filter), [filter]);

  return (
    <main className="camera-surface min-h-[calc(100vh-1px)] bg-black text-[#e8e4d8]">
      <div className="camera-shell">
        <header className="camera-header">
          <div>
            <p className="camera-kicker">CAMERA / 04</p>
            <h1 className="camera-title">CAPTURE UNIT</h1>
          </div>
          <div className="camera-status" aria-live="polite">
            <span className="camera-status-dot" />
            LOCAL / READY
          </div>
        </header>
        <section className="camera-stage" aria-label="Superfície da camera">
          <CameraViewport filter={filter} />
          <PermissionGate />
          <div className="camera-overlay camera-overlay-top">
            <span>NO SIGNAL</span>
            <span>{selectedFilter.label}</span>
          </div>
          <div className="camera-overlay camera-overlay-bottom">
            <span>WEBGL FOUNDATION</span>
            <span>CAMERA OFF</span>
          </div>
        </section>
        <section className="camera-console">
          <FilterRail selected={filter} onSelect={setFilter} />
          <CameraControls mode={mode} timer={timer} onModeChange={setMode} onTimerChange={setTimer} />
          <CaptureControls mode={mode} timer={timer} />
        </section>
      </div>
    </main>
  );
}
