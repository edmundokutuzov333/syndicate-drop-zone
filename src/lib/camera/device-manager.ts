import { type CameraDevice, type CameraFacingMode } from "./types";

export class DeviceManager {
  async enumerate(): Promise<CameraDevice[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];

    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "CAMERA INPUT",
        groupId: device.groupId || undefined,
        facingMode: this.classify(device.label),
      }));
  }

  prefer(facingMode: CameraFacingMode, devices: CameraDevice[]): CameraDevice | undefined {
    return devices.find((device) => device.facingMode === facingMode);
  }

  hasFacingMode(facingMode: CameraFacingMode, devices: CameraDevice[]): boolean {
    return devices.some((device) => device.facingMode === facingMode);
  }

  private classify(label: string): CameraFacingMode | undefined {
    const value = label.toLowerCase();

    if (/(front|user|facetime|integrated|built-in|internal|webcam)/.test(value)) {
      return "user";
    }

    if (/(back|rear|environment|ultra|wide|main camera)/.test(value)) {
      return "environment";
    }

    return undefined;
  }
}
