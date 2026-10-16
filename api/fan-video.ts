import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import ffmpegPath from "ffmpeg-static";

type VideoTrackId = "T1" | "T2" | "T3";
type VideoRequest = { trackId?: unknown; imageData?: unknown };
type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse<IncomingMessage>;

class FanVideoError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "FanVideoError";
  }
}

const DURATION_SECONDS = 30;
const RENDER_TIMEOUT_MS = 52_000;
const MAX_CONCURRENT_RENDERS = 2;
const MAX_IMAGE_DATA_LENGTH = 4_000_000;
const MAX_OUTPUT_BYTES = 4_300_000;
let activeRenders = 0;

const TRACK_AUDIO: Record<VideoTrackId, string> = {
  // The original T1 filename was removed from the public asset bundle. Keep
  // T1 playable with the published Phantom master instead of returning a 503
  // for the fan-video flow; the track ID remains stable for clients.
  T1: "PHANTOM Mode 2 - The Final Movie W_ INF8M8US, HEYYG, KINGSTON SIRIRO.mp3",
  T2: "PHANTOM Mode 2 - The Final Movie W_ INF8M8US, HEYYG, KINGSTON SIRIRO.mp3",
  T3: "(Unmastered) PHANTOM, Kingston Siriro, Elton Penicela - Fashion de Phantom.mp3",
};

function respondJson(response: ApiResponse, status: number, payload: Record<string, unknown>): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function isTrackId(value: unknown): value is VideoTrackId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TRACK_AUDIO, value);
}

function getRequestId(request: ApiRequest): string {
  const supplied = request.headers["x-request-id"];
  if (typeof supplied === "string" && /^[A-Za-z0-9-]{8,80}$/.test(supplied)) return supplied;
  return randomUUID();
}

async function resolveTrackAudio(trackId: VideoTrackId): Promise<string> {
  const directory = resolve(process.cwd(), "public", "audio");
  let filenames: string[];
  try {
    filenames = await readdir(directory);
  } catch {
    throw new FanVideoError(
      "AUDIO_DIRECTORY_MISSING",
      "A faixa de áudio não está disponível no servidor. O problema foi registado.",
      503,
    );
  }

  // Filesystems may preserve accented filenames as NFC or NFD. Match both forms.
  const expected = TRACK_AUDIO[trackId].normalize("NFC");
  const filename = filenames.find((entry) => entry.normalize("NFC") === expected);
  if (!filename) {
    throw new FanVideoError(
      "AUDIO_ASSET_MISSING",
      "A faixa seleccionada não foi incluída no servidor de vídeo. O problema foi registado.",
      503,
    );
  }

  const audioPath = join(directory, filename);
  try {
    await access(audioPath);
  } catch {
    throw new FanVideoError(
      "AUDIO_ASSET_MISSING",
      "A faixa seleccionada não está acessível no servidor. O problema foi registado.",
      503,
    );
  }
  return audioPath;
}

function readRequestBody(request: ApiRequest): VideoRequest | null {
  if (request.body && typeof request.body === "object") return request.body as VideoRequest;
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body) as VideoRequest; } catch { return null; }
  }
  return null;
}

function getClientAddress(request: ApiRequest): string {
  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",").at(-1)?.trim() || "unknown";
  }
  return request.socket.remoteAddress || "unknown";
}

const requestHistory = new Map<string, number[]>();

function isRateLimited(address: string): boolean {
  const now = Date.now();
  const threshold = now - 10 * 60 * 1000;
  const recent = (requestHistory.get(address) ?? []).filter((timestamp) => timestamp > threshold);
  if (recent.length >= 8) {
    requestHistory.set(address, recent);
    return true;
  }
  recent.push(now);
  requestHistory.set(address, recent);

  if (requestHistory.size > 1500) {
    for (const [key, timestamps] of requestHistory) {
      if (timestamps.every((timestamp) => timestamp <= threshold)) requestHistory.delete(key);
    }
  }
  return false;
}

