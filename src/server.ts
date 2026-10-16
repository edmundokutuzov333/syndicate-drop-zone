import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { REVELACAO_DOWNLOADS } from "./lib/revelacao-media";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const FAN_VIDEO_PATH = "/api/fan-video";
const DEFAULT_FAN_VIDEO_BACKEND_ORIGIN = "https://syndicate-drop-zone.vercel.app";

type FanVideoProxyEnv = { FAN_VIDEO_BACKEND_ORIGIN?: unknown };

function jsonProxyError(status: number, code: string, error: string, requestId: string): Response {
  return Response.json(
    { code, error, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

/**
 * Lovable serves the TanStack app through its HTML SSR handler; native FFmpeg
 * runs in the Vercel Node function. Intercept this endpoint before TanStack's
 * HTML-only content negotiation and relay the request to the native API.
 */
async function handleFanVideoProxy(request: Request, env: unknown): Promise<Response | null> {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname !== FAN_VIDEO_PATH) return null;

  const suppliedId = request.headers.get("x-request-id") || "";
  const requestId = /^[A-Za-z0-9-]{8,80}$/.test(suppliedId) ? suppliedId : crypto.randomUUID();

  if (request.method !== "POST") {
    return jsonProxyError(405, "METHOD_NOT_ALLOWED", "Este endpoint aceita apenas pedidos POST.", requestId);
  }

  const envConfig = env && typeof env === "object" ? env as FanVideoProxyEnv : undefined;
  const configuredOrigin = typeof envConfig?.FAN_VIDEO_BACKEND_ORIGIN === "string"
    ? envConfig.FAN_VIDEO_BACKEND_ORIGIN.trim()
    : "";
  let backendOrigin: string;
  try {
    backendOrigin = new URL(configuredOrigin || DEFAULT_FAN_VIDEO_BACKEND_ORIGIN).origin;
  } catch {
    return jsonProxyError(500, "VIDEO_BACKEND_MISCONFIGURED", "O endereço do motor de vídeo está mal configurado.", requestId);
  }

  // Avoid a proxy loop: on the backend's own canonical host, Vercel's /api
  // function must handle the request directly.
  if (requestUrl.origin === backendOrigin) return null;

  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return jsonProxyError(400, "INVALID_REQUEST_BODY", "Não foi possível ler os dados do cartão.", requestId);
  }
  if (body.byteLength > 4_200_000) {
    return jsonProxyError(413, "REQUEST_TOO_LARGE", "A imagem enviada é demasiado grande. Usa uma imagem mais leve.", requestId);
  }

  const upstreamHeaders = new Headers({
    "Content-Type": request.headers.get("content-type") || "application/json",
    Accept: "video/mp4, application/json",
    "X-Request-Id": requestId,
  });
  // Use the Cloudflare edge's address for rate limiting rather than treating
  // every fan using the proxy as a single client.
  const clientIp = request.headers.get("cf-connecting-ip") || "";
  if (/^[0-9a-f:.]+$/i.test(clientIp)) upstreamHeaders.set("X-Real-IP", clientIp);

  try {
    const upstreamUrl = new URL(FAN_VIDEO_PATH, backendOrigin);
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body,
      redirect: "manual",
    });
    const headers = new Headers();
    for (const name of [
      "content-type",
      "content-length",
      "content-disposition",
      "cache-control",
      "retry-after",
      "x-request-id",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("X-Request-Id", headers.get("X-Request-Id") || requestId);
    headers.set("Cache-Control", headers.get("Cache-Control") || "no-store");
    headers.set("Vary", "Accept");

    // Surface a useful JSON error if the upstream is misrouted to TanStack SSR.
    if (!upstream.headers.get("content-type")?.toLowerCase().includes("video/mp4")) {
      const text = await upstream.clone().text().catch(() => "");
      if (text.includes("Only HTML requests are supported here")) {
        return jsonProxyError(
          502,
          "VIDEO_BACKEND_MISROUTED",
          "O pedido chegou ao servidor de páginas em vez do motor nativo de vídeo. Verifica FAN_VIDEO_BACKEND_ORIGIN no deployment.",
          requestId,
        );
      }
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error(`[fan-video-proxy:${requestId}] upstream request failed:`, error);
    return jsonProxyError(502, "VIDEO_BACKEND_UNAVAILABLE", "Não foi possível contactar o motor nativo de vídeo. O PNG continua disponível.", requestId);
  }
}

async function handleRevelacaoDownload(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/api/revelacao/download" && request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }

  const match = url.pathname.match(/^\/api\/revelacao\/download\/([A-Za-z0-9_-]+)$/);
  if (!match) return null;

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }

  const mediaId = match[1] ?? "";
  const authorized = REVELACAO_DOWNLOADS[mediaId];
  if (!authorized) {
    return new Response("Media not authorized for download", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const assetUrl = new URL(authorized.src, request.url);
    const upstream = await fetch(assetUrl);

    if (!upstream.ok || !upstream.body) {
      return new Response("Media unavailable", {
        status: upstream.status || 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const headers = new Headers(upstream.headers);
    headers.set(
      "Content-Disposition",
      "attachment; filename*=UTF-8''" + encodeURIComponent(authorized.downloadName),
    );
    headers.set("Cache-Control", "private, max-age=300");

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(error);
    return new Response("Media download failed", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error("h3 swallowed SSR error: " + body));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const fanVideoResponse = await handleFanVideoProxy(request, env);
    if (fanVideoResponse) return fanVideoResponse;

    const downloadResponse = await handleRevelacaoDownload(request);
    if (downloadResponse) return downloadResponse;

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
