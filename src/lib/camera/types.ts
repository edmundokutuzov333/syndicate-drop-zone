export type CameraFacingMode = "user" | "environment";
export type CaptureMode = "photo" | "video";
export type CaptureTimer = "off" | 3 | 10;
export type FilterId = "op1um" | "xerox" | "corrupt" | "nightvision" | "thermal" | "redroom";
export type PerformanceTier = "high" | "medium" | "low";

export type CameraDevice = { deviceId: string; label: string; facingMode?: CameraFacingMode; groupId?: string };
export type CameraState = {
  status: "idle" | "requesting" | "ready" | "active" | "error";
  devices: CameraDevice[];
  facingMode: CameraFacingMode;
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
};
export type FilterDefinition = {
  id: FilterId;
  index: string;
  label: string;
  shaderKey: string;
  visible: boolean;
  supportsFeedback: boolean;
};
export type ShaderProgramHandle = { key: string; program: WebGLProgram };
export type WebglEngineConfig = {
  alpha?: boolean;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  targetFps?: number;
};
export type CaptureResult = { mode: CaptureMode; blob: Blob; url: string; mimeType: string };
export type RecorderCapabilities = {
  supported: boolean;
  mimeTypes: string[];
  canvasCaptureSupported: boolean;
};
