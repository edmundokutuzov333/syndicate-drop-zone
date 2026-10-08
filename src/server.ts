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
