-- Phase 13.1: harden membership contact validation after production rollout.

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
  v_digits text;
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
    if position('@' in v_contact_value) <= 1
      or position('@' in reverse(v_contact_value)) <= 1
      or position('.' in split_part(v_contact_value, '@', 2)) <= 1 then
      raise exception using errcode = '22023', message = 'EMAIL_INVALIDO';
    end if;
    if v_contact_value ~ '[[:space:]]' then
      raise exception using errcode = '22023', message = 'EMAIL_INVALIDO';
    end if;
  else
    v_digits := regexp_replace(v_contact_value, '[^0-9]', '', 'g');
    if char_length(v_digits) < 5
      or v_contact_value ~ '[^0-9 .()+-]' then
      raise exception using errcode = '22023', message = 'WHATSAPP_INVALIDO';
    end if;
  end if;

  v_contact_key := v_contact_type || ':' ||
    lower(regexp_replace(v_contact_value, '[^a-zA-Z0-9@._+]', '', 'g'));

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