function runFfmpeg(args: string[], requestId: string): Promise<void> {
  if (!ffmpegPath) return Promise.reject(new FanVideoError(
    "ENCODER_UNAVAILABLE",
    "O encoder nativo de vídeo não está disponível neste servidor.",
    503,
  ));

  return new Promise((resolvePromise, rejectPromise) => {
    const process = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      process.kill("SIGKILL");
      rejectPromise(new FanVideoError(
        "RENDER_TIMEOUT",
        "A renderização ultrapassou o tempo permitido. Tenta novamente.",
        504,
      ));
    }, RENDER_TIMEOUT_MS);
    timer.unref?.();

    process.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-12_000);
    });
    process.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.error(`[fan-video:${requestId}] phase=spawn code=${error.code ?? "UNKNOWN"} message=${error.message}`);
      rejectPromise(new FanVideoError(
        error.code === "ENOENT" ? "ENCODER_BINARY_MISSING" : "ENCODER_START_FAILED",
        error.code === "ENOENT"
          ? "O binário do encoder não foi incluído no deployment. O problema foi registado."
          : "O motor nativo de vídeo não conseguiu arrancar.",
        error.code === "ENOENT" ? 503 : 500,
      ));
    });
    process.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolvePromise();
        return;
      }
      console.error(`[fan-video:${requestId}] phase=encode exitCode=${code} stderr=${stderr}`);
      if (/Unknown encoder|Encoder .* not found/i.test(stderr)) {
        rejectPromise(new FanVideoError(
          "ENCODER_UNSUPPORTED",
          "O servidor não tem o encoder de vídeo necessário. O problema foi registado.",
          503,
        ));
      } else {
        rejectPromise(new FanVideoError(
          "RENDER_FAILED",
          "O servidor não conseguiu concluir o vídeo. Tenta novamente.",
          500,
        ));
      }
    });
  });
}

