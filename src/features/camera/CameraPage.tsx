import { useCallback, useEffect, useMemo, useState } from "react";
import { CameraControls } from "./CameraControls";
import { CameraViewport } from "./CameraViewport";
import { CaptureControls } from "./CaptureControls";
import { FilterRail } from "./FilterRail";
import { PermissionGate } from "./PermissionGate";
import { CameraManager } from "@/lib/camera/camera-manager";
import {
  type CameraState,
  type CaptureMode,
  type FilterId,
} from "@/lib/camera/types";
import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";

const INITIAL_CAMERA_STATE: CameraState = {
  status: "idle",
  devices: [],
  facingMode: "user",
  microphoneEnabled: false,
  width: 0,
  height: 0,
  frameRate: 0,
  error: null,
};

export function CameraPage() {
  const cameraManager = useMemo(() => new CameraManager(), []);
  const [camera, setCamera] = useState<CameraState>(() => ({
    ...INITIAL_CAMERA_STATE,
    ...cameraManager.getState(),
  }));
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [filter, setFilter] = useState<FilterId>("op1um");
  const selectedFilter = FILTER_REGISTRY.get(filter);

  useEffect(() => {
    const unsubscribe = cameraManager.subscribe(setCamera);

    return () => {
      unsubscribe();
      cameraManager.destroy();
    };
  }, [cameraManager]);

  const startCamera = useCallback(async () => {
    try {
      await cameraManager.start();
    } catch {
      // CameraManager exposes the concrete error through its state.
    }
  }, [cameraManager]);

  const handleSwitchCamera = useCallback(async () => {
    try {
      await cameraManager.switchCamera();
    } catch {
      // CameraManager owns the user-facing fallback state.
    }
  }, [cameraManager]);

  const retryPermission = useCallback(async () => {
    try {
      await cameraManager.start();
    } catch {
      // PermissionGate remains visible through CameraManager state.
    }
  }, [cameraManager]);

  return (
    <main className="camera-surface" data-filter={selectedFilter.id}>
      <section
        className="camera-stage-full"
        aria-label="Câmara do Sindicato"
      >
        <CameraViewport
          manager={cameraManager}
          facingMode={camera.facingMode}
          filter={filter}
          onReady={startCamera}
        />

        <CameraControls
          camera={camera}
          mode={mode}
          onModeChange={setMode}
          onSwitchCamera={handleSwitchCamera}
        />

        <div className="camera-shutter-zone">
          <FilterRail selected={filter} onSelect={setFilter} />
          <CaptureControls mode={mode} />
        </div>

        <PermissionGate
          status={camera.status}
          error={camera.error}
          onRetry={retryPermission}
        />
      </section>
    </main>
  );
}