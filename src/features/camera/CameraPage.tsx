import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CameraControls } from "./CameraControls";
import { CameraViewport } from "./CameraViewport";
import { CaptureControls } from "./CaptureControls";
import { CapturePreview } from "./CapturePreview";
import { FilterRail } from "./FilterRail";
import { PermissionGate } from "./PermissionGate";
import { CaptureEngine, isReal4KSource } from "@/lib/camera/capture-engine";
import {
  getImageFormatCapabilities,
  getVideoFormatCapabilities,
} from "@/lib/camera/recorder";
import { CameraManager } from "@/lib/camera/camera-manager";
import {
  type CameraState,
  type CaptureFormat,
  type CaptureMode,
  type CaptureResult,
  type CaptureStatus,
  type CaptureTimer,
  type FilterId,
} from "@/lib/camera/types";
import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";
import { type WebGLEngine } from "@/lib/webgl/webgl-engine";

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function CameraPage() {
  const cameraManager = useMemo(() => new CameraManager(), []);

  const [camera, setCamera] = useState<CameraState>(() => ({
    ...INITIAL_CAMERA_STATE,
    ...cameraManager.getState(),
  }));
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [filter, setFilter] = useState<FilterId>("op1um");
  const [timer, setTimer] = useState<CaptureTimer>("off");
  const [captureStatus, setCaptureStatus] =
    useState<CaptureStatus>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [preview, setPreview] = useState<CaptureResult | null>(null);
  const [format, setFormat] = useState<CaptureFormat>("jpg");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] =
    useState<HTMLCanvasElement | null>(null);
  const [engineReady, setEngineReady] = useState<WebGLEngine | null>(null);

  const selectedFilter = FILTER_REGISTRY.get(filter);

  const selectedFilterRef = useRef(filter);
  const cameraFacingRef = useRef(camera.facingMode);

  selectedFilterRef.current = filter;
  cameraFacingRef.current = camera.facingMode;

  const captureEngine = useMemo(
    () =>
      new CaptureEngine({
        getSourceStream: () => cameraManager.getStream(),
        getFilterId: () => selectedFilterRef.current,
        getFacingMode: () => cameraFacingRef.current,
      }),
    [cameraManager],
  );

  const formatOptions = useMemo(
    () =>
      mode === "photo"
        ? getImageFormatCapabilities()
        : getVideoFormatCapabilities(),
    [mode],
  );

  useEffect(() => {
    const nextSupported =
      formatOptions.find((option) => option.supported)?.format ??
      formatOptions[0]?.format ??
      "webm";
    setFormat((current) =>
      formatOptions.some(
        (option) => option.format === current && option.supported,
      )
        ? current
        : nextSupported,
    );
  }, [formatOptions]);

  useEffect(() => {
    const unsubscribe = cameraManager.subscribe(setCamera);

    return () => {
      unsubscribe();
      void captureEngine.dispose();
      cameraManager.destroy();
    };
  }, [cameraManager, captureEngine]);

  useEffect(() => {
    captureEngine.attach(canvasReady, engineReady);
    captureEngine.setSourceSize(camera.width, camera.height);
  }, [camera.width, camera.height, canvasReady, captureEngine, engineReady]);

  const startCamera = useCallback(async () => {
    try {
      await cameraManager.start();
    } catch {
      // CameraManager exposes the concrete error through its state.
    }
  }, [cameraManager]);

  const handleSwitchCamera = useCallback(async () => {
    if (captureEngine.isRecording) return;

    try {
      await cameraManager.switchCamera();
    } catch {
      // CameraManager owns the user-facing fallback state.
    }
  }, [cameraManager, captureEngine]);

  const retryPermission = useCallback(async () => {
    try {
      await cameraManager.start();
    } catch {
      // PermissionGate remains visible through CameraManager state.
    }
  }, [cameraManager]);

  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        !captureEngine.isRecording
      ) {
        void cameraManager.start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [cameraManager, captureEngine]);


  const runCountdown = useCallback(
    async (value: CaptureTimer) => {
      if (value === "off") {
        engineReady?.setOverlayText(null);
        return;
      }

      setCaptureStatus("countdown");

      for (let current = value; current > 0; current -= 1) {
        setCountdown(current);
        engineReady?.setOverlayText(String(current));
        await wait(1000);
      }

      setCountdown(0);
      engineReady?.setOverlayText("0");
      await wait(90);
      setCountdown(null);
      engineReady?.setOverlayText(null);
    },
    [engineReady],
  );

  const triggerFlash = useCallback(async () => {
    setFlash(true);
    await wait(90);
    setFlash(false);
  }, []);

  const handleCapture = useCallback(async () => {
    if (captureStatus === "processing" || captureStatus === "countdown") {
      return;
    }

    setCaptureError(null);

    if (mode === "video" && captureEngine.isRecording) {
      setCaptureStatus("processing");

      try {
        const result = await captureEngine.stopVideo();
        if (result) {
          setPreview(result);
          setCaptureStatus("preview");
        } else {
          setCaptureStatus("idle");
        }
      } catch (error) {
        setCaptureStatus("error");
        setCaptureError(error instanceof Error ? error.message : "VIDEO_RECORDING_FAILED");
        console.error(error);
      }

      return;
    }

    if (
      camera.status !== "active" ||
      !canvasReady ||
      !engineReady ||
      !isReal4KSource(camera.width, camera.height)
    ) {
      setCaptureStatus("error");
      setCaptureError("CAPTURE_4K_SOURCE_REQUIRED");
      return;
    }

    try {
      await runCountdown(timer);

      if (mode === "photo") {
        setCaptureStatus("processing");
        await triggerFlash();

        const photo = await captureEngine.capturePhoto(
          format === "png" ? "png" : "jpg",
        );
        setPreview(photo);
        setCaptureStatus("preview");
        return;
      }

      captureEngine.setPreferredFormat(format);

      await captureEngine.startVideo();
      setCaptureStatus("recording");
    } catch (error) {
      console.error(error);
      setCaptureStatus("error");
      setCaptureError(error instanceof Error ? error.message : "CAPTURE_FAILED");
      setCountdown(null);
    }
  }, [
    camera,
    captureEngine,
    captureStatus,
    canvasReady,
    engineReady,
    format,
    mode,
    runCountdown,
    timer,
    triggerFlash,
  ]);

  const handleModeChange = useCallback((next: CaptureMode) => {
    if (captureStatus === "recording" || captureStatus === "countdown") {
      return;
    }
    setMode(next);
    setCaptureStatus("idle");
  }, [captureStatus]);

  const handleTimerChange = useCallback(
    (next: CaptureTimer) => {
      if (captureStatus === "recording" || captureStatus === "countdown") {
        return;
      }
      setTimer(next);
    },
    [captureStatus],
  );

  const handleFormatChange = useCallback((next: CaptureFormat) => {
    setFormat(next);
  }, []);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  const closePreview = useCallback(() => {
    setPreview(null);
    setCaptureError(null);
    setCaptureStatus("idle");
  }, []);

  const canCapture4K =
    camera.status === "active" &&
    isReal4KSource(camera.width, camera.height) &&
    Boolean(canvasReady && engineReady);

  const busy =
    captureStatus === "processing" ||
    captureStatus === "countdown" ||
    (captureStatus === "error" && !canCapture4K);

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
          onCanvasReady={setCanvasReady}
          onEngineReady={setEngineReady}
          recording={captureStatus === "recording"}
        />

        <CameraControls
          camera={camera}
          mode={mode}
          captureStatus={captureStatus}
          onModeChange={handleModeChange}
          onSwitchCamera={handleSwitchCamera}
        />

        <div className="camera-shutter-zone">
          <FilterRail selected={filter} onSelect={setFilter} />

          <CaptureControls
            mode={mode}
            timer={timer}
            format={format}
            formatOptions={formatOptions}
            busy={busy || captureStatus === "preview" || !canCapture4K}
            recording={captureStatus === "recording"}
            countdown={countdown}
            onTimerChange={handleTimerChange}
            onFormatChange={handleFormatChange}
            onCapture={() => void handleCapture()}
          />

          {captureError && captureStatus !== "preview" ? (
            <div className="camera-capture-error">
              {captureError.replaceAll("_", " ")}
            </div>
          ) : !canCapture4K ? (
            <div className="camera-capture-lock">
              4K SOURCE REQUIRED · {camera.width || "--"}×{camera.height || "--"} AVAILABLE
            </div>
          ) : null}
        </div>

        <div
          className={"camera-flash " + (flash ? "is-active" : "")}
          aria-hidden="true"
        />

        <PermissionGate
          status={camera.status}
          error={camera.error}
          onRetry={retryPermission}
        />

        {preview ? (
          <CapturePreview
            result={preview}
            onClose={closePreview}
          />
        ) : null}
      </section>
    </main>
  );
}
