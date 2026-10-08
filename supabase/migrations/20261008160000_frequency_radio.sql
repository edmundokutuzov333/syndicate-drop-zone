-- FREQÜÊNCIA 808
-- Shared deterministic station clock + anonymous listener heartbeat + optional night badge.
create table if not exists public.frequency_station (
  id smallint primary key default 1,
  station_started_at timestamptz not null,
  program_seed bigint not null default 8080808,
  updated_at timestamptz not null default now(),
  constraint frequency_station_singleton check (id = 1)
);

insert into public.frequency_station (id, station_started_at, program_seed)
values (1, now() - interval '6 hours', 8080808)
on conflict (id) do nothing;

alter table public.frequency_station enable row level security;
revoke all on table public.frequency_station from anon, authenticated;

create table if not exists public.frequency_listeners (
  sid text primary key,
  last_seen timestamptz not null default now(),
  constraint frequency_listeners_sid_length check (char_length(sid) between 4 and 64)
);

alter table public.frequency_listeners enable row level security;
revoke all on table public.frequency_listeners from anon, authenticated;

create table if not exists public.frequency_badges (
  code text primary key,
  badge text not null default 'OUVINTE DA MADRUGADA',
  earned_at timestamptz not null default now()
);

alter table public.frequency_badges enable row level security;
revoke all on table public.frequency_badges from anon, authenticated;

create or replace function public.frequency_clock()
returns table (server_now timestamptz, station_started_at timestamptz, program_seed bigint)
language sql
security definer
set search_path = ''
as $$
  select now(), s.station_started_at, s.program_seed
  from public.frequency_station s
  where s.id = 1;
$$;

revoke all on function public.frequency_clock() from public;
grant execute on function public.frequency_clock() to anon, authenticated;

create or replace function public.frequency_heartbeat(p_sid text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_sid is null or char_length(btrim(p_sid)) not between 4 and 64 then
    raise exception using errcode = '22023', message = 'SID_INVALIDO';
  end if;

  insert into public.frequency_listeners (sid, last_seen)
  values (btrim(p_sid), now())
  on conflict (sid)
  do update set last_seen = excluded.last_seen;
end;
$$;

revoke all on function public.frequency_heartbeat(text) from public;
grant execute on function public.frequency_heartbeat(text) to anon, authenticated;

create or replace function public.frequency_listener_count()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select count(*)::bigint
  from public.frequency_listeners
  where last_seen >= now() - interval '45 seconds';
$$;

revoke all on function public.frequency_listener_count() from public;
grant execute on function public.frequency_listener_count() to anon, authenticated;

create or replace function public.frequency_award_night(p_code text, p_local_hour integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := upper(btrim(coalesce(p_code, '')));
  valid_member boolean := false;
begin
  if normalized = '' or normalized !~ '^[A-Z0-9]{4,16}$' then
    return false;
  end if;

  if p_local_hour <> 3 then
    return false;
  end if;

  if to_regclass('public.members') is not null then
    execute 'select exists(select 1 from public.members where code = $1 and status = ''active'')'
      into valid_member
      using normalized;
  end if;

  if not valid_member then
    return false;
  end if;

  insert into public.frequency_badges(code, badge)
  values (normalized, 'OUVINTE DA MADRUGADA')
  on conflict (code) do nothing;

  return true;
end;
$$;

revoke all on function public.frequency_award_night(text, integer) from public;
grant execute on function public.frequency_award_night(text, integer) to anon, authenticated;

create or replace function public.frequency_has_night_badge(p_code text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.frequency_badges b
    where b.code = upper(btrim(coalesce(p_code, '')))
      and b.badge = 'OUVINTE DA MADRUGADA'
  );
$$;

revoke all on function public.frequency_has_night_badge(text) from public;
grant execute on function public.frequency_has_night_badge(text) to anon, authenticated;
