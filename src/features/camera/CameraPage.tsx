import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CameraControls } from "./CameraControls";
import { CameraViewport } from "./CameraViewport";
import { CaptureControls } from "./CaptureControls";
import { CapturePreview } from "./CapturePreview";
import { FilterRail } from "./FilterRail";
import { FilterControlPanel } from "./FilterControlPanel";
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
  type MasterOverlayId,
} from "@/lib/camera/types";
import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";
import { type WebGLEngine } from "@/lib/webgl/webgl-engine";

const INITIAL_CAMERA_STATE: CameraState = {
  status: "idle",
  devices: [],
  facingMode: "user",
  microphoneEnabled: false,
  flashEnabled: false,
  flashMode: "off",
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
  const [waveAmount, setWaveAmount] = useState(0);
  const [filterParameterOverrides, setFilterParameterOverrides] = useState<
    Partial<Record<FilterId, Record<string, number>>>
  >({});
  const filterParameterOverridesRef = useRef(filterParameterOverrides);
  filterParameterOverridesRef.current = filterParameterOverrides;
  const [masterOverlays, setMasterOverlays] = useState<Record<MasterOverlayId, boolean>>({
    "cathode-crt": false,
    "paper-film": false,
  });
  const [timer, setTimer] = useState<CaptureTimer>("off");
  const [captureStatus, setCaptureStatus] =
    useState<CaptureStatus>("idle");
  const [flash, setFlash] = useState(false);
  const [preview, setPreview] = useState<CaptureResult | null>(null);
  const [format, setFormat] = useState<CaptureFormat>("jpg");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] =
    useState<HTMLCanvasElement | null>(null);
  const [engineReady, setEngineReady] = useState<WebGLEngine | null>(null);

  const selectedFilter = FILTER_REGISTRY.get(filter);
  const selectedFilterParameters = useMemo(
    () => Object.fromEntries(
      (selectedFilter.controls ?? []).map((control) => [
        control.uniform,
        filterParameterOverrides[filter]?.[control.uniform] ?? control.defaultValue,
      ]),
    ) as Record<string, number>,
    [filter, filterParameterOverrides, selectedFilter],
  );

  const handleFilterParameterChange = useCallback(
    (uniform: string, value: number) => {
      const next = {
        ...filterParameterOverridesRef.current,
        [filter]: {
          ...(filterParameterOverridesRef.current[filter] ?? {}),
          [uniform]: value,
        },
      };
      filterParameterOverridesRef.current = next;
      setFilterParameterOverrides(next);
      engineReady?.setFilterParameter(filter, uniform, value);
    },
    [engineReady, filter],
  );

  const handleWaveAmountChange = useCallback((value: number) => {
    const next = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    setWaveAmount(next);
    engineReady?.setWaveAmount(next);
  }, [engineReady]);

  const handleFilterParameterReset = useCallback(() => {
    const next = { ...filterParameterOverridesRef.current };
    delete next[filter];
    filterParameterOverridesRef.current = next;
    setFilterParameterOverrides(next);
    for (const control of selectedFilter.controls ?? []) {
      engineReady?.setFilterParameter(filter, control.uniform, control.defaultValue);
    }
  }, [engineReady, filter, selectedFilter]);

  useEffect(() => {
    if (!engineReady) return;
    for (const [filterId, parameters] of Object.entries(filterParameterOverridesRef.current)) {
      if (!FILTER_REGISTRY.has(filterId)) continue;
      for (const [uniform, value] of Object.entries(parameters ?? {})) {
        if (typeof value === "number") {
          engineReady.setFilterParameter(filterId as FilterId, uniform, value);
        }
      }
    }
  }, [engineReady]);

  useEffect(() => {
    if (!engineReady) return;
    engineReady.setWaveAmount(waveAmount);
  }, [engineReady, waveAmount]);

  useEffect(() => {
    if (!engineReady) return;

    engineReady.setMasterOverlayEnabled(
      "cathode-crt",
      masterOverlays["cathode-crt"],
    );
    engineReady.setMasterOverlayEnabled(
      "paper-film",
      masterOverlays["paper-film"],
    );
  }, [engineReady, masterOverlays]);

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

  const handleFlashToggle = useCallback(() => {
    void cameraManager.setFlashEnabled(!camera.flashEnabled);
  }, [camera.flashEnabled, cameraManager]);

  useEffect(() => {
    void cameraManager.syncVideoFlash(
      mode === "video" && captureStatus === "recording",
    );

    if (!engineReady) return;

    if (camera.flashEnabled && camera.flashMode === "software") {
      engineReady.setUniform(
        "u_flash",
        mode === "video" && captureStatus === "recording" ? 0.32 : 0.16,
      );
    } else if (!(mode === "video" && captureStatus === "recording")) {
      engineReady.setUniform("u_flash", 0);
    }
  }, [
    camera.flashEnabled,
    camera.flashMode,
    cameraManager,
    captureStatus,
    engineReady,
    mode,
  ]);

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
        void cameraManager.start().catch(() => {
          // CameraManager state drives PermissionGate; avoid an unhandled permission rejection.
        });
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

      for (let current = value; current > 0; current -= 1) {
        engineReady?.setOverlayText(String(current));
        await wait(1000);
      }

      engineReady?.setOverlayText("0");
      await wait(90);
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
      } finally {
        await cameraManager.syncVideoFlash(false);
        engineReady?.setUniform("u_flash", 0);
      }

      return;
    }

    if (
      camera.status !== "active" ||
      !canvasReady ||
      !engineReady ||
      camera.width <= 0 ||
      camera.height <= 0
    ) {
      setCaptureStatus("error");
      setCaptureError("CAMERA_RESOLUTION_UNAVAILABLE");
      return;
    }

    const captureFilter = filter;
    const captureFacingMode = camera.facingMode;

    setCaptureStatus("countdown");

    try {
      await engineReady.waitForFilter(captureFilter);
      await runCountdown(timer);

      if (mode === "photo") {
        setCaptureStatus("processing");
        const hardwareFlashCleanup = await cameraManager.preparePhotoFlash();

        try {
          if (camera.flashMode === "software") {
            engineReady.setUniform("u_flash", 0.95);
          }

          await triggerFlash();

          const photo = await captureEngine.capturePhoto(
            format === "png" ? "png" : "jpg",
            captureFilter,
            captureFacingMode,
          );
          setPreview(photo);
        } finally {
          engineReady.setUniform("u_flash", 0);
          await hardwareFlashCleanup();
        }

        setCaptureStatus("preview");
        return;
      }

      captureEngine.setPreferredFormat(format as "mkv" | "mov" | "mp4" | "webm");

      if (camera.flashEnabled && camera.flashMode === "hardware") {
        await cameraManager.syncVideoFlash(true);
      } else if (camera.flashEnabled) {
        engineReady.setUniform("u_flash", 0.32);
      } else {
        engineReady.setUniform("u_flash", 0);
      }

      await captureEngine.startVideo(
        captureFilter,
        captureFacingMode,
      );
      setCaptureStatus("recording");
    } catch (error) {
      console.error(error);
      await cameraManager.syncVideoFlash(false);
      engineReady?.setUniform("u_flash", 0);
      setCaptureStatus("error");
      setCaptureError(error instanceof Error ? error.message : "CAPTURE_FAILED");
    }
  }, [
    camera,
    cameraManager,
    captureEngine,
    captureStatus,
    canvasReady,
    engineReady,
    filter,
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

  const canCapture =
    camera.status === "active" &&
    camera.width > 0 &&
    camera.height > 0 &&
    Boolean(canvasReady && engineReady);

  const is4K = isReal4KSource(camera.width, camera.height);

  const busy =
    captureStatus === "processing" ||
    captureStatus === "countdown" ||
    (captureStatus === "error" && !canCapture);

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
          filterParameterValues={selectedFilterParameters}
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
          onFlashToggle={handleFlashToggle}
        />

        <div className="camera-shutter-zone">
          <FilterControlPanel
            filter={selectedFilter}
            values={selectedFilterParameters}
            onChange={handleFilterParameterChange}
            onReset={handleFilterParameterReset}
            waveAmount={waveAmount}
            onWaveAmountChange={handleWaveAmountChange}
            locked={
              captureStatus === "countdown" ||
              captureStatus === "processing" ||
              captureStatus === "preview"
            }
          />

          <FilterRail
            selected={filter}
            onSelect={setFilter}
            masterOverlays={masterOverlays}
            onToggleMasterOverlay={(id) =>
              setMasterOverlays((current) => ({
                ...current,
                [id]: !current[id],
              }))
            }
            locked={
              captureStatus === "countdown" ||
              captureStatus === "recording" ||
              captureStatus === "processing" ||
              captureStatus === "preview"
            }
          />

          <CaptureControls
            mode={mode}
            timer={timer}
            format={format}
            formatOptions={formatOptions}
            busy={busy || captureStatus === "preview" || !canCapture}
            recording={captureStatus === "recording"}
            onTimerChange={handleTimerChange}
            onFormatChange={handleFormatChange}
            onCapture={() => void handleCapture()}
          />

          {captureError && captureStatus !== "preview" ? (
            <div className="camera-capture-error">
              {captureError.replaceAll("_", " ")}
            </div>
          ) : canCapture && !is4K ? (
            <div className="camera-capture-lock">
              4K UNAVAILABLE · CAPTURE AT {camera.width}×{camera.height}
            </div>
          ) : !canCapture ? (
            <div className="camera-capture-lock">
              CAMERA RESOLUTION UNAVAILABLE
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