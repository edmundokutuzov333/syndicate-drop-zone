create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_id_text text;
begin
  entity_id_text := coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id', to_jsonb(new)->>'key', to_jsonb(old)->>'key');
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, payload)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    entity_id_text,
    jsonb_build_object('new', to_jsonb(new), 'old', to_jsonb(old))
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.write_audit_log() from public;

drop trigger if exists trg_artists_audit on public.artists;
create trigger trg_artists_audit after insert or update or delete on public.artists
for each row execute function public.write_audit_log();

drop trigger if exists trg_artist_releases_audit on public.artist_releases;
create trigger trg_artist_releases_audit after insert or update or delete on public.artist_releases
for each row execute function public.write_audit_log();

drop trigger if exists trg_tapes_audit on public.tapes;
create trigger trg_tapes_audit after insert or update or delete on public.tapes
for each row execute function public.write_audit_log();

drop trigger if exists trg_partnership_audit on public.partnership_requests;
create trigger trg_partnership_audit after update on public.partnership_requests
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
