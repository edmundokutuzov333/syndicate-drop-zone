export type PublicSupabaseConfig = { url: string; key: string };

const DIRECT_SUPABASE_URL = "https://hhipwyixtbleiulfnvvm.supabase.co";

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const browserHost = typeof window !== "undefined" ? window.location.hostname : "";
  const configuredUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const directUrl =
    (import.meta.env.VITE_SUPABASE_DIRECT_URL as string | undefined)?.trim() || DIRECT_SUPABASE_URL;
  const isLovableHost =
    browserHost.endsWith(".lovable.app") ||
    browserHost.endsWith(".lovable.dev");
  const isLocalHost = browserHost === "localhost" || browserHost === "127.0.0.1";
  const shouldUseDirectBackend = Boolean(browserHost) && !isLovableHost && !isLocalHost;
  const url = (shouldUseDirectBackend ? directUrl : configuredUrl || directUrl)?.replace(/\/+$/, "");
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (!url || !key) {
    throw new Error("Supabase público não está configurado no runtime.");
  }

  return { url, key };
}
