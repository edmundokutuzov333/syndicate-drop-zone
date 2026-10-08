-- FREQUÊNCIA 808 production radio catalog
create table if not exists public.radio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default 'SINDICATO 808',
  artist_slug text,
  audio_url text not null,
  duration_seconds numeric,
  kind text not null default 'music' check (kind in ('music','jingle','sfx')),
  status text not null default 'published',
  rotation_weight integer not null default 1 check (rotation_weight between 1 and 100),
  position integer not null default 0,
  failure_count integer not null default 0,
  temporarily_disabled boolean not null default false,
  last_failure_at timestamptz,
  tags_enabled boolean not null default true,
  effects_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.radio_station (
  id smallint primary key default 1,
  station_name text not null default 'RÁDIO SINDICATO DO TRAP',
  station_tag_url text not null default '/audio/Frequencia_808_tag.mp3',
  active_block_id uuid,
  forced_track_id uuid references public.radio_tracks(id) on delete set null,
  forced_started_at timestamptz,
  autoplay boolean not null default true,
  station_seed bigint not null default 8080808,
  crossfade_ms integer not null default 650 check (crossfade_ms between 0 and 1200),
  tag_interval integer not null default 3 check (tag_interval between 1 and 9),
  updated_at timestamptz not null default now(),
  constraint radio_station_singleton check (id = 1)
);

alter table public.radio_tracks enable row level security;
alter table public.radio_station enable row level security;

create or replace function public.is_radio_editor()
returns boolean
language sql
security definer
set search_path = ''
as $
  select exists(
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and active = true
      and role in ('OWNER','ADMIN','EDITOR')
  );
$;

revoke all on function public.is_radio_editor() from public;
grant execute on function public.is_radio_editor() to authenticated;

drop policy if exists "radio_tracks_public_read" on public.radio_tracks;
create policy "radio_tracks_public_read"
on public.radio_tracks
for select
to anon, authenticated
using (
  status in ('published','active','live','ready')
  and temporarily_disabled = false
);

drop policy if exists "radio_station_public_read" on public.radio_station;
create policy "radio_station_public_read"
on public.radio_station
for select
to anon, authenticated
using (id = 1);

create table if not exists public.radio_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  track_ids uuid[] not null default '{}'::uuid[],
  active boolean not null default true,
  randomize boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.radio_blocks enable row level security;

drop policy if exists "radio_blocks_public_read" on public.radio_blocks;
create policy "radio_blocks_public_read"
on public.radio_blocks
for select
to anon, authenticated
using (active = true);

alter table public.radio_station
  drop constraint if exists radio_station_active_block_fk;

alter table public.radio_station
  add constraint radio_station_active_block_fk
  foreign key (active_block_id) references public.radio_blocks(id) on delete set null;

create or replace function public.frequency_radio_blocks()
returns table (
  id uuid,
  name text,
  track_ids uuid[],
  active boolean,
  randomize boolean
)
language sql
security definer
set search_path = ''
as $
  select id, name, track_ids, active, randomize
  from public.radio_blocks
  where active = true
  order by created_at asc;
$;

revoke all on function public.frequency_radio_blocks() from public;
grant execute on function public.frequency_radio_blocks() to anon, authenticated;

drop policy if exists "radio_tracks_editor_write" on public.radio_tracks;
create policy "radio_tracks_editor_write"
on public.radio_tracks
for all
to authenticated
using (public.is_radio_editor())
with check (public.is_radio_editor());

drop policy if exists "radio_station_editor_write" on public.radio_station;
create policy "radio_station_editor_write"
on public.radio_station
for all
to authenticated
using (public.is_radio_editor())
with check (public.is_radio_editor());

drop policy if exists "radio_blocks_editor_write" on public.radio_blocks;
create policy "radio_blocks_editor_write"
on public.radio_blocks
for all
to authenticated
using (public.is_radio_editor())
with check (public.is_radio_editor());

