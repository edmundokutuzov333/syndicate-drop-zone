create sequence if not exists public.fan_membership_number_seq;

create table if not exists public.fan_memberships (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  fan_number bigint not null unique default nextval('public.fan_membership_number_seq'),
  alias text not null,
  referred_by_fan_id uuid null references public.fan_memberships(id) on delete set null,
  rules_version text not null default 'v1',
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  since timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fan_memberships_alias_length check (char_length(btrim(alias)) between 2 and 20),
  constraint fan_memberships_code_format check (code ~ '^[A-Z0-9]{6}$')
);

alter sequence public.fan_membership_number_seq owned by public.fan_memberships.fan_number;
create index if not exists fan_memberships_referred_by_idx on public.fan_memberships(referred_by_fan_id);
create index if not exists fan_memberships_since_idx on public.fan_memberships(since desc);
create index if not exists fan_memberships_status_idx on public.fan_memberships(status);
alter table public.fan_memberships enable row level security;
revoke all on public.fan_memberships from public, anon, authenticated;
revoke all on sequence public.fan_membership_number_seq from public, anon, authenticated;

create or replace function public.register_fan(
  p_alias text,
  p_rules_version text default 'v1',
  p_referred_by text default null
)
returns table (code text, fan_number bigint, alias text, since timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alias text := btrim(coalesce(p_alias, ''));
  v_rules_version text := left(btrim(coalesce(p_rules_version, 'v1')), 24);
  v_code text;
  v_number bigint;
  v_since timestamptz;
  v_referred_by uuid;
begin
  if char_length(v_alias) < 2 or char_length(v_alias) > 20 then
    raise exception using errcode = '22023', message = 'NOME_INVALIDO';
  end if;
  select f.id into v_referred_by
  from public.fan_memberships f
  where f.code = upper(btrim(coalesce(p_referred_by, '')))
    and f.status = 'active'
  limit 1;
  v_code := substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 6);
  while exists (select 1 from public.fan_memberships f where f.code = v_code) loop
    v_code := substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 6);
  end loop;
  insert into public.fan_memberships (code, alias, referred_by_fan_id, rules_version)
  values (v_code, v_alias, v_referred_by, coalesce(nullif(v_rules_version, ''), 'v1'))
  returning public.fan_memberships.fan_number, public.fan_memberships.since into v_number, v_since;
  return query select v_code, v_number, v_alias, v_since;
end;
$$;
revoke all on function public.register_fan(text, text, text) from public;
grant execute on function public.register_fan(text, text, text) to anon, authenticated;

create or replace function public.fan_public(p_code text)
returns table (code text, fan_number bigint, alias text, since timestamptz)
language sql
security definer
set search_path = ''
as $$
  select f.code, f.fan_number, f.alias, f.since
  from public.fan_memberships f
  where f.code = upper(btrim(coalesce(p_code, '')))
    and f.status = 'active'
  limit 1;
$$;
revoke all on function public.fan_public(text) from public;
grant execute on function public.fan_public(text) to anon, authenticated;

comment on table public.fan_memberships is 'Public fan cards with no contact, photo or signature data. Public access is limited to security-definer RPCs.';
comment on column public.fan_memberships.rules_version is 'Version of the short Code of the Fan accepted when creating the card.';
