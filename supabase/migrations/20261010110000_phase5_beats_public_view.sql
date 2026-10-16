-- Expose only public beat metadata and preview URLs. Never expose the full/licensed audio_url through anon REST.
DROP POLICY IF EXISTS "public read published" ON public.beats;
REVOKE SELECT ON public.beats FROM anon;

CREATE OR REPLACE VIEW public.beats_public AS
SELECT
  id,
  slug,
  title,
  producer,
  bpm,
  key_signature,
  preview_url,
  price,
  currency,
  licence_terms,
  position,
  status
FROM public.beats
WHERE status IN ('published','ready','active','live')
  AND preview_url IS NOT NULL
  AND btrim(preview_url) <> '';

REVOKE ALL ON public.beats_public FROM PUBLIC;
GRANT SELECT ON public.beats_public TO anon, authenticated;

COMMENT ON VIEW public.beats_public IS
  'Safe public beat catalogue: exposes only published metadata and preview URLs, never full/licensed audio assets.';
