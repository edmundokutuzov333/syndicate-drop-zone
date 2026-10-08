-- Phase 13: production-safe public membership and sponsorship submission backend.
-- The public UI must use security-definer RPCs instead of relying on browser-side
-- table permissions for transactional writes.

create sequence if not exists public.members_number_seq;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  member_number bigint not null unique default nextval('public.members_number_seq'),
  alias text not null,
  contact_type text not null check (contact_type in ('whatsapp','email')),
  contact_value text not null,
  contact_key text not null unique,
  referred_by_member_id uuid null references public.members(id) on delete set null,
  statute_version text not null default 'v1',
  signature_present boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  since timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_alias_length check (char_length(btrim(alias)) between 2 and 20),
  constraint members_contact_length check (char_length(contact_value) between 5 and 120),
  constraint members_code_format check (code ~ '^[A-Z0-9]{6}$')
);

alter sequence public.members_number_seq owned by public.members.member_number;

create index if not exists members_referred_by_idx on public.members(referred_by_member_id);
create index if not exists members_since_idx on public.members(since desc);
create index if not exists members_status_idx on public.members(status);

alter table public.members enable row level security;

revoke all on public.members from anon, authenticated;
create or replace function public.join_union(
  p_alias text,
  p_contact_type text,
  p_contact_value text,
  p_referred_by text default null,
  p_statute_version text default 'v1',
  p_signature_present boolean default false
)
returns table (
  code text,
  member_number bigint,
  alias text,
  since timestamptz,
  already_member boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alias text := btrim(coalesce(p_alias, ''));
  v_contact_type text := lower(btrim(coalesce(p_contact_type, '')));
  v_contact_value text := btrim(coalesce(p_contact_value, ''));
  v_contact_key text;
  v_referred_by uuid;
  v_existing_code text;
  v_code text;
  v_number bigint;
  v_since timestamptz;
begin
  if char_length(v_alias) < 2 or char_length(v_alias) > 20 then
    raise exception using errcode = '22023', message = 'CODINOME_INVALIDO';
  end if;

  if v_contact_type not in ('whatsapp','email') then
    raise exception using errcode = '22023', message = 'CONTACTO_INVALIDO';
  end if;

  if coalesce(p_signature_present, false) is not true then
    raise exception using errcode = '22023', message = 'ASSINATURA_OBRIGATORIA';
  end if;

  if char_length(v_contact_value) < 5 or char_length(v_contact_value) > 120 then
    raise exception using errcode = '22023', message = 'CONTACTO_INVALIDO';
  end if;

  if v_contact_type = 'email' then
    v_contact_value := lower(v_contact_value);
  end if;

  v_contact_key := v_contact_type || ':' ||
    lower(regexp_replace(v_contact_value, '[^a-zA-Z0-9@._+]', '', 'g'));

  if v_contact_type = 'email'
     and v_contact_value !~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'EMAIL_INVALIDO';
  end if;

  if v_contact_type = 'whatsapp'
     and v_contact_value !~ '^\\+?[0-9][0-9 .()\\-]{4,}$' then
    raise exception using errcode = '22023', message = 'WHATSAPP_INVALIDO';
  end if;

  select m.id
    into v_referred_by
  from public.members m
  where m.code = upper(btrim(coalesce(p_referred_by, '')))
    and m.status = 'active'
  limit 1;

  select m.code
    into v_existing_code
  from public.members m
  where m.contact_key = v_contact_key
  limit 1;

  if v_existing_code is not null then
    return query
    select null::text, null::bigint, null::text, null::timestamptz, true;
    return;
  end if;

  v_code := substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 6);

  while exists (
    select 1
    from public.members m
    where m.code = v_code
  ) loop
    v_code := substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 6);
  end loop;

  insert into public.members (
    code,
    alias,
    contact_type,
    contact_value,
    contact_key,
    referred_by_member_id,
    statute_version,
    signature_present
  )
  values (
    v_code,
    v_alias,
    v_contact_type,
    v_contact_value,
    v_contact_key,
    v_referred_by,
    coalesce(nullif(btrim(p_statute_version), ''), 'v1'),
    coalesce(p_signature_present, false)
  )
  returning public.members.member_number, public.members.since
    into v_number, v_since;

  return query
  select v_code, v_number, v_alias, v_since, false;
