export const SUPABASE_PUBLIC_URL = "https://hhipwyixtbleiulfnvvm.supabase.co";
export const SUPABASE_PUBLIC_KEY = "sb_publishable_vfYmLBY6O2Ruxv3ggJCXmQ_I9KAhfw0";

export function getPublicSupabaseConfig() {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || SUPABASE_PUBLIC_URL;
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    SUPABASE_PUBLIC_KEY;
  return { url, key };
}
