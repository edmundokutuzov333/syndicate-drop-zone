import { type OrientationState } from "./types";

export function normalizeAngle(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function calculateOrientationState(screenAngle: number, viewportAngle: number, cameraAngle: number): OrientationState {
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

  getState(): OrientationState { return this.state; }
  subscribe(listener: (state: OrientationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  update(screenAngle: number, viewportAngle: number, cameraAngle: number): void {
    this.state = calculateOrientationState(screenAngle, viewportAngle, cameraAngle);
    this.listeners.forEach((listener) => listener(this.state));
  }
  destroy(): void { this.listeners.clear(); }
}
