import { chromium, expect, test } from "@playwright/test";
import { stat } from "node:fs/promises";
import sharp from "sharp";

test("camera requests media access, renders live frames, downloads photos and plays recordings", async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      permissions: ["camera", "microphone"],
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("sdt-open", "1");
      } catch {
        // The camera assertions below will fail clearly if the gate cannot open.
      }

      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) return;

      const audit = { requests: [] as Array<{ video: boolean; audio: boolean }>, denyCameraRequests: true };
      Object.defineProperty(window, "__cameraPermissionAudit", {
        configurable: false,
        value: audit,
      });

      const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.getUserMedia = (constraints: MediaStreamConstraints) => {
        audit.requests.push({
          video: Boolean(constraints.video),
          audio: Boolean(constraints.audio),
        });
        if (constraints.video && audit.denyCameraRequests) {
          return Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
        }
        return originalGetUserMedia(constraints);
      };
    });

    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("http://127.0.0.1:4173/camera", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".camera-surface")).toBeVisible({ timeout: 20_000 });

    // The first request is denied to validate the permission error state and retry action.
    await expect(page.getByText("PERMISSION BLOCKED", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => {
      const audit = (window as Window & {
        __cameraPermissionAudit?: { denyCameraRequests: boolean };
      }).__cameraPermissionAudit;
      if (audit) audit.denyCameraRequests = false;
    });
    await page.getByRole("button", { name: "ALLOW", exact: true }).click();

    // Confirm the retry requests camera access again and receives a live video track.
    await expect.poll(async () => page.evaluate(() => {
      const audit = (window as Window & {
        __cameraPermissionAudit?: { requests: Array<{ video: boolean; audio: boolean }> };
      }).__cameraPermissionAudit;
      return audit?.requests.filter((request) => request.video).length ?? 0;
    }), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);

    const liveVideo = page.locator("video.camera-native-video");
    await expect(liveVideo).toBeAttached({ timeout: 20_000 });
    await expect.poll(() => liveVideo.evaluate((node) => {
      const video = node as HTMLVideoElement;
      const stream = video.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      return Boolean(
        stream &&
        track?.readyState === "live" &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0,
      );
    }), { timeout: 30_000 }).toBe(true);

    const liveFrame = await liveVideo.evaluate((node) => {
      const video = node as HTMLVideoElement;
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        currentTime: video.currentTime,
        trackState: (video.srcObject as MediaStream).getVideoTracks()[0]?.readyState,
      };
    });
    expect(liveFrame.width).toBeGreaterThan(0);
    expect(liveFrame.height).toBeGreaterThan(0);
    expect(liveFrame.trackState).toBe("live");
    const cameraCanvas = page.locator("canvas.camera-canvas");
    await expect(cameraCanvas).toBeVisible();
    const renderedFrame = await cameraCanvas.screenshot();
    const framePixels = await sharp(renderedFrame)
      .resize(32, 32)
      .removeAlpha()
      .raw()
      .toBuffer();
    const uniqueColors = new Set<string>();
    let totalLuminance = 0;
    for (let index = 0; index < framePixels.length; index += 3) {
      const red = framePixels[index];
      const green = framePixels[index + 1];
      const blue = framePixels[index + 2];
      uniqueColors.add(`${red},${green},${blue}`);
      totalLuminance += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }
    expect(uniqueColors.size, "The rendered camera canvas should contain real image detail").toBeGreaterThan(8);
    expect(totalLuminance / (framePixels.length / 3), "The rendered camera canvas should not be blank or black").toBeGreaterThan(5);

    // A live source must advance, rather than merely leaving a video element attached.
    await expect.poll(() => liveVideo.evaluate((node) => (node as HTMLVideoElement).currentTime), {
      timeout: 10_000,
    }).toBeGreaterThan(liveFrame.currentTime);

    // Capture a real photo from the WebGL canvas, confirm its preview, then download it.
    const photoButton = page.getByRole("button", { name: "Capturar fotografia" });
    await expect(photoButton).toBeEnabled({ timeout: 20_000 });
    await photoButton.click();
    const preview = page.getByRole("dialog", { name: "Resultado da captura" });
    await expect(preview).toBeVisible({ timeout: 30_000 });

    const photo = preview.locator("img[alt='Pré-visualização da fotografia capturada']");
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((node) => {
      const image = node as HTMLImageElement;
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    }), { timeout: 15_000 }).toBe(true);

    const photoDownloadPromise = page.waitForEvent("download");
    await preview.getByRole("link", { name: "DOWNLOAD" }).click();
    const photoDownload = await photoDownloadPromise;
    expect(photoDownload.suggestedFilename()).toMatch(/\.(jpg|png)$/i);
    const photoPath = await photoDownload.path();
    expect(photoPath).toBeTruthy();
    expect((await stat(photoPath!)).size).toBeGreaterThan(1_000);

    await preview.getByRole("button", { name: "NEW CAPTURE" }).click();
    await expect(preview).toBeHidden();

    // Record for long enough to produce media data, stop, and verify actual playback.
    await page.getByRole("button", { name: "VIDEO", exact: true }).click();
    const recordButton = page.getByRole("button", { name: "Iniciar gravação" });
    await expect(recordButton).toBeEnabled({ timeout: 10_000 });
    await recordButton.click();
    const stopButton = page.getByRole("button", { name: "Parar gravação" });
    await expect(stopButton).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    await stopButton.click();

    await expect(preview).toBeVisible({ timeout: 30_000 });
    const recordedVideo = preview.locator("video[aria-label='Pré-visualização do vídeo capturado']");
    await expect(recordedVideo).toBeVisible();
    await expect.poll(() => recordedVideo.evaluate((node) => {
      const video = node as HTMLVideoElement;
      return video.readyState >= HTMLMediaElement.HAVE_METADATA &&
        Number.isFinite(video.duration) &&
        video.duration > 0 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0;
    }), { timeout: 20_000 }).toBe(true);

    const playbackStartedAt = await recordedVideo.evaluate(async (node) => {
      const video = node as HTMLVideoElement;
      video.currentTime = 0;
      await video.play();
      return video.currentTime;
    });
    await page.waitForTimeout(500);
    const playbackAfter = await recordedVideo.evaluate((node) => (node as HTMLVideoElement).currentTime);
    expect(playbackAfter).toBeGreaterThan(playbackStartedAt);

    const videoDownloadPromise = page.waitForEvent("download");
    await preview.getByRole("link", { name: "DOWNLOAD" }).click();
    const videoDownload = await videoDownloadPromise;
    expect(videoDownload.suggestedFilename()).toMatch(/\.(webm|mp4|mov|mkv)$/i);
    const videoPath = await videoDownload.path();
    expect(videoPath).toBeTruthy();
    expect((await stat(videoPath!)).size).toBeGreaterThan(1_000);

    expect(pageErrors, "The camera flow should not produce uncaught browser errors").toEqual([]);
    await context.close();
  } finally {
    await browser.close();
  }
});
