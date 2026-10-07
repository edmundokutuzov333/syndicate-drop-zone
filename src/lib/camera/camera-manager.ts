import { DeviceManager } from "./device-manager";
import {
  type CameraDevice,
  type CameraFacingMode,
  type CameraState,
} from "./types";

type CameraListener = (state: CameraState) => void;

const VIDEO_PREFERENCES: MediaTrackConstraints = {
  width: { ideal: 3840 },
  height: { ideal: 2160 },
  frameRate: { ideal: 60, max: 60 },
  aspectRatio: { ideal: 16 / 9 },
};

export class CameraManager {
  private readonly deviceManager = new DeviceManager();
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private listeners = new Set<CameraListener>();
  private requestToken = 0;
  private destroyed = false;
  private state: CameraState = {
    status: "idle",
    devices: [],
    facingMode: "user",
    microphoneEnabled: false,
    width: 0,
    height: 0,
    frameRate: 0,
    error: null,
  };

  async requestPermissions(): Promise<void> {
    if (this.destroyed) return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const error = new Error("MEDIA_DEVICES_UNAVAILABLE");
      this.setState({ status: "error", error: error.message });
      throw error;
    }

    const token = ++this.requestToken;

    this.setState({
      status: "requesting",
      microphoneEnabled: false,
      error: null,
    });

    try {
      const stream = await this.openStream(this.state.facingMode);

      if (token !== this.requestToken || this.destroyed) {
        this.stopStream(stream);
        return;
      }

      this.replaceStream(stream);
      this.setState({ status: "ready", error: null });

      try {
        await this.refreshDevices();
      } catch {
        // Device enumeration is an enhancement after permission, not a prerequisite for the live stream.
      }
    } catch (error) {
      if (token !== this.requestToken || this.destroyed) return;

      const message =
        error instanceof DOMException
          ? error.name
          : error instanceof Error
            ? error.message
            : "MEDIA_PERMISSION_FAILED";

      this.setState({
        status: "error",
        microphoneEnabled: false,
        error: message,
      });

      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.destroyed) return;

    const currentVideoTrack = this.stream?.getVideoTracks()[0];

    if (
      !this.stream ||
      !currentVideoTrack ||
      currentVideoTrack.readyState !== "live"
    ) {
      await this.requestPermissions();
    }

    if (this.destroyed || !this.stream) return;

    const video = this.getVideoElement();
    video.srcObject = this.stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    try {
      await video.play();
    } catch (error) {
      const message =
        error instanceof DOMException
          ? error.name
          : error instanceof Error
            ? error.message
            : "VIDEO_PLAY_FAILED";

      this.setState({
        status: "error",
        error: message,
      });

      throw error;
    }

