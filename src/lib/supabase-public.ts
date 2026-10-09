export type PublicSupabaseConfig = { url: string; key: string };
export type PublicSupabaseRuntimeInputs = { browserHost: string; configuredUrl?: string; configuredKey?: string; directUrl?: string; directKey?: string };
const DIRECT_SUPABASE_URL = "https://hhipwyixtbleiulfnvvm.supabase.co";
// Canonical public key for this project. Vercel currently injects a stale, invalid key at build time.
const DIRECT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vfYmLBY6O2Ruxv3ggJCXmQ_I9KAhfw0";

export function resolvePublicSupabaseConfig(input: PublicSupabaseRuntimeInputs): PublicSupabaseConfig {
  const host = input.browserHost.trim().toLowerCase();
  const isLovableHost = host.endsWith(".lovable.app") || host.endsWith(".lovable.dev");
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const useDirectBackend = Boolean(host) && !isLovableHost && !isLocalHost;
  const useConfiguredBackend = !useDirectBackend && Boolean(input.configuredUrl?.trim());
  const url = (useDirectBackend ? input.directUrl : useConfiguredBackend ? input.configuredUrl : input.directUrl)?.trim().replace(/\/+$/, "");
  const key = useDirectBackend ? input.directKey?.trim() : useConfiguredBackend ? input.configuredKey?.trim() : input.directKey?.trim();
  if (!url || !key) {
    const missing = [
      ...(!url ? [useDirectBackend ? "VITE_SUPABASE_DIRECT_URL" : "VITE_SUPABASE_URL"] : []),
      ...(!key ? [useDirectBackend ? "VITE_SUPABASE_DIRECT_PUBLISHABLE_KEY" : useConfiguredBackend ? "VITE_SUPABASE_PUBLISHABLE_KEY" : "VITE_SUPABASE_DIRECT_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error("Supabase público não está configurado correctamente: " + missing.join(", ") + ".");
  }
  if (key.startsWith("sb_secret_")) throw new Error("Uma chave secreta Supabase não pode ser usada no cliente público.");
  return { url, key };
}

export function publicSupabaseHeaders(key: string, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("apikey", key);
  if (key.startsWith("sb_publishable_")) {
    if (headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
  } else if (!headers.has("Authorization")) {
    headers.set("Authorization", "Bearer " + key);
  }
  return headers;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const browserHost = typeof window !== "undefined" ? window.location.hostname : "";
  const configuredUrl = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.trim();
  const configuredKey = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined)?.trim() ||
    (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined)?.trim();
  const directUrl = (import.meta.env["VITE_SUPABASE_DIRECT_URL"] as string | undefined)?.trim() || DIRECT_SUPABASE_URL;
  const directKey = DIRECT_SUPABASE_PUBLISHABLE_KEY;
  return resolvePublicSupabaseConfig({ browserHost, configuredUrl, configuredKey, directUrl, directKey });
}
