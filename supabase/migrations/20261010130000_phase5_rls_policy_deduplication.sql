-- Reduce overlapping RLS policies without broadening access.
-- Public website access is via anon; authenticated writes are limited to explicit Control Room roles.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'artists','artist_releases','artist_socials','tapes','releases',
    'camping_events','camping_sessions','media_assets','gallery_items',
    'revelation_media','site_settings','site_sections','drop_campaigns'
  ] LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO anon','public read published',t);
  END LOOP;
END $$;

ALTER POLICY "Public can read site flags" ON public.site_flags TO anon;
ALTER POLICY "Public can read artist status" ON public.artist_status TO anon;

ALTER POLICY "public read published" ON public.merch_products TO anon;
ALTER POLICY "public read active variants" ON public.merch_variants TO anon;

ALTER POLICY "radio_tracks_public_read" ON public.radio_tracks TO anon;
ALTER POLICY "radio_station_public_read" ON public.radio_station TO anon;
ALTER POLICY "radio_blocks_public_read" ON public.radio_blocks TO anon;

-- Admins have a single explicit SELECT policy for their own profile or the admin directory.
-- Write operations remain OWNER/ADMIN only; no FOR ALL policy overlaps the SELECT policy.
DROP POLICY IF EXISTS "owner manage admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "owner insert admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "owner update admin profiles" ON public.admin_profiles;
DROP POLICY IF EXISTS "owner delete admin profiles" ON public.admin_profiles;

CREATE POLICY "owner insert admin profiles" ON public.admin_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN'));
CREATE POLICY "owner update admin profiles" ON public.admin_profiles
  FOR UPDATE TO authenticated
  USING (public.current_admin_role() IN ('OWNER','ADMIN'))
  WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN'));
CREATE POLICY "owner delete admin profiles" ON public.admin_profiles
  FOR DELETE TO authenticated
  USING (public.current_admin_role() IN ('OWNER','ADMIN'));
