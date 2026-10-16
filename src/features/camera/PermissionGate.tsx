import { type CameraStatus } from "@/lib/camera/types";

type PermissionGateProps = {
  status: CameraStatus;
  error: string | null;
  onRetry: () => Promise<void>;
};

export function PermissionGate({
  status,
  error,
  onRetry,
}: PermissionGateProps) {
  if (status === "active" || status === "ready") return null;

  if (status === "requesting" || status === "idle") {
    return (
      <div className="camera-boot-state" aria-live="polite">
        INPUT / OPENING
      </div>
    );
  }

  return (
    <div className="camera-permission-gate" role="status">
      <span className="camera-permission-code">
        {error === "NotAllowedError"
          ? "PERMISSION BLOCKED"
          : "INPUT ERROR"}
      </span>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="camera-permission-action"
      >
        {error === "NotAllowedError" ? "ALLOW" : "RETRY"}
      </button>
    </div>
  );
}