-- Phase 5 security/performance hardening after schema reconciliation.
-- Public users may read published beat metadata and preview URLs, never the full audio_url column.
REVOKE ALL ON TABLE public.beats FROM PUBLIC, anon;
REVOKE SELECT (audio_url) ON TABLE public.beats FROM PUBLIC, anon;
GRANT SELECT (id,slug,title,producer,bpm,key_signature,preview_url,price,currency,licence_terms,position,status)
  ON TABLE public.beats TO anon;

DROP POLICY IF EXISTS "public read published beats" ON public.beats;
CREATE POLICY "public read published beats"
  ON public.beats FOR SELECT TO anon
  USING (status IN ('published','ready','active','live')
    AND preview_url IS NOT NULL AND btrim(preview_url) <> '');

CREATE OR REPLACE VIEW public.beats_public WITH (security_invoker = true) AS
SELECT id,slug,title,producer,bpm,key_signature,preview_url,price,currency,licence_terms,position,status
FROM public.beats
WHERE status IN ('published','ready','active','live')
  AND preview_url IS NOT NULL
  AND btrim(preview_url) <> '';
REVOKE ALL ON TABLE public.beats_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.beats_public TO anon, authenticated;
COMMENT ON VIEW public.beats_public IS
  'Security-invoker view exposing published beat metadata and preview URLs only. Full audio assets remain private.';

-- These functions are invoked only by database triggers or security policies.
REVOKE ALL ON FUNCTION public.record_merch_stock_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reservation_inventory() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.write_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_inventory_counters() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_admin_role() TO authenticated;
-- Anonymous clients cannot disable radio tracks by repeatedly reporting synthetic failures.
REVOKE ALL ON FUNCTION public.frequency_mark_track_failure(text) FROM PUBLIC, anon, authenticated;

-- Explicit deny policies document that these operational tables are accessed only through their RPCs.
DROP POLICY IF EXISTS "deny direct client access" ON public.frequency_station;
CREATE POLICY "deny direct client access" ON public.frequency_station
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny direct client access" ON public.frequency_listeners;
CREATE POLICY "deny direct client access" ON public.frequency_listeners
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny direct client access" ON public.frequency_badges;
CREATE POLICY "deny direct client access" ON public.frequency_badges
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny direct client access" ON public.live_notifications;
CREATE POLICY "deny direct client access" ON public.live_notifications
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Foreign-key indexes flagged by the Supabase performance advisor.
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_idx ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS camping_sessions_event_idx ON public.camping_sessions(event_id);
CREATE INDEX IF NOT EXISTS gallery_items_media_asset_idx ON public.gallery_items(media_asset_id);
CREATE INDEX IF NOT EXISTS gallery_items_poster_asset_idx ON public.gallery_items(poster_media_asset_id);
CREATE INDEX IF NOT EXISTS inventory_movements_actor_user_idx ON public.inventory_movements(actor_user_id);
CREATE INDEX IF NOT EXISTS media_assets_uploader_user_idx ON public.media_assets(uploader_user_id);
CREATE INDEX IF NOT EXISTS merch_products_media_asset_idx ON public.merch_products(media_asset_id);
CREATE INDEX IF NOT EXISTS radio_station_active_block_idx ON public.radio_station(active_block_id);
CREATE INDEX IF NOT EXISTS radio_station_forced_track_idx ON public.radio_station(forced_track_id);
CREATE INDEX IF NOT EXISTS releases_artist_id_idx ON public.releases(artist_id);
CREATE INDEX IF NOT EXISTS revelation_media_asset_idx ON public.revelation_media(media_asset_id);
CREATE INDEX IF NOT EXISTS revelation_media_poster_asset_idx ON public.revelation_media(poster_media_asset_id);

DROP POLICY IF EXISTS "admin profile self read" ON public.admin_profiles;
CREATE POLICY "admin profile self read" ON public.admin_profiles
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.current_admin_role() IN ('OWNER','ADMIN'));