exception
  when unique_violation then
    return query
    select null::text, null::bigint, null::text, null::timestamptz, true;
end;
$$;

revoke all on function public.join_union(text,text,text,text,text,boolean) from public;
grant execute on function public.join_union(text,text,text,text,text,boolean) to anon, authenticated;

create or replace function public.member_public(p_code text)
returns table (
  code text,
  member_number bigint,
  alias text,
  since timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select m.code, m.member_number, m.alias, m.since
  from public.members m
  where m.code = upper(btrim(coalesce(p_code, '')))
    and m.status = 'active'
  limit 1;
$$;

revoke all on function public.member_public(text) from public;
grant execute on function public.member_public(text) to anon, authenticated;

create or replace function public.member_count()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select count(*)::bigint
  from public.members
  where status = 'active';
$$;

revoke all on function public.member_count() from public;
grant execute on function public.member_count() to anon, authenticated;

create or replace function public.delegados()
returns table (
  alias text,
  referrals bigint
)
language sql
security definer
set search_path = ''
as $$
  select ref.alias, count(*)::bigint as referrals
  from public.members ref
  join public.members recruited
    on recruited.referred_by_member_id = ref.id
   and recruited.status = 'active'
  where ref.status = 'active'
  group by ref.id, ref.alias
  order by count(*) desc, min(ref.member_number) asc
  limit 10;
$$;

revoke all on function public.delegados() from public;
grant execute on function public.delegados() to anon, authenticated;

-- Sponsorship proposals use a security-definer RPC so the public form
-- never depends on an RLS INSERT policy being interpreted by a specific proxy.
do $
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.partnership_requests'::regclass
      and conname = 'partnership_requests_name_length'
  ) then
    alter table public.partnership_requests
      add constraint partnership_requests_name_length
      check (char_length(btrim(name)) between 2 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.partnership_requests'::regclass
      and conname = 'partnership_requests_company_length'
  ) then
    alter table public.partnership_requests
      add constraint partnership_requests_company_length
      check (char_length(btrim(company)) between 2 and 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.partnership_requests'::regclass
      and conname = 'partnership_requests_contact_length'
  ) then
    alter table public.partnership_requests
      add constraint partnership_requests_contact_length
      check (char_length(btrim(contact)) between 3 and 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.partnership_requests'::regclass
      and conname = 'partnership_requests_type_length'
  ) then
    alter table public.partnership_requests
      add constraint partnership_requests_type_length
      check (char_length(btrim(partnership_type)) between 2 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.partnership_requests'::regclass
      and conname = 'partnership_requests_message_length'
  ) then
    alter table public.partnership_requests
      add constraint partnership_requests_message_length
      check (char_length(btrim(message)) between 10 and 4000);
  end if;
end $;

drop policy if exists "partnership_requests_public_insert" on public.partnership_requests;

create or replace function public.submit_partnership_request(
  p_name text,
  p_company text,
  p_contact text,
  p_partnership_type text,
  p_budget text default '',
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_company text := btrim(coalesce(p_company, ''));
  v_contact text := btrim(coalesce(p_contact, ''));
  v_type text := btrim(coalesce(p_partnership_type, ''));
  v_budget text := btrim(coalesce(p_budget, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if char_length(v_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'NOME_INVALIDO';
  end if;
  if char_length(v_company) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'EMPRESA_INVALIDA';
  end if;
  if char_length(v_contact) not between 3 and 160 then
    raise exception using errcode = '22023', message = 'CONTACTO_INVALIDO';
  end if;
  if char_length(v_type) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'PARCERIA_INVALIDA';
  end if;
  if char_length(v_message) not between 10 and 4000 then
    raise exception using errcode = '22023', message = 'MENSAGEM_INVALIDA';
  end if;
  if char_length(v_budget) > 80 then
    raise exception using errcode = '22023', message = 'ORCAMENTO_INVALIDO';
  end if;

  insert into public.partnership_requests (
    name,
    company,
    contact,
    partnership_type,
    budget,
    message,
    status
  )
  values (
    v_name,
    v_company,
    v_contact,
    v_type,
    v_budget,
    v_message,
    'new'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_partnership_request(text,text,text,text,text,text) from public;
grant execute on function public.submit_partnership_request(text,text,text,text,text,text) to anon, authenticated;
