create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_id_text text;
begin
  if tg_op = 'DELETE' then
    entity_id_text := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'key');
  else
    entity_id_text := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'key');
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    entity_id_text,
    jsonb_build_object(
      'operation', tg_op,
      'new', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
      'old', case when tg_op = 'INSERT' then null else to_jsonb(old) end
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.write_audit_log() from public;

drop trigger if exists trg_artists_audit on public.artists;
create trigger trg_artists_audit after insert or update or delete on public.artists
for each row execute function public.write_audit_log();

drop trigger if exists trg_artist_releases_audit on public.artist_releases;
create trigger trg_artist_releases_audit after insert or update or delete on public.artist_releases
for each row execute function public.write_audit_log();

drop trigger if exists trg_artist_socials_audit on public.artist_socials;
create trigger trg_artist_socials_audit after insert or update or delete on public.artist_socials
for each row execute function public.write_audit_log();

drop trigger if exists trg_tapes_audit on public.tapes;
create trigger trg_tapes_audit after insert or update or delete on public.tapes
for each row execute function public.write_audit_log();

drop trigger if exists trg_releases_audit on public.releases;
create trigger trg_releases_audit after insert or update or delete on public.releases
for each row execute function public.write_audit_log();

drop trigger if exists trg_camping_events_audit on public.camping_events;
create trigger trg_camping_events_audit after insert or update or delete on public.camping_events
for each row execute function public.write_audit_log();

drop trigger if exists trg_camping_sessions_audit on public.camping_sessions;
create trigger trg_camping_sessions_audit after insert or update or delete on public.camping_sessions
for each row execute function public.write_audit_log();

drop trigger if exists trg_revelation_media_audit on public.revelation_media;
create trigger trg_revelation_media_audit after insert or update or delete on public.revelation_media
for each row execute function public.write_audit_log();

drop trigger if exists trg_media_assets_audit on public.media_assets;
create trigger trg_media_assets_audit after insert or update or delete on public.media_assets
for each row execute function public.write_audit_log();

drop trigger if exists trg_merch_products_audit on public.merch_products;
create trigger trg_merch_products_audit after insert or update or delete on public.merch_products
for each row execute function public.write_audit_log();

drop trigger if exists trg_merch_variants_audit on public.merch_variants;
create trigger trg_merch_variants_audit after insert or update or delete on public.merch_variants
for each row execute function public.write_audit_log();

drop trigger if exists trg_inventory_movements_audit on public.inventory_movements;
create trigger trg_inventory_movements_audit after insert or update or delete on public.inventory_movements
for each row execute function public.write_audit_log();

drop trigger if exists trg_reservations_audit on public.reservations;
create trigger trg_reservations_audit after insert or update or delete on public.reservations
for each row execute function public.write_audit_log();

drop trigger if exists trg_partnership_audit on public.partnership_requests;
create trigger trg_partnership_audit after insert or update or delete on public.partnership_requests
for each row execute function public.write_audit_log();

drop trigger if exists trg_site_settings_audit on public.site_settings;
create trigger trg_site_settings_audit after insert or update or delete on public.site_settings
for each row execute function public.write_audit_log();

drop trigger if exists trg_site_sections_audit on public.site_sections;
create trigger trg_site_sections_audit after insert or update or delete on public.site_sections
for each row execute function public.write_audit_log();

drop trigger if exists trg_drop_campaigns_audit on public.drop_campaigns;
create trigger trg_drop_campaigns_audit after insert or update or delete on public.drop_campaigns
for each row execute function public.write_audit_log();

drop trigger if exists trg_admin_profiles_audit on public.admin_profiles;
create trigger trg_admin_profiles_audit after insert or update or delete on public.admin_profiles
for each row execute function public.write_audit_log();
