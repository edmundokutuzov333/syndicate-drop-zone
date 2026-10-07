export type CameraFacingMode = "user" | "environment";
export type CaptureMode = "photo" | "video";
export type CaptureTimer = "off" | 3 | 10;
export type FilterId =
  | "op1um"
  | "xerox"
  | "corrupt"
  | "nightvision"
  | "thermal"
  | "redroom"
  | "vamp"
  | "astro-haze"
  | "cyber-mugshot"
  | "threshold"
  | "xray-mesh"
  | "cathode-crt"
  | "halation"
  | "kinetic-melt"
  | "paper-film";
export type MasterOverlayId = "cathode-crt" | "paper-film";
export type FlashMode = "off" | "hardware" | "software";
export type PerformanceTier = "high" | "medium" | "low";
export type CameraStatus = "idle" | "requesting" | "ready" | "active" | "error" | "stopped";

export type CameraDevice = {
  deviceId: string;
  label: string;
  facingMode?: CameraFacingMode;
  groupId?: string;
};

export type FaceVfxUniformState = {
  face: [number, number, number, number];
  eyes: [number, number, number, number];
  mouth: [number, number, number, number];
  details: [number, number, number, number];
  pose: [number, number, number, number];
  matrix: [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
  ];
  motion: number;
  motionBurst: number;
  present: number;
};

export type CameraState = {
  status: CameraStatus;
  devices: CameraDevice[];
  facingMode: CameraFacingMode;
  microphoneEnabled: boolean;
  flashEnabled: boolean;
  flashMode: FlashMode;
  width: number;
  height: number;
  frameRate: number;
  deviceId?: string;
  error: string | null;
};

export type MicrophoneState = "unknown" | "available" | "unavailable" | "denied";

export type OrientationState = {
  screenAngle: number;
  viewportAngle: number;
  cameraAngle: number;
  renderRotation: number;
  captureRotation: number;
};

export type RenderMetrics = {
  fps: number;
  frameTimeMs: number;
  droppedFrames: number;
  deviceTier: PerformanceTier;
  dpr: number;
  renderScale: number;
  renderTimeMs?: number;
  textureUploadTimeMs?: number;
  shaderCompileTimeMs?: number;
  gpuTimeMs?: number;
  memoryUsedMb?: number;
  gcEvents?: number;
  drawCalls?: number;
};

export type FilterComplexity = "low" | "medium" | "high";

export type FilterUniformDefaults = {
  intensity: number;
  noise: number;
  distortion: number;
  chromatic: number;
  feedback: number;
};

export type FilterDefinition = {
  id: FilterId;
  index: string;
  label: string;
  shaderKey: string;
  complexity: FilterComplexity;
  visible: boolean;
  supportsFeedback: boolean;
  enabled: boolean;
  defaults: FilterUniformDefaults;
  pipeline?: "single" | "xray-mesh" | "halation" | "kinetic-melt";
  passes?: readonly string[];
  masterOverlay?: "cathode-crt" | "paper-film";
  parameters?: readonly {
    name: string;
    defaultValue: number | number[];
    min?: number;
    max?: number;
    step?: number;
  }[];
};

export type CaptureFormat =
  | "jpg"
  | "png"
  | "tiff"
  | "mp4"
  | "mov"
  | "mkv"
  | "webm";

export type CaptureStatus =
  | "idle"
  | "countdown"
  | "recording"
  | "processing"
  | "preview"
  | "error";

export type CaptureFormatCapability = {
  format: CaptureFormat;
  label: string;
  extension: string;
  mimeType?: string;
  supported: boolean;
  reason?: string;
};

export type ShaderProgramHandle = {
  key: string;
  program: WebGLProgram;
};

export type WebglEngineConfig = {
  alpha?: boolean;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  targetFps?: number;
};

export type CaptureResult = {
  mode: CaptureMode;
  blob: Blob;
  url: string;
  mimeType: string;
  format: CaptureFormat;
  filename: string;
  width: number;
  height: number;
  durationMs?: number;
};

export type RecorderCapabilities = {
  supported: boolean;
  mimeTypes: string[];
  canvasCaptureSupported: boolean;
  audioCaptureSupported: boolean;
};

export type WebglCapabilities = {
  webgl2: boolean;
  webgl1: boolean;
};