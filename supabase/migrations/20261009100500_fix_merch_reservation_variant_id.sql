create or replace function public.create_public_merch_reservation(
  p_product_id text,
  p_product_name text,
  p_variant_id text,
  p_size text,
  p_alias text,
  p_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_code text;
  v_alias text;
  v_size text;
begin
  if nullif(btrim(p_product_id), '') is null then raise exception 'PRODUTO_OBRIGATORIO'; end if;
  if nullif(btrim(p_product_name), '') is null then raise exception 'NOME_PRODUTO_OBRIGATORIO'; end if;
  if nullif(btrim(p_size), '') is null then raise exception 'TAMANHO_OBRIGATORIO'; end if;
  if p_price is null or p_price < 0 then raise exception 'PRECO_INVALIDO'; end if;

  v_alias := left(coalesce(nullif(btrim(p_alias), ''), 'ANÓNIMO'), 120);
  v_size := left(btrim(p_size), 40);
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.reservations (
    product_id, variant_id, product_name, size, alias, quantity, unit_price, status, code, reference
  ) values (
    left(btrim(p_product_id), 160),
    nullif(left(btrim(coalesce(p_variant_id, '')), 160), ''),
    left(btrim(p_product_name), 200),
    v_size,
    v_alias,
    1,
    p_price,
    'new',
    v_code,
    v_code
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'code', v_code, 'reference', v_code, 'serial_number', null, 'status', 'new');
end;
$$;
revoke all on function public.create_public_merch_reservation(text, text, text, text, text, numeric) from public;
grant execute on function public.create_public_merch_reservation(text, text, text, text, text, numeric) to anon, authenticated;
