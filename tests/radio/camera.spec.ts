import { chromium, expect, test } from "@playwright/test";
import { stat } from "node:fs/promises";

test("camera requests media access, renders live frames, downloads photos and plays recordings", async () => {
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

      const audit = { requests: [] as Array<{ video: boolean; audio: boolean }> };
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
        return originalGetUserMedia(constraints);
      };
    });

    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("http://127.0.0.1:4173/camera", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".camera-surface")).toBeVisible({ timeout: 20_000 });

    // Confirm the application actually requests camera access and receives a live video track.
    await expect.poll(async () => page.evaluate(() => {
      const audit = (window as Window & {
        __cameraPermissionAudit?: { requests: Array<{ video: boolean; audio: boolean }> };
      }).__cameraPermissionAudit;
      return audit?.requests.some((request) => request.video) ?? false;
    }), { timeout: 20_000 }).toBe(true);

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
    await expect(page.locator("canvas.camera-canvas")).toBeVisible();

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
