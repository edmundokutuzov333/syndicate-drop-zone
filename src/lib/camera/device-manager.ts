import { type CameraDevice, type CameraFacingMode } from "./types";

export class DeviceManager {
  async enumerate(): Promise<CameraDevice[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput").map((device) => ({
      deviceId: device.deviceId,
      label: device.label || "CAMERA INPUT",
      groupId: device.groupId || undefined,
      facingMode: this.inferFacingMode(device.label),
    }));
  }

  prefer(facingMode: CameraFacingMode, devices: CameraDevice[]): CameraDevice | undefined {
    return devices.find((device) => device.facingMode === facingMode) ?? devices[0];
  }

  private inferFacingMode(label: string): CameraFacingMode | undefined {
    const normalized = label.toLowerCase();
    if (/(front|user|facetime|integrated|built-in)/.test(normalized)) return "user";
    if (/(back|rear|environment|ultra|wide)/.test(normalized)) return "environment";
    return undefined;
  }
}