    this.setState({
      status: "active",
      microphoneEnabled: this.hasLiveMicrophone(),
      ...this.readVideoSettings(),
      error: null,
    });
  }

  stop(): void {
    ++this.requestToken;
    this.stopStream(this.stream);
    this.stream = null;

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }

    this.setState({
      status: "stopped",
      microphoneEnabled: false,
      width: 0,
      height: 0,
      frameRate: 0,
      error: null,
    });
  }

  async switchCamera(): Promise<void> {
    if (!this.stream) return;

    const currentTrack = this.stream.getVideoTracks()[0];
    if (!currentTrack || currentTrack.readyState !== "live") return;

    const previousFacing = this.state.facingMode;
    const previousStatus = this.state.status;
    const nextFacing: CameraFacingMode =
      previousFacing === "user" ? "environment" : "user";

    const devices = await this.refreshDevices();
    const preferred = this.deviceManager.prefer(nextFacing, devices);
    const previousStream = this.stream;
    const token = ++this.requestToken;

    this.setState({
      status: "requesting",
      error: null,
    });

    try {
      const stream = await this.openStream(
        nextFacing,
        preferred?.deviceId,
        true,
      );

      if (token !== this.requestToken || this.destroyed) {
        this.stopStream(stream);
        return;
      }

      const actualFacing = this.readFacingMode(stream) ?? nextFacing;
      if (actualFacing !== nextFacing) {
        this.stopStream(stream);
        throw new Error("CAMERA_FACING_UNAVAILABLE");
      }

      const video = this.getVideoElement();
      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      await video.play();

      if (token !== this.requestToken || this.destroyed) {
        this.stopStream(stream);
        return;
      }

      this.stopStream(previousStream);
      this.stream = stream;
      this.bindTrackLifecycle(stream);

      this.setState({
        status: "active",
        facingMode: actualFacing,
        microphoneEnabled: this.hasLiveMicrophone(),
        ...this.readVideoSettings(),
        error: null,
      });
    } catch {
      this.setState({
        status: previousStatus,
        facingMode: previousFacing,
        error: null,
      });
    }
  }

  getState(): CameraState {
    return this.state;
  }

  getVideoElement(): HTMLVideoElement {
    if (this.video) return this.video;

    if (typeof document === "undefined") {
      throw new Error("CAMERA_VIDEO_ELEMENT_UNAVAILABLE");
    }

    this.video = document.createElement("video");
    this.video.setAttribute("aria-hidden", "true");
    this.video.setAttribute("playsinline", "");
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
    return this.video;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

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
    this.destroyed = true;
    this.stop();
    this.listeners.clear();
    this.video = null;
  }

  private async openStream(
    facingMode: CameraFacingMode,
    preferredDeviceId?: string,
    strictFacing = false,
  ): Promise<MediaStream> {
    const facingConstraint: ConstrainDOMString = strictFacing
      ? { exact: facingMode }
      : { ideal: facingMode };

    const constraints: MediaStreamConstraints[] = [];

    if (preferredDeviceId) {
      constraints.push({
        video: {
          ...VIDEO_PREFERENCES,
          deviceId: { exact: preferredDeviceId },
          facingMode: facingConstraint,
        },
        audio: this.audioConstraints(),
      });
    }

    constraints.push({
      video: {
        ...VIDEO_PREFERENCES,
        facingMode: facingConstraint,
      },
      audio: this.audioConstraints(),
    });

    constraints.push({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60, max: 60 },
        facingMode: facingConstraint,
      },
      audio: this.audioConstraints(),
    });

    constraints.push({
      video: { facingMode: facingConstraint },
      audio: this.audioConstraints(),
    });

    let lastError: unknown = new Error("CAMERA_UNAVAILABLE");

    for (const request of constraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(request);
      } catch (error) {
        lastError = error;

        if (
          error instanceof DOMException &&
          error.name === "NotAllowedError"
        ) {
          throw error;
        }
      }
    }

    if (strictFacing) {
      throw lastError instanceof Error
        ? lastError
        : new Error("CAMERA_UNAVAILABLE");
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: this.audioConstraints(),
      });
    } catch (error) {
      lastError = error;
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    } catch (error) {
      lastError = error;
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("CAMERA_UNAVAILABLE");
  }

  private audioConstraints(): MediaTrackConstraints {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
  }

  private replaceStream(stream: MediaStream): void {
    this.stopStream(this.stream);
    this.stream = stream;
    this.bindTrackLifecycle(stream);
    this.applyStreamState();
  }

  private bindTrackLifecycle(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (this.destroyed || this.stream !== stream) return;

        const hasLiveVideo = stream
          .getVideoTracks()
          .some((videoTrack) => videoTrack.readyState === "live");

        if (!hasLiveVideo) {
          this.setState({
            status: "error",
            error: "CAMERA_TRACK_ENDED",
          });
          return;
        }

        this.applyStreamState();
      };
    });
  }

  private applyStreamState(): void {
    this.setState({
      microphoneEnabled: this.hasLiveMicrophone(),
      ...this.readVideoSettings(),
    });
  }

  private readFacingMode(
    stream: MediaStream,
  ): CameraFacingMode | undefined {
    const value = stream.getVideoTracks()[0]?.getSettings().facingMode;
    return value === "user" || value === "environment" ? value : undefined;
  }

  private readVideoSettings(): Pick<
    CameraState,
    "width" | "height" | "frameRate" | "deviceId"
  > {
    const track = this.stream?.getVideoTracks()[0];

    if (!track) {
      return {
        width: 0,
        height: 0,
        frameRate: 0,
      };
    }

    const settings = track.getSettings();

    const result: Pick<CameraState, "width" | "height" | "frameRate" | "deviceId"> = {
      width: Math.round(settings.width ?? 0),
      height: Math.round(settings.height ?? 0),
      frameRate: Math.round(settings.frameRate ?? 0),
    };

    if (settings.deviceId !== undefined) {
      result.deviceId = settings.deviceId;
    }

    return result;
  }

  private hasLiveMicrophone(): boolean {
    return Boolean(
      this.stream?.getAudioTracks().some(
        (track) => track.readyState === "live" && track.enabled,
      ),
    );
  }

  private stopStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  }

  private setState(patch: Partial<CameraState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
