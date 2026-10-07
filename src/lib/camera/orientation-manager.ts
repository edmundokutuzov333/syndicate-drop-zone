import { type OrientationState } from "./types";

function readScreenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation) {
    return screen.orientation.angle;
  }

  const legacyAngle = typeof window !== "undefined" && "orientation" in window
    ? Number((window as Window & { orientation?: number }).orientation ?? 0)
    : 0;

  return Number.isFinite(legacyAngle) ? legacyAngle : 0;
}

export function normalizeAngle(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function calculateOrientationState(
  screenAngle: number,
  viewportAngle: number,
  cameraAngle: number,
): OrientationState {
  const screen = normalizeAngle(screenAngle);
  const viewport = normalizeAngle(viewportAngle);
  const camera = normalizeAngle(cameraAngle);

  return {
    screenAngle: screen,
    viewportAngle: viewport,
    cameraAngle: camera,
    renderRotation: normalizeAngle(screen + viewport - camera),
    captureRotation: normalizeAngle(camera - screen),
  };
}

export class OrientationManager {
  private listeners = new Set<(state: OrientationState) => void>();
  private state: OrientationState = calculateOrientationState(0, 0, 0);
  private cameraAngle = 0;
  private started = false;

  getState(): OrientationState {
    return this.state;
  }

  subscribe(listener: (state: OrientationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(cameraAngle = 0): void {
    if (this.started) {
      this.setCameraAngle(cameraAngle);
      return;
    }

    this.cameraAngle = normalizeAngle(cameraAngle);
    this.started = true;
    this.sync();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.sync);
      window.visualViewport?.addEventListener("resize", this.sync);
    }

    if (typeof screen !== "undefined" && screen.orientation) {
      screen.orientation.addEventListener("change", this.sync);
    }
  }

  setCameraAngle(cameraAngle: number): void {
    this.cameraAngle = normalizeAngle(cameraAngle);
    this.sync();
  }

  update(screenAngle: number, viewportAngle: number, cameraAngle: number): void {
    this.state = calculateOrientationState(screenAngle, viewportAngle, cameraAngle);
    this.listeners.forEach((listener) => listener(this.state));
  }

  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.sync);
      window.visualViewport?.removeEventListener("resize", this.sync);
    }

    if (typeof screen !== "undefined" && screen.orientation) {
      screen.orientation.removeEventListener("change", this.sync);
    }

    this.started = false;
    this.listeners.clear();
  }

  private sync = (): void => {
    this.update(readScreenAngle(), 0, this.cameraAngle);
  };
}