insert into public.radio_tracks (id, title, artist, audio_url, duration_seconds, kind, status, rotation_weight, position)
values
  ('00000000-0000-4000-8000-000000000001', 'FAIXA 01', 'SINDICATO 808', 'https://files.catbox.moe/b5ypxy.wav', null, 'music', 'published', 1, 1),
  ('00000000-0000-4000-8000-000000000002', 'FAIXA 02', 'SINDICATO 808', 'https://files.catbox.moe/alftc5.mp3', null, 'music', 'published', 1, 2),
  ('00000000-0000-4000-8000-000000000003', 'FAIXA 03', 'SINDICATO 808', 'https://files.catbox.moe/qj0i9z.mp3', null, 'music', 'published', 1, 3),
  ('00000000-0000-4000-8000-000000000004', 'FAIXA 04', 'SINDICATO 808', 'https://files.catbox.moe/fije61.mp3', null, 'music', 'published', 1, 4),
  ('00000000-0000-4000-8000-000000000005', 'FAIXA 05', 'SINDICATO 808', 'https://files.catbox.moe/o47a3g.mp3', null, 'music', 'published', 1, 5),
  ('00000000-0000-4000-8000-000000000006', 'FAIXA 06', 'SINDICATO 808', 'https://files.catbox.moe/9b0rq5.mp3', null, 'music', 'published', 1, 6),
  ('00000000-0000-4000-8000-000000000007', 'FAIXA 07', 'SINDICATO 808', 'https://files.catbox.moe/0kg9v2.mp3', null, 'music', 'published', 1, 7),
  ('00000000-0000-4000-8000-000000000008', 'FAIXA 08', 'SINDICATO 808', 'https://files.catbox.moe/g9nczk.mp3', null, 'music', 'published', 1, 8),
  ('00000000-0000-4000-8000-000000000009', 'FAIXA 09', 'SINDICATO 808', 'https://files.catbox.moe/6hit4n.wav', null, 'music', 'published', 1, 9)
on conflict (id) do update set
  title = excluded.title,
  artist = excluded.artist,
  audio_url = excluded.audio_url,
  status = excluded.status,
  rotation_weight = excluded.rotation_weight,
  position = excluded.position,
  updated_at = now();

insert into public.radio_station (id)
values (1)
on conflict (id) do nothing;

create or replace function public.frequency_radio_catalog()
returns table (
  id uuid,
  title text,
  artist text,
  artist_slug text,
  audio_url text,
  duration_seconds numeric,
  kind text,
  rotation_weight integer,
  position integer,
  failure_count integer,
  temporarily_disabled boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    t.id,
    t.title,
    t.artist,
    t.artist_slug,
    t.audio_url,
    t.duration_seconds,
    t.kind,
    t.rotation_weight,
    t.position,
    t.failure_count,
    t.temporarily_disabled
  from public.radio_tracks t
  where t.status in ('published','active','live','ready')
    and t.temporarily_disabled = false
  order by t.position asc, t.id asc;
$$;

revoke all on function public.frequency_radio_catalog() from public;
grant execute on function public.frequency_radio_catalog() to anon, authenticated;

create or replace function public.frequency_radio_station()
returns table (
  station_name text,
  station_tag_url text,
  active_block_id uuid,
  forced_track_id uuid,
  forced_started_at timestamptz,
  autoplay boolean,
  station_seed bigint,
  crossfade_ms integer,
  tag_interval integer
)
language sql
security definer
set search_path = ''
as $$
  select
    station_name,
    station_tag_url,
    active_block_id,
    forced_track_id,
    forced_started_at,
    autoplay,
    station_seed,
    crossfade_ms,
    tag_interval
  from public.radio_station
  where id = 1;
$$;

revoke all on function public.frequency_radio_station() from public;
grant execute on function public.frequency_radio_station() to anon, authenticated;

create or replace function public.frequency_mark_track_failure(p_track_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_count integer;
begin
  update public.radio_tracks
  set
    failure_count = failure_count + 1,
    last_failure_at = now(),
    temporarily_disabled = failure_count + 1 >= 3,
    updated_at = now()
  where id = p_track_id
  returning failure_count into next_count;

  return coalesce(next_count, 0);
end;
$$;

revoke all on function public.frequency_mark_track_failure(uuid) from public;
grant execute on function public.frequency_mark_track_failure(uuid) to anon, authenticated;
