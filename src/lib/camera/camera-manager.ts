import { DeviceManager } from "./device-manager";
import { type CameraDevice, type CameraFacingMode, type CameraState } from "./types";

type CameraListener = (state: CameraState) => void;

export class CameraManager {
  private readonly deviceManager = new DeviceManager();
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private listeners = new Set<CameraListener>();
  private state: CameraState = { status: "idle", devices: [], facingMode: "user", error: null };

  async requestPermissions(): Promise<MediaStream> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("MEDIA_DEVICES_UNAVAILABLE");
    }
    this.setState({ status: "requesting", error: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.state.facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      this.stream = stream;
      this.setState({ status: "ready", error: null });
      await this.refreshDevices();
      return stream;
    } catch (error) {
      const message = error instanceof DOMException ? error.name : "MEDIA_PERMISSION_FAILED";
      this.setState({ status: "error", error: message });
      throw error;
    }
  }

  async start(): Promise<void> {
    const stream = this.stream ?? await this.requestPermissions();
    const video = this.getVideoElement();
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    this.setState({ status: "active", error: null });
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.setState({ status: "idle", error: null });
  }

  async switchCamera(): Promise<void> {
    const nextFacing: CameraFacingMode = this.state.facingMode === "user" ? "environment" : "user";
    this.setState({ facingMode: nextFacing });
    const devices = await this.refreshDevices();
    const preferred = this.deviceManager.prefer(nextFacing, devices);
    if (!this.stream) return;
    this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: preferred?.deviceId ? { deviceId: { exact: preferred.deviceId } } : { facingMode: { ideal: nextFacing } },
      audio: true,
    });
    this.stream = stream;
    await this.start();
  }

  getState(): CameraState { return this.state; }

  getVideoElement(): HTMLVideoElement {
    if (this.video) return this.video;
    if (typeof document === "undefined") throw new Error("CAMERA_VIDEO_ELEMENT_UNAVAILABLE");
    this.video = document.createElement("video");
    this.video.setAttribute("aria-hidden", "true");
    return this.video;
  }

  getStream(): MediaStream | null { return this.stream; }

  subscribe(listener: CameraListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async refreshDevices(): Promise<CameraDevice[]> {
    const devices = await this.deviceManager.enumerate();
    this.setState({ devices });
    return devices;
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
    this.video = null;
  }

  private setState(patch: Partial<CameraState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
