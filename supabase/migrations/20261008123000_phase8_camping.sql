create table if not exists public.site_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_status (
  artist_id uuid primary key references public.artists(id) on delete cascade,
  status text not null default 'ATIVO' check (status in ('ATIVO','ISOLADO','VIGIADO','DESAPARECIDO')),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'live' check (kind = 'live'),
  contact_type text not null check (contact_type in ('whatsapp','email')),
  contact_value text not null,
  contact_key text not null unique,
  created_at timestamptz not null default now()
);

alter table public.site_flags enable row level security;
alter table public.artist_status enable row level security;
alter table public.live_notifications enable row level security;

revoke all on public.site_flags from anon, authenticated;
revoke all on public.artist_status from anon, authenticated;
grant select on public.site_flags to anon, authenticated;
grant select on public.artist_status to anon, authenticated;
revoke all on public.live_notifications from anon, authenticated;

drop policy if exists "Public can read site flags" on public.site_flags;
create policy "Public can read site flags"
  on public.site_flags for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read artist status" on public.artist_status;
create policy "Public can read artist status"
  on public.artist_status for select
  to anon, authenticated
  using (true);

insert into public.site_flags(key,value)
values
  ('live', jsonb_build_object('on', false, 'url', '')),
  ('CAMP', jsonb_build_object('start', null, 'end', null))
on conflict (key) do nothing;

insert into public.artist_status(artist_id,status)
select id,'ATIVO' from public.artists
on conflict (artist_id) do nothing;

drop policy if exists "Admins manage site flags" on public.site_flags;
grant select, insert, update, delete on public.site_flags to authenticated;
grant select, insert, update, delete on public.artist_status to authenticated;

create policy "Admins manage site flags"
  on public.site_flags for all
  to authenticated
  using (current_admin_role() in ('OWNER','ADMIN','EDITOR'))
  with check (current_admin_role() in ('OWNER','ADMIN','EDITOR'));

drop policy if exists "Admins manage artist status" on public.artist_status;
create policy "Admins manage artist status"
  on public.artist_status for all
  to authenticated
  using (current_admin_role() in ('OWNER','ADMIN','EDITOR'))
  with check (current_admin_role() in ('OWNER','ADMIN','EDITOR'));

create or replace function public.create_live_notification(
  p_kind text,
  p_contact_type text,
  p_contact_value text
)
returns table (accepted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text := btrim(coalesce(p_contact_value,''));
  v_type text := lower(btrim(coalesce(p_contact_type,'')));
  v_key text;
begin
  if lower(coalesce(p_kind,'live')) <> 'live' then
    raise exception using errcode='22023', message='TIPO_INVALIDO';
  end if;
  if v_type not in ('email','whatsapp') then
    raise exception using errcode='22023', message='CONTACTO_INVALIDO';
  end if;
  if char_length(v_value) < 5 or char_length(v_value) > 120 then
    raise exception using errcode='22023', message='CONTACTO_INVALIDO';
  end if;
  if v_type = 'email' then
    v_value := lower(v_value);
    if v_value !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception using errcode='22023', message='EMAIL_INVALIDO';
    end if;
  else
    if v_value !~ '^\+?[0-9][0-9 .()\-]{4,}$' then
      raise exception using errcode='22023', message='WHATSAPP_INVALIDO';
    end if;
  end if;
  v_key := 'live:' || v_type || ':' || lower(regexp_replace(v_value,'[^a-zA-Z0-9@._+]','','g'));
  insert into public.live_notifications(kind,contact_type,contact_value,contact_key)
  values ('live',v_type,v_value,v_key)
  on conflict (contact_key) do nothing;
  return query select true;
end;
$$;

revoke all on function public.create_live_notification(text,text,text) from public;
grant execute on function public.create_live_notification(text,text,text) to anon, authenticated;

-- Supabase Realtime: these two lightweight state tables are public-state channels.
do $$
begin
  alter publication supabase_realtime add table public.site_flags;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.artist_status;
exception
  when duplicate_object then null;
end $$;

comment on table public.site_flags is 'Phase 8: runtime flags such as LIVE and CAMP range.';
comment on table public.artist_status is 'Phase 8: current artist presence status for the bunker.';
