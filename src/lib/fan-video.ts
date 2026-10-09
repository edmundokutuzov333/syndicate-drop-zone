export type FanVideoTrackId = "T1" | "T2" | "T3";
export type VideoProgress = (percentage: number) => void;

export const FAN_VIDEO_SPEC = { durationSeconds: 30, width: 1080, height: 1920, fps: 30 } as const;

const ALLOWED_TRACKS: readonly FanVideoTrackId[] = ["T1", "T2", "T3"];
const MAX_IMAGE_DATA_LENGTH = 4_000_000;

type VideoErrorPayload = { error?: unknown; code?: unknown; requestId?: unknown };

function createRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through for browsers without a usable crypto implementation.
  }
  return `fan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isMp4(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 12
    && String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp";
}

export async function createFanVideo(
  cardCanvas: HTMLCanvasElement,
  trackId: FanVideoTrackId,
  onProgress: VideoProgress = () => undefined,
): Promise<Blob> {
  if (!ALLOWED_TRACKS.includes(trackId)) {
    throw new Error("Escolhe uma das músicas disponíveis para criar o vídeo.");
  }

  let imageData: string;
  try {
    imageData = cardCanvas.toDataURL("image/jpeg", 0.9);
  } catch {
    throw new Error("Não foi possível preparar a fotografia do cartão. Selecciona novamente a imagem.");
  }

  if (!imageData.startsWith("data:image/jpeg;base64,") || imageData.length > MAX_IMAGE_DATA_LENGTH) {
    throw new Error("A fotografia é demasiado grande para criar o vídeo. Usa uma imagem mais leve.");
  }

  const controller = new AbortController();
  const requestId = createRequestId();
  const timeout = window.setTimeout(() => controller.abort(), 55_000);
  onProgress(8);

  try {
    let response: Response;
    try {
      response = await fetch("/api/fan-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "video/mp4, application/json",
          "X-Request-Id": requestId,
        },
        body: JSON.stringify({ trackId, imageData }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new Error("A renderização demorou demasiado. Tenta novamente com uma fotografia mais leve.");
      }
      throw new Error("Não foi possível contactar o motor de vídeo no servidor. Verifica a ligação e tenta novamente.");
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as VideoErrorPayload | null;
      const message = typeof payload?.error === "string" ? payload.error.trim() : "";
      const responseId = response.headers.get("x-request-id")
        || (typeof payload?.requestId === "string" ? payload.requestId : "")
        || requestId;
      const reason = message || `O motor de vídeo respondeu com erro HTTP ${response.status}.`;
      throw new Error(`${reason} Referência: ${responseId}.`);
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "video/mp4") {
      throw new Error("O servidor não devolveu um ficheiro MP4 válido. Tenta novamente.");
    }

    onProgress(85);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!isMp4(bytes)) {
      throw new Error("O ficheiro recebido não é um vídeo MP4 válido. Tenta novamente.");
    }

    const blob = new Blob([bytes], { type: "video/mp4" });
    if (!blob.size) throw new Error("O vídeo recebido está vazio. Tenta novamente.");
    onProgress(100);
    return blob;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("A renderização demorou demasiado. Tenta novamente com uma fotografia mais leve.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