export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
};

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  let phase = "validate";
  response.setHeader("X-Request-Id", requestId);

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respondJson(response, 405, { code: "METHOD_NOT_ALLOWED", error: "Este endpoint aceita apenas pedidos POST." });
    return;
  }

  const origin = request.headers.origin;
  const host = request.headers.host;
  if (typeof origin === "string" && host) {
    try {
      if (new URL(origin).host !== host) {
        respondJson(response, 403, { code: "ORIGIN_NOT_ALLOWED", error: "Origem do pedido não autorizada." });
        return;
      }
    } catch {
      respondJson(response, 403, { code: "ORIGIN_NOT_ALLOWED", error: "Origem do pedido inválida." });
      return;
    }
  }

  const payload = readRequestBody(request);
  if (!payload || !isTrackId(payload.trackId)) {
    respondJson(response, 400, { code: "INVALID_TRACK", error: "Escolhe uma das músicas disponíveis." });
    return;
  }

  if (typeof payload.imageData !== "string" || payload.imageData.length > MAX_IMAGE_DATA_LENGTH) {
    respondJson(response, 413, { code: "IMAGE_TOO_LARGE", error: "A fotografia é demasiado grande. Usa uma imagem mais leve e tenta novamente." });
    return;
  }

  const dataUrlMatch = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(payload.imageData);
  if (!dataUrlMatch?.[1]) {
    respondJson(response, 400, { code: "INVALID_IMAGE", error: "A imagem do cartão é inválida. Selecciona a fotografia novamente." });
    return;
  }

  const imageBytes = Buffer.from(dataUrlMatch[1], "base64");
  if (imageBytes.length < 4 || imageBytes[0] !== 0xff || imageBytes[1] !== 0xd8 || imageBytes[2] !== 0xff) {
    respondJson(response, 400, { code: "INVALID_IMAGE", error: "A imagem recebida não é um JPEG válido." });
    return;
  }

  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    response.setHeader("Retry-After", "8");
    respondJson(response, 429, { code: "RENDER_BUSY", error: "O motor está a renderizar outros vídeos. Espera alguns segundos e tenta novamente." });
    return;
  }

  if (isRateLimited(getClientAddress(request))) {
    response.setHeader("Retry-After", "600");
    respondJson(response, 429, { code: "RATE_LIMITED", error: "Atingiste o limite temporário de vídeos. Tenta novamente daqui a alguns minutos." });
    return;
  }

  activeRenders += 1;
  let workDirectory = "";
  try {
    phase = "resolve-audio";
    const audioPath = await resolveTrackAudio(payload.trackId);

    phase = "prepare-files";
    if (!ffmpegPath) {
      throw new FanVideoError("ENCODER_UNAVAILABLE", "O encoder nativo não está instalado.", 503);
    }
    try {
      await access(ffmpegPath);
    } catch {
      throw new FanVideoError("ENCODER_BINARY_MISSING", "O binário do encoder não foi incluído no deployment.", 503);
    }

    workDirectory = await mkdtemp(join(tmpdir(), "sdt-fan-video-"));
    const imagePath = join(workDirectory, "fan-card.jpg");
    const outputPath = join(workDirectory, "fan-video.mp4");
    await writeFile(imagePath, imageBytes, { flag: "wx" });

    const filter = [
      "[0:v]scale=1080:1920:flags=fast_bilinear,setsar=1,drawbox=x=68:y=1378:w=944:h=250:color=black@1:t=fill,drawbox=x=68:y=1378:w=944:h=250:color=0xC62828@1:t=4[base]",
      "[1:a]atrim=start=0:duration=30,asetpts=PTS-STARTPTS,showwaves=s=900x220:mode=cline:rate=30:colors=0xE63946[waves]",
      "[base][waves]overlay=90:1393:shortest=1[outv]",
    ].join(";");
    const args = [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-loop", "1", "-framerate", "30", "-i", imagePath,
      "-stream_loop", "-1", "-i", audioPath,
      "-filter_complex", filter,
      "-map", "[outv]", "-map", "1:a:0",
      "-t", String(DURATION_SECONDS), "-r", "30",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
      "-maxrate", "550k", "-bufsize", "1100k", "-threads", "2",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
      "-movflags", "+faststart", "-f", "mp4", outputPath,
    ];

    phase = "render";
    await runFfmpeg(args, requestId);
    phase = "validate-output";
    const video = await readFile(outputPath);
    if (video.byteLength < 12 || video.byteLength > MAX_OUTPUT_BYTES
        || video.toString("ascii", 4, 8) !== "ftyp") {
      throw new FanVideoError("INVALID_OUTPUT", "O servidor gerou um ficheiro MP4 inválido. Tenta novamente.", 500);
    }

    console.info(`[fan-video:${requestId}] success track=${payload.trackId} bytes=${video.byteLength} elapsedMs=${Date.now() - startedAt}`);
    response.statusCode = 200;
    response.setHeader("Content-Type", "video/mp4");
    response.setHeader("Content-Length", String(video.byteLength));
    response.setHeader("Content-Disposition", 'attachment; filename="sindicato-cartao-fa.mp4"');
    response.setHeader("Cache-Control", "no-store, private");
    response.end(video);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const failure = error instanceof FanVideoError
      ? error
      : new FanVideoError(
        "RENDER_FAILED",
        "Não foi possível concluir a renderização. O PNG continua disponível.",
        500,
      );
    console.error(
      `[fan-video:${requestId}] failed phase=${phase} code=${failure.code} elapsedMs=${Date.now() - startedAt} message=${message}`,
    );
    if (!response.writableEnded) respondJson(response, failure.statusCode, {
      code: failure.code,
      error: failure.message,
      requestId,
    });
  } finally {
    activeRenders = Math.max(0, activeRenders - 1);
    if (workDirectory) {
      try { await rm(workDirectory, { recursive: true, force: true }); } catch (error) {
        console.error("[fan-video] Falha ao limpar ficheiros temporários:", error);
      }
    }
  }
}
