import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import ffmpegPath from "ffmpeg-static";
import { afterAll, describe, expect, it } from "vitest";
import fanVideoHandler from "../../api/fan-video";

const directory = await mkdtemp(join(tmpdir(), "sdt-fan-video-api-test-"));
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

function runFfmpeg(args: string[]): Promise<void> {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary for the API integration test.");
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("The integration fixture encoder timed out."));
    }, 15_000);
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-5_000); });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error("Could not create a valid JPEG fixture: " + stderr));
    });
  });
}

describe("API real de renderização do cartão de fã", () => {
  it("renderiza um MP4 real de 30 segundos com fotografia, faixa de áudio e waveform", async () => {
    const jpegPath = join(directory, "integration-card.jpg");
    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-f", "lavfi", "-i", "color=c=0x222222:s=540x960:d=1",
      "-frames:v", "1", "-q:v", "2", jpegPath,
    ]);
    const jpeg = await readFile(jpegPath);
    expect(jpeg[0]).toBe(0xff);
    expect(jpeg[1]).toBe(0xd8);

    const headers: Record<string, string> = {};
    let resultBody: unknown;
    const response = {
      statusCode: 200,
      writableEnded: false,
      setHeader(name: string, value: string | number) {
        headers[name.toLowerCase()] = String(value);
        return this;
      },
      end(body?: unknown) {
        resultBody = body;
        this.writableEnded = true;
        return this;
      },
    } as unknown as ServerResponse<IncomingMessage>;

    const request = {
      method: "POST",
      headers: {
        origin: "https://fan-video.integration.test",
        host: "fan-video.integration.test",
        "x-real-ip": "203.0.113.243",
        "x-request-id": "integration-fan-video-001",
      },
      socket: { remoteAddress: "203.0.113.243" },
      body: {
        trackId: "T1",
        imageData: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      },
    } as unknown as IncomingMessage & { body?: unknown };

    await fanVideoHandler(request, response);

    const responseText = Buffer.isBuffer(resultBody)
      ? resultBody.toString("utf8")
      : typeof resultBody === "string" ? resultBody : "";
    expect(
      response.statusCode,
      response.statusCode === 200 ? "" : `Endpoint failed: ${responseText}`,
    ).toBe(200);
    expect(headers["content-type"]).toBe("video/mp4");
    expect(headers["x-request-id"]).toBe("integration-fan-video-001");
    expect(Buffer.isBuffer(resultBody)).toBe(true);
    const video = resultBody as Buffer;
    expect(video.length).toBeGreaterThan(30_000);
    expect(video.toString("ascii", 4, 8)).toBe("ftyp");
    expect(headers["content-length"]).toBe(String(video.length));
  }, 70_000);
});
