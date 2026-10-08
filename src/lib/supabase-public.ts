export type PublicSupabaseConfig = { url: string; key: string };

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (!url || !key) {
    throw new Error("Supabase público não está configurado no runtime.");
  }

  return { url, key };
}
