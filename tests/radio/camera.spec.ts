import { chromium, expect, test } from "@playwright/test";
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

    // The photo/video control must be obvious, accessible and stateful.
    const modeGroup = page.getByRole("group", { name: "Modo de captura" });
    const photoMode = page.getByRole("button", { name: "Modo fotografia" });
    const videoMode = page.getByRole("button", { name: "Modo vídeo" });
    await expect(modeGroup).toBeVisible();
    await expect(photoMode).toHaveAttribute("aria-pressed", "true");
    await expect(videoMode).toHaveAttribute("aria-pressed", "false");
    await videoMode.click();
    await expect(videoMode).toHaveAttribute("aria-pressed", "true");
    await expect(photoMode).toHaveAttribute("aria-pressed", "false");
    await photoMode.click();
    await expect(photoMode).toHaveAttribute("aria-pressed", "true");

    // Drag the filter panel into all four viewport corners, then test minimize/restore.
    const filterPanel = page.locator(".camera-filter-tuning.is-floating");
    await expect(filterPanel).toBeVisible({ timeout: 15_000 });
    const filterGrip = page.locator(".camera-filter-drag-grip");
    const corners = [
      { x: 10, y: 10, horizontal: "left", vertical: "top" },
      { x: 1430, y: 10, horizontal: "right", vertical: "top" },
      { x: 1430, y: 990, horizontal: "right", vertical: "bottom" },
      { x: 10, y: 990, horizontal: "left", vertical: "bottom" },
    ] as const;

    for (const corner of corners) {
      const gripBox = await filterGrip.boundingBox();
      expect(gripBox, "The filter panel drag grip must be on screen").not.toBeNull();
      await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + gripBox!.height / 2);
      await page.mouse.down();
      await page.mouse.move(corner.x, corner.y, { steps: 12 });
      await page.mouse.up();

      await expect.poll(async () => {
        const box = await filterPanel.boundingBox();
        if (!box) return false;
        const withinViewport =
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= 1441 &&
          box.y + box.height <= 1001;
        if (!withinViewport) return false;
        if (corner.horizontal === "left" && box.x > 12) return false;
        if (corner.horizontal === "right" && box.x + box.width < 1424) return false;
        if (corner.vertical === "top" && box.y > 12) return false;
        if (corner.vertical === "bottom" && box.y + box.height < 984) return false;
        return true;
      }, { timeout: 5_000 }).toBe(true);
    }

    await page.getByRole("button", { name: "Minimizar painel de ajustes" }).click();
    await expect(filterPanel).toHaveCount(0);
    const restorePanel = page.getByRole("button", { name: /Reabrir painel de ajustes do filtro/ });
    await expect(restorePanel).toBeVisible();
    await restorePanel.click();
    await expect(filterPanel).toBeVisible();
    // Keep the panel out of the capture controls for the photo/video checks below.
    const gripBox = await filterGrip.boundingBox();
    expect(gripBox).not.toBeNull();
    await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + gripBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(10, 10, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await filterPanel.boundingBox())?.x ?? 999).toBeLessThanOrEqual(12);

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

    const photoDownloadLink = preview.getByRole("link", { name: "DOWNLOAD" });
    await expect(photoDownloadLink).toHaveAttribute("download", /\.(jpg|png)$/i);
    const photoPayload = await photoDownloadLink.evaluate(async (node) => {
      const link = node as HTMLAnchorElement;
      const response = await fetch(link.href);
      const blob = await response.blob();
      return {
        filename: link.download,
        size: blob.size,
        mimeType: blob.type,
        ok: response.ok,
      };
    });
    expect(photoPayload.ok).toBe(true);
    expect(photoPayload.filename).toMatch(/\.(jpg|png)$/i);
    expect(photoPayload.mimeType).toMatch(/^image\/(jpeg|png)$/i);
    expect(photoPayload.size).toBeGreaterThan(1_000);

    await preview.getByRole("button", { name: "NEW CAPTURE" }).click();
    await expect(preview).toBeHidden();

    // Record for long enough to produce media data, stop, and verify actual playback.
    await page.getByRole("button", { name: "Modo vídeo" }).click();
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

    const videoDownloadLink = preview.getByRole("link", { name: "DOWNLOAD" });
    await expect(videoDownloadLink).toHaveAttribute("download", /\.(webm|mp4|mov|mkv)$/i);
    const videoPayload = await videoDownloadLink.evaluate(async (node) => {
      const link = node as HTMLAnchorElement;
      const response = await fetch(link.href);
      const blob = await response.blob();
      return {
        filename: link.download,
        size: blob.size,
        mimeType: blob.type,
        ok: response.ok,
      };
    });
    expect(videoPayload.ok).toBe(true);
    expect(videoPayload.filename).toMatch(/\.(webm|mp4|mov|mkv)$/i);
    expect(videoPayload.mimeType).toMatch(/^video\//i);
    expect(videoPayload.size).toBeGreaterThan(1_000);

    expect(pageErrors, "The camera flow should not produce uncaught browser errors").toEqual([]);
    await context.close();
  } finally {
    await browser.close();
  }
});

test("entering camera stops the radio and hides its bottom player only on that route", async () => {
  test.setTimeout(90_000);
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
      permissions: ["camera", "microphone"],
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(() => {
      sessionStorage.setItem("sdt-open", "1");
      Object.defineProperty(window, "__sdtMediaPauseCount", {
        configurable: false,
        writable: true,
        value: 0,
      });
      const nativePause = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause = function () {
        (window as Window & { __sdtMediaPauseCount: number }).__sdtMediaPauseCount += 1;
        return nativePause.call(this);
      };
    });

    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("http://127.0.0.1:4173/frequencia", { waitUntil: "domcontentloaded" });

    const radioAction = page.locator("main").getByRole("button", { name: /^(SINTONIZAR|RETOMAR|PAUSAR)$/ });
    await expect(radioAction).toBeVisible({ timeout: 20_000 });
    const currentAction = (await radioAction.innerText()).trim().toUpperCase();
    if (currentAction === "SINTONIZAR" || currentAction === "RETOMAR") {
      await radioAction.click();
    }
    await expect(radioAction).toHaveText(/PAUSAR/, { timeout: 20_000 });
    await expect(page.getByRole("region", { name: "Frequência 808" })).toBeVisible({ timeout: 20_000 });

    const pauseCountBefore = await page.evaluate(
      () => (window as Window & { __sdtMediaPauseCount: number }).__sdtMediaPauseCount,
    );
    await page.getByRole("link", { name: /CAMERA/i }).click();
    await expect(page.locator(".camera-surface")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("region", { name: "Frequência 808" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Leitor de fitas" })).toHaveCount(0);
    await expect.poll(() => page.evaluate(
      () => (window as Window & { __sdtMediaPauseCount: number }).__sdtMediaPauseCount,
    ), { timeout: 10_000 }).toBeGreaterThan(pauseCountBefore);

    // Leaving the camera route makes the site radio/player available again.
    await page.goBack();
    await expect(page).toHaveURL(/\/frequencia$/);
    await expect(page.getByRole("region", { name: "Frequência 808" })).toBeVisible({ timeout: 30_000 });
    expect(pageErrors, "Route transitions should not create uncaught browser errors").toEqual([]);
    await context.close();
  } finally {
    await browser.close();
  }
});
