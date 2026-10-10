-- CAMPING V2 / Phase 5 canonical backend baseline
-- Additive reconciliation for the existing production project. No existing business rows are deleted.
-- Existing authored roster: exactly 17 profiles from src/lib/artist-profiles.ts. No member 018 is invented.
-- Static merch placeholder prices/stock and placeholder gallery slots are intentionally NOT seeded as production data.

-- 1. Control Room identity and authoritative role checks.
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ADMIN',
  role text not null check (role in ('OWNER','ADMIN','EDITOR','PARTNERSHIPS','MERCH')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_profiles enable row level security;

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ap.role
  from public.admin_profiles ap
  where ap.user_id = auth.uid()
    and ap.active = true
  limit 1;
$$;
revoke all on function public.current_admin_role() from public;
grant execute on function public.current_admin_role() to authenticated;

-- Bootstrap an OWNER only when this project has exactly one confirmed Auth account.
-- If more users already exist, no privilege is guessed or granted automatically.
insert into public.admin_profiles(user_id, display_name, role, active)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'full_name',''),
                nullif(u.raw_user_meta_data->>'name',''),
                split_part(coalesce(u.email,'ADMIN'),'@',1)),
       'OWNER', true
from auth.users u
where u.email_confirmed_at is not null
  and (select count(*) from auth.users confirmed where confirmed.email_confirmed_at is not null) = 1
on conflict (user_id) do nothing;

-- 2. Canonical editorial source tables.
create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  code text not null unique,
  name text not null,
  bio text not null default '',
  frase text not null default '',
  zona text not null default '',
  faixas text[] not null default '{}'::text[],
  role text not null default 'TRAP',
  studio text not null default 'STUDIO XOYENS',
  edition text not null default '01',
  presence text not null default 'ACTIVA',
  spotify_artist_id text,
  photo_url text,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists artists_public_order_idx on public.artists(status,position,code);

create table if not exists public.artist_releases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  youtube_id text,
  spotify_url text,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(artist_id,position)
);
create index if not exists artist_releases_public_idx on public.artist_releases(artist_id,status,position);

create table if not exists public.artist_socials (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  platform text not null,
  url text not null,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(artist_id,platform)
);

create table if not exists public.tapes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  feat text not null default '',
  dur text not null default '0:30',
  src text not null,
  cover_url text,
  description text not null default '',
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tapes_public_order_idx on public.tapes(status,position);

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  cover_url text,
  artist_id uuid null references public.artists(id) on delete set null,
  published_at timestamptz,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists releases_public_order_idx on public.releases(status,position);

create table if not exists public.beats (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  producer text not null,
  bpm integer check (bpm is null or bpm between 30 and 300),
  key_signature text,
  preview_url text,
  audio_url text,
  price numeric(12,2) check (price is null or price >= 0),
  currency text not null default 'MZN',
  licence_terms text,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists beats_public_order_idx on public.beats(status,position);

create table if not exists public.camping_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  number text not null default '',
  title text not null,
  description text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive','scheduled','live','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.camping_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid null references public.camping_events(id) on delete set null,
  slug text unique,
  day integer not null default 1 check (day between 1 and 999),
  title text not null,
  room_id text not null default 'estudio',
  room_name text not null default 'ESTÚDIO',
  gallery_tag text not null default 'CABINE',
  starts_at timestamptz,
  ends_at timestamptz,
  description text not null default '',
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive','scheduled','live','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists camping_sessions_public_idx on public.camping_sessions(status,day,starts_at);

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

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type text not null default 'image',
  storage_url text,
  public_url text,
  url text,
  storage_path text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  format text,
  mime_type text,
  uploader_user_id uuid references auth.users(id) on delete set null,
  alt_text text not null default '',
  tags text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_assets_public_idx on public.media_assets(status,created_at desc);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  type text not null check (type in ('image','video')),
  url text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  poster_url text,
  poster_media_asset_id uuid references public.media_assets(id) on delete set null,
  alt text not null default 'Registo visual da Sala de Revelação',
  caption text not null default '',
  tag text not null default 'REVELAÇÃO',
  roll text not null default 'CABINE',
  day integer not null default 1 check (day between 1 and 999),
  timecode text not null default '00:00',
  ratio text not null default '4:3' check (ratio in ('4:3','3:4')),
  downloadable boolean not null default false,
  download_name text,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gallery_items_public_idx on public.gallery_items(status,position);

create table if not exists public.revelation_media (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'image' check (type in ('image','video')),
  url text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  poster_url text,
  poster_media_asset_id uuid references public.media_assets(id) on delete set null,
  alt text not null default 'Registo visual da Sala de Revelação',
  caption text not null default '',
  tag text not null default 'REVELAÇÃO',
  roll text not null default 'CABINE',
  day integer not null default 1 check (day between 1 and 999),
  timecode text not null default '00:00',
  ratio text not null default '4:3' check (ratio in ('4:3','3:4')),
  downloadable boolean not null default false,
  download_name text,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists revelation_media_public_idx on public.revelation_media(status,position);

-- 3. Server-authoritative merchandise catalog. Empty catalog is intentional until real stock is entered.
create table if not exists public.merch_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  code text not null unique,
  name text not null,
  subtitle text not null default '',
  spec text not null default '',
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'MZN',
  image_url text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  detail text[] not null default '{}'::text[],
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists merch_products_public_idx on public.merch_products(status,position);

create table if not exists public.merch_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.merch_products(id) on delete cascade,
  sku text,
  size text not null,
  stock_total integer not null default 0 check (stock_total >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0),
  stock_sold integer not null default 0 check (stock_sold >= 0),
  status text not null default 'inactive' check (status in ('active','inactive','draft','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,size),
  check (stock_reserved + stock_sold <= stock_total)
);
create index if not exists merch_variants_product_idx on public.merch_variants(product_id,status,size);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.merch_variants(id) on delete restrict,
  movement_type text not null check (movement_type in ('opening','adjustment','reservation','reservation_release','sale')),
  quantity integer not null check (quantity <> 0),
  reference text,
  notes text not null default '',
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_variant_idx on public.inventory_movements(variant_id,created_at desc);

-- 4. Radio: reuse the single existing Frequência 808 service, never create a second player.
create table if not exists public.radio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default 'SINDICATO 808',
  artist_slug text,
  audio_url text not null,
  duration_seconds numeric,
  kind text not null default 'music' check (kind in ('music','jingle','sfx')),
  status text not null default 'draft',
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
create index if not exists radio_tracks_public_idx on public.radio_tracks(status,position);

create table if not exists public.radio_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  track_ids uuid[] not null default '{}'::uuid[],
  active boolean not null default true,
  randomize boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.radio_station (
  id smallint primary key default 1 check (id = 1),
  station_name text not null default 'RÁDIO SINDICATO DO TRAP',
  station_tag_url text not null default '/audio/Frequencia_808_tag.mp3',
  active_block_id uuid references public.radio_blocks(id) on delete set null,
  forced_track_id uuid references public.radio_tracks(id) on delete set null,
  forced_started_at timestamptz,
  autoplay boolean not null default true,
  station_seed bigint not null default 8080808,
  crossfade_ms integer not null default 650 check (crossfade_ms between 0 and 1200),
  tag_interval integer not null default 3 check (tag_interval between 1 and 9),
  updated_at timestamptz not null default now()
);

create table if not exists public.frequency_station (
  id smallint primary key default 1 check (id = 1),
  station_started_at timestamptz not null default now(),
  program_seed bigint not null default 8080808,
  updated_at timestamptz not null default now()
);
create table if not exists public.frequency_listeners (
  sid text primary key,
  last_seen timestamptz not null default now(),
  check (char_length(sid) between 4 and 64)
);
create table if not exists public.frequency_badges (
  code text primary key,
  badge text not null default 'OUVINTE DA MADRUGADA',
  earned_at timestamptz not null default now()
);

-- 5. Site configuration and analytics.
create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default 'null'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null default '',
  subtitle text not null default '',
  description text not null default '',
  content jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drop_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  title text not null default '',
  description text not null default '',
  drop_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  marquee text,
  status text not null default 'draft' check (status in ('draft','ready','published','archived','active','inactive','scheduled','live','ended')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  changed_fields text[] not null default '{}'::text[],
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  sid text not null,
  name text not null check (name in (
    'gate_open','tape_play','tape_10s','key_earned','merch_view','cart_add','reserve','proof_sent',
    'join_start','join_done','card_share','selo_found','live_notify','artist_view','sponsor_click',
    'radio_start','radio_pause','radio_resume','radio_stop','radio_track_start','radio_track_25',
    'radio_track_50','radio_track_75','radio_track_end','radio_track_error','radio_skip','spotify_open',
    'radio_session_start','camping_enter','camping_interaction'
  )),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (char_length(sid) between 4 and 64),
  check (jsonb_typeof(props) = 'object')
);
create index if not exists events_created_idx on public.events(created_at desc);

-- 6. Seed only authored, already-published content and existing shipped audio.
WITH seed(slug,code,name,bio,frase,zona,faixas,role,studio,edition,presence,spotify_artist_id,photo_url,position) AS (
  VALUES
    ('khriys', 'SDT-01', 'Khriys', 'Primeiro a chegar, último a sair. Escreve no telemóvel entre takes.', 'Rima fria, coração quente.', 'Maputo · Malhangalene', ARRAY['ph4nt0mmm_intr0']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '2zLSeGbduePeKdpiuRYSry', '/__l5e/assets-v1/3ca51b71-9b82-4727-9957-fd3763ba89e5/a01.jpg', 1),
    ('kong-v12', 'SDT-02', 'KongV12', 'Flow de metralhadora e ad-libs que viram hino na sala.', 'Sem plano B.', 'Matola · Liberdade', ARRAY['PHANTOM MODE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '78YVPqfXcElqqfwbR1Egus', '/__l5e/assets-v1/dcfd0297-cf1d-4909-878c-e565fe7cc304/a02.jpg', 2),
    ('bruno-the-goat', 'SDT-03', 'Bruno The Goat', 'Abriu A Nova Wave numa só take. Voz grave, presença pesada.', 'O cabrito não pede licença.', 'Maputo · Polana Caniço', ARRAY['A NOVA WAVE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '0ZOd9IlBNOIDPKIYUKkPHp', '/__l5e/assets-v1/e2b96ec6-5924-44ba-8061-c168f64e134e/a03.jpg', 3),
    ('masepurp', 'SDT-04', 'Masepurp', 'Melodia arrastada, auto-tune no talo, vibe noturna.', 'Roxo no copo, ouro na voz.', 'Maputo · Xipamanine', ARRAY['PHANTOM MODE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '7uOMkYjLobQzJdO5LaNuwL', '/__l5e/assets-v1/6d3f4cc8-bbc1-4f75-b123-172274968c1e/a04.jpg', 4),
    ('kingston-siriro', 'SDT-05', 'Kingston Siriro', 'Moda e trap no mesmo verso. Comandou a FASHIION D''PHANTOM.', 'Estilo não se compra.', 'Maputo · Sommerschield', ARRAY['FASHIION D''PHANTOM']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '0V8GXIuiejkGA6m0159YNl', '/__l5e/assets-v1/afc68f87-477b-49b1-833f-a8a75f85e4f2/a05b.jpg', 5),
    ('kaka-machava', 'SDT-06', 'Kaká Machava', 'Chegou com o refrão pronto. Saiu com a sala toda a cantar.', 'Fala pouco, fere muito.', 'Matola · Fomento', ARRAY['FASHIION D''PHANTOM']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '52sVhfDGmWOXmaiddgfWix', '/__l5e/assets-v1/7e1db53d-07f0-4fe5-adf8-86484b2f9760/a06.jpg', 6),
    ('twista', 'SDT-07', 'Twista', 'Double-time sem respirar. Escreve em cima do beat a correr.', 'Gira o mundo, volta pra rua.', 'Maputo · Hulene', ARRAY['A NOVA WAVE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '3c2TqwIinkQvVK0JYPYrLR', '/__l5e/assets-v1/012005f8-e144-4f2c-9f1a-4643d7141ba0/a07.jpg', 7),
    ('txopheer-wawa', 'SDT-08', 'Txopheer Wawa', 'Energia de palco dentro da cabine. Grita os ad-libs sozinho.', 'Wawa nunca dorme.', 'Maputo · Mafalala', ARRAY['PHANTOM MODE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '5GBgb1VlOXQN5jBu6Z3zMk', '/__l5e/assets-v1/d9ff908b-39f3-442d-87a1-cdbc4cb3a98f/a08.jpg', 8),
    ('cipher', 'SDT-09', 'Cipher', 'Letra cifrada, punchlines escondidas. Ouve duas vezes.', 'Código fechado.', 'Maputo · Alto Maé', ARRAY['ph4nt0mmm_intr0']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '5xbGmD0sbNSmqXj3VzsSZY', '/__l5e/assets-v1/ad1fb2dc-ff3a-4f5a-a6fa-ba379279c14c/a09.jpg', 9),
    ('5ir0w', 'SDT-10', '5ir0w', 'Produz e rima. Mexeu nos 808 da sessão inteira.', 'Zero sinal, só som.', 'Matola · Machava', ARRAY['A NOVA WAVE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '3xn6GYqDbmzCbkJtvdlbRF', '/__l5e/assets-v1/dc69f6b6-1438-4abd-8c45-36e54a36057b/a10.jpg', 10),
    ('pita-shana', 'SDT-11', 'Pita Shana', 'Voz cortante, presença de capa. Entrou e mudou o clima.', 'Rainha da sombra.', 'Maputo · Central', ARRAY['FASHIION D''PHANTOM']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '0MYxw3F13ZkgVex2ztSfeb', '/__l5e/assets-v1/61caa7fe-4a5a-48ea-ae1b-c1544e932ae4/a11.jpg', 11),
    ('keew080', 'SDT-12', 'Keew080', 'Dono do bounce. Cada verso tem um gancho.', '808 no sangue.', 'Maputo · Chamanculo', ARRAY['PHANTOM MODE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '63M4Lo07MGOC1eEaVAXIMo', '/__l5e/assets-v1/8db60002-3577-48d8-b8c7-14767e8cae04/a12.jpg', 12),
    ('reinaldo-king', 'SDT-13', 'Reinaldo King', 'Rei das madrugadas no estúdio. Grava quando todos já foram.', 'Coroa de rua.', 'Matola · T3', ARRAY['A NOVA WAVE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '3wnx882xKoP5KKfbgRCOIZ', '/__l5e/assets-v1/ae87c626-f23a-46cb-b08b-8cbb15ad173a/a13.jpg', 13),
    ('kametee', 'SDT-14', 'Kametee', 'Começa sussurrado, acaba a rasgar. Imprevisível.', 'Calma antes do caos.', 'Maputo · Maxaquene', ARRAY['ph4nt0mmm_intr0']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '0MtXCW1LGdsVwyYpLsslZy', '/__l5e/assets-v1/8650b3aa-0fcb-4536-9acc-57681b8ee72b/a14.jpg', 14),
    ('herkey-hk', 'SDT-15', 'Herkey HK', 'Herkey HK é um artista de Maputo ligado ao trap e à cultura urbana. No Sindicato, integra a sessão PHANTOM MODE e o arquivo do Studio XOYENS.', 'HK no beat, HK na rua.', 'Maputo · Laulane', ARRAY['PHANTOM MODE']::text[], 'MELÓDICO / TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '2g183yVpFQpPrLtBhOy8zF', '/__l5e/assets-v1/07ab25e7-e7d3-4287-abf9-f0689bde4f99/a15.jpg', 15),
    ('skyler', 'SDT-16', 'Skyler', 'Voz aérea por cima de 808 pesado. Contraste puro.', 'Céu é o limite? Nem.', 'Maputo · Zimpeto', ARRAY['FASHIION D''PHANTOM']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '3BsJWmIWPWDtnNf2ppYa8c', '/__l5e/assets-v1/f9f45301-7ad1-45fc-8fc8-829fa6aa534a/a16.jpg', 16),
    ('3go', 'SDT-17', '3go', 'O mais novo da escalação. Chegou a provar — e provou.', 'Três letras, mil barras.', 'Matola · Khongolote', ARRAY['A NOVA WAVE']::text[], 'TRAP', 'STUDIO XOYENS', '01', 'ACTIVA', '7a0U3cgTT4uStYXnZJFXgs', '/__l5e/assets-v1/d115cdcf-68cb-403f-9cec-e9f25a077dff/a17.jpg', 17)
)
INSERT INTO public.artists(slug,code,name,bio,frase,zona,faixas,role,studio,edition,presence,spotify_artist_id,photo_url,position,status)
SELECT slug,code,name,bio,frase,zona,faixas,role,studio,edition,presence,spotify_artist_id,photo_url,position,'published'
FROM seed
ON CONFLICT (slug) DO NOTHING;

WITH seed(slug,position,title,youtube_id,status) AS (
  VALUES
    ('khriys', 1, 'Lançamento 01', 'XKzbL5wsFNw', 'published'),
    ('khriys', 2, 'Lançamento 02', 'yeqKHuM_NXM', 'published'),
    ('khriys', 3, 'Lançamento 03', 'RJNhU3afjT0', 'published'),
    ('kong-v12', 1, 'Lançamento 01', 'KJKkbNXcqfE', 'published'),
    ('kong-v12', 2, 'Lançamento 02', '9a5hsYvddSw', 'published'),
    ('kong-v12', 3, 'Lançamento 03', 'TpPc2dIKcKY', 'published'),
    ('bruno-the-goat', 1, 'Lançamento 01', 'UNRJZB2sd7o', 'published'),
    ('bruno-the-goat', 2, 'Lançamento 02', 'RvPESv5C8I0', 'published'),
    ('bruno-the-goat', 3, 'Lançamento 03', 'QKFQmEvAzKA', 'published'),
    ('masepurp', 1, 'Lançamento 01', '1tfLq0VraiQ', 'published'),
    ('masepurp', 2, 'Lançamento 02', 'vbb5RJTRv04', 'published'),
    ('masepurp', 3, 'Lançamento 03', 'wecXt8accQk', 'published'),
    ('kingston-siriro', 1, 'Lançamento 01', 'RgumO1E_7q4', 'published'),
    ('kingston-siriro', 2, 'Lançamento 02', '3rFGkLU_byw', 'published'),
    ('kingston-siriro', 3, 'Lançamento 03', 'ATjMF69GV10', 'published'),
    ('kaka-machava', 1, 'Lançamento 01', 'mhX0o3hGisg', 'published'),
    ('kaka-machava', 2, 'Lançamento 02', 'CzhomfU1AyA', 'published'),
    ('kaka-machava', 3, 'Lançamento 03', 'hXjLPOKhbJg', 'published'),
    ('twista', 1, 'Lançamento 01', 'VUwGqPWlrxI', 'published'),
    ('twista', 2, 'Lançamento 02', 'p5PxNepr0Ww', 'published'),
    ('twista', 3, 'Lançamento 03', 'yDUQ3-5XnT4', 'published'),
    ('txopheer-wawa', 1, 'Lançamento 01', 'zs9pRhWzxi4', 'published'),
    ('txopheer-wawa', 2, 'Lançamento 02', 'rQ3v4CT1YZQ', 'published'),
    ('txopheer-wawa', 3, 'Lançamento 03', 'NkCbNUx7xUU', 'published'),
    ('cipher', 1, 'Lançamento 01', 'kj5rPWCf1Ro', 'published'),
    ('cipher', 2, 'Lançamento 02', 'ZLwqokBhqbQ', 'published'),
    ('cipher', 3, 'Lançamento 03', 'P-dnE_-1AVs', 'published'),
    ('5ir0w', 1, 'Lançamento 01', 'iJfHBXcssns', 'published'),
    ('5ir0w', 2, 'Lançamento 02', '4qkmugBjSbc', 'published'),
    ('5ir0w', 3, 'Lançamento 03', 'qc4fe0BjQQU', 'published'),
    ('pita-shana', 1, 'Lançamento 01', '8nm7U2yhEoc', 'published'),
    ('pita-shana', 2, 'Lançamento 02', 'OlhZwxQQ3ZM', 'published'),
    ('pita-shana', 3, 'Lançamento 03', 'c8-WV3DG8ZM', 'published'),
    ('keew080', 1, 'Lançamento 01', 'AqNsJCaa8kI', 'published'),
    ('keew080', 2, 'Lançamento 02', 'NwP4mUA-to0', 'published'),
    ('keew080', 3, 'Lançamento 03', 'A8ZhoDHcPRk', 'published'),
    ('reinaldo-king', 1, 'Lançamento 01', 'CrSRCHJU5c4', 'published'),
    ('reinaldo-king', 2, 'Lançamento 02', 'V9Ler_77JHE', 'published'),
    ('reinaldo-king', 3, 'Lançamento 03', '7J5b0kE_c_w', 'published'),
    ('kametee', 1, 'Lançamento 01', 'N-AQkMGjpNI', 'published'),
    ('kametee', 2, 'Lançamento 02', 'eWogXs9IUDY', 'published'),
    ('kametee', 3, 'Lançamento 03', 'BbzZETffYPA', 'published'),
    ('herkey-hk', 1, 'Lançamento 01', '7J5b0kE_c_w', 'published'),
    ('herkey-hk', 2, 'Lançamento 02', '_T5Bv7BKTPQ', 'published'),
    ('herkey-hk', 3, 'Lançamento 03', '6JUypUpQ7l4', 'published'),
    ('skyler', 1, 'Lançamento 01', 'CLXEDmeQ7IU', 'published'),
    ('skyler', 2, 'Lançamento 02', 'xit5C-wY-GE', 'published'),
    ('skyler', 3, 'Lançamento 03', 'KJKkbNXcqfE', 'published'),
    ('3go', 1, 'Lançamento 01', 'N-AQkMGjpNI', 'published'),
    ('3go', 2, 'Lançamento 02', '8e7uROy4UOs', 'published'),
    ('3go', 3, 'Lançamento 03', 'QEQnzob8wLk', 'published')
)
INSERT INTO public.artist_releases(artist_id,position,title,youtube_id,status)
SELECT a.id,s.position,s.title,s.youtube_id,s.status
FROM seed s JOIN public.artists a ON a.slug=s.slug
ON CONFLICT (artist_id,position) DO NOTHING;

WITH seed(slug,platform,url,status,position) AS (
  VALUES
    ('khriys', 'spotify', 'https://open.spotify.com/artist/2zLSeGbduePeKdpiuRYSry', 'published', 1),
    ('kong-v12', 'spotify', 'https://open.spotify.com/artist/78YVPqfXcElqqfwbR1Egus', 'published', 1),
    ('bruno-the-goat', 'spotify', 'https://open.spotify.com/artist/0ZOd9IlBNOIDPKIYUKkPHp', 'published', 1),
    ('masepurp', 'spotify', 'https://open.spotify.com/artist/7uOMkYjLobQzJdO5LaNuwL', 'published', 1),
    ('kingston-siriro', 'spotify', 'https://open.spotify.com/artist/0V8GXIuiejkGA6m0159YNl', 'published', 1),
    ('kaka-machava', 'spotify', 'https://open.spotify.com/artist/52sVhfDGmWOXmaiddgfWix', 'published', 1),
    ('twista', 'spotify', 'https://open.spotify.com/artist/3c2TqwIinkQvVK0JYPYrLR', 'published', 1),
    ('txopheer-wawa', 'spotify', 'https://open.spotify.com/artist/5GBgb1VlOXQN5jBu6Z3zMk', 'published', 1),
    ('cipher', 'spotify', 'https://open.spotify.com/artist/5xbGmD0sbNSmqXj3VzsSZY', 'published', 1),
    ('5ir0w', 'spotify', 'https://open.spotify.com/artist/3xn6GYqDbmzCbkJtvdlbRF', 'published', 1),
    ('pita-shana', 'spotify', 'https://open.spotify.com/artist/0MYxw3F13ZkgVex2ztSfeb', 'published', 1),
    ('keew080', 'spotify', 'https://open.spotify.com/artist/63M4Lo07MGOC1eEaVAXIMo', 'published', 1),
    ('reinaldo-king', 'spotify', 'https://open.spotify.com/artist/3wnx882xKoP5KKfbgRCOIZ', 'published', 1),
    ('kametee', 'spotify', 'https://open.spotify.com/artist/0MtXCW1LGdsVwyYpLsslZy', 'published', 1),
    ('herkey-hk', 'spotify', 'https://open.spotify.com/artist/2g183yVpFQpPrLtBhOy8zF', 'published', 1),
    ('skyler', 'spotify', 'https://open.spotify.com/artist/3BsJWmIWPWDtnNf2ppYa8c', 'published', 1),
    ('3go', 'spotify', 'https://open.spotify.com/artist/7a0U3cgTT4uStYXnZJFXgs', 'published', 1)
)
INSERT INTO public.artist_socials(artist_id,platform,url,status,position)
SELECT a.id,s.platform,s.url,s.status,s.position
FROM seed s JOIN public.artists a ON a.slug=s.slug
ON CONFLICT (artist_id,platform) DO NOTHING;

WITH seed(slug,title,feat,dur,src,position,status) AS (
  VALUES
    ('a-nova-wave', 'A NOVA WAVE', 'Bruno The GOAT, Elton Penicela, Alemão Wavv', '0:30', '/__l5e/assets-v1/de780939-cc1e-421b-8809-f701eac59121/nova-wave.mp3', 1, 'published'),
    ('phantom-mode', 'PHANTOM MODE', 'INF8M8US', '0:30', '/__l5e/assets-v1/83f687a6-7f2d-4fb0-9b43-7315c792e889/phantom-mode.mp3', 2, 'published'),
    ('fashiion-d-phantom', 'FASHIION D''PHANTOM', 'Kingston Siriro, Kaká Machava, Elton Penicela', '0:30', '/__l5e/assets-v1/57cac7f8-4a3c-4b7a-8921-29388037657e/fashiion.mp3', 3, 'published'),
    ('ph4nt0mmm-intr0', 'ph4nt0mmm_intr0', 'PHANTOM', '0:30', '/__l5e/assets-v1/6956f95e-3b6e-44c3-ae9b-620207d3afb7/intro.mp3', 4, 'published')
)
INSERT INTO public.tapes(slug,title,feat,dur,src,position,status)
SELECT slug,title,feat,dur,src,position,status FROM seed
ON CONFLICT (slug) DO NOTHING;

WITH seed(slug,title,subtitle,position,status) AS (
  VALUES
    ('a-nova-wave', 'A NOVA WAVE', 'Bruno The GOAT, Elton Penicela, Alemão Wavv', 1, 'published'),
    ('phantom-mode', 'PHANTOM MODE', 'INF8M8US', 2, 'published'),
    ('fashiion-d-phantom', 'FASHIION D''PHANTOM', 'Kingston Siriro, Kaká Machava, Elton Penicela', 3, 'published'),
    ('ph4nt0mmm-intr0', 'ph4nt0mmm_intr0', 'PHANTOM', 4, 'published')
)
INSERT INTO public.releases(slug,title,subtitle,position,status)
SELECT slug,title,subtitle,position,status FROM seed
ON CONFLICT (slug) DO NOTHING;

WITH seed(id,name,asset_type,storage_url,public_url,url,size_bytes,format,alt_text,tags,status) AS (
  VALUES
    ('3ca51b71-9b82-4727-9957-fd3763ba89e5'::uuid, 'Khriys', 'image', '/__l5e/assets-v1/3ca51b71-9b82-4727-9957-fd3763ba89e5/a01.jpg', '/__l5e/assets-v1/3ca51b71-9b82-4727-9957-fd3763ba89e5/a01.jpg', '/__l5e/assets-v1/3ca51b71-9b82-4727-9957-fd3763ba89e5/a01.jpg', 179121, 'image/jpeg', 'Khriys', ARRAY['context:artists', 'sdt-01']::text[], 'published'),
    ('dcfd0297-cf1d-4909-878c-e565fe7cc304'::uuid, 'KongV12', 'image', '/__l5e/assets-v1/dcfd0297-cf1d-4909-878c-e565fe7cc304/a02.jpg', '/__l5e/assets-v1/dcfd0297-cf1d-4909-878c-e565fe7cc304/a02.jpg', '/__l5e/assets-v1/dcfd0297-cf1d-4909-878c-e565fe7cc304/a02.jpg', 99488, 'image/jpeg', 'KongV12', ARRAY['context:artists', 'sdt-02']::text[], 'published'),
    ('e2b96ec6-5924-44ba-8061-c168f64e134e'::uuid, 'Bruno The Goat', 'image', '/__l5e/assets-v1/e2b96ec6-5924-44ba-8061-c168f64e134e/a03.jpg', '/__l5e/assets-v1/e2b96ec6-5924-44ba-8061-c168f64e134e/a03.jpg', '/__l5e/assets-v1/e2b96ec6-5924-44ba-8061-c168f64e134e/a03.jpg', 248315, 'image/jpeg', 'Bruno The Goat', ARRAY['context:artists', 'sdt-03']::text[], 'published'),
    ('6d3f4cc8-bbc1-4f75-b123-172274968c1e'::uuid, 'Masepurp', 'image', '/__l5e/assets-v1/6d3f4cc8-bbc1-4f75-b123-172274968c1e/a04.jpg', '/__l5e/assets-v1/6d3f4cc8-bbc1-4f75-b123-172274968c1e/a04.jpg', '/__l5e/assets-v1/6d3f4cc8-bbc1-4f75-b123-172274968c1e/a04.jpg', 174588, 'image/jpeg', 'Masepurp', ARRAY['context:artists', 'sdt-04']::text[], 'published'),
    ('afc68f87-477b-49b1-833f-a8a75f85e4f2'::uuid, 'Kingston Siriro', 'image', '/__l5e/assets-v1/afc68f87-477b-49b1-833f-a8a75f85e4f2/a05b.jpg', '/__l5e/assets-v1/afc68f87-477b-49b1-833f-a8a75f85e4f2/a05b.jpg', '/__l5e/assets-v1/afc68f87-477b-49b1-833f-a8a75f85e4f2/a05b.jpg', 129510, 'image/jpeg', 'Kingston Siriro', ARRAY['context:artists', 'sdt-05']::text[], 'published'),
    ('7e1db53d-07f0-4fe5-adf8-86484b2f9760'::uuid, 'Kaká Machava', 'image', '/__l5e/assets-v1/7e1db53d-07f0-4fe5-adf8-86484b2f9760/a06.jpg', '/__l5e/assets-v1/7e1db53d-07f0-4fe5-adf8-86484b2f9760/a06.jpg', '/__l5e/assets-v1/7e1db53d-07f0-4fe5-adf8-86484b2f9760/a06.jpg', 183445, 'image/jpeg', 'Kaká Machava', ARRAY['context:artists', 'sdt-06']::text[], 'published'),
    ('012005f8-e144-4f2c-9f1a-4643d7141ba0'::uuid, 'Twista', 'image', '/__l5e/assets-v1/012005f8-e144-4f2c-9f1a-4643d7141ba0/a07.jpg', '/__l5e/assets-v1/012005f8-e144-4f2c-9f1a-4643d7141ba0/a07.jpg', '/__l5e/assets-v1/012005f8-e144-4f2c-9f1a-4643d7141ba0/a07.jpg', 140478, 'image/jpeg', 'Twista', ARRAY['context:artists', 'sdt-07']::text[], 'published'),
    ('d9ff908b-39f3-442d-87a1-cdbc4cb3a98f'::uuid, 'Txopheer Wawa', 'image', '/__l5e/assets-v1/d9ff908b-39f3-442d-87a1-cdbc4cb3a98f/a08.jpg', '/__l5e/assets-v1/d9ff908b-39f3-442d-87a1-cdbc4cb3a98f/a08.jpg', '/__l5e/assets-v1/d9ff908b-39f3-442d-87a1-cdbc4cb3a98f/a08.jpg', 151077, 'image/jpeg', 'Txopheer Wawa', ARRAY['context:artists', 'sdt-08']::text[], 'published'),
    ('ad1fb2dc-ff3a-4f5a-a6fa-ba379279c14c'::uuid, 'Cipher', 'image', '/__l5e/assets-v1/ad1fb2dc-ff3a-4f5a-a6fa-ba379279c14c/a09.jpg', '/__l5e/assets-v1/ad1fb2dc-ff3a-4f5a-a6fa-ba379279c14c/a09.jpg', '/__l5e/assets-v1/ad1fb2dc-ff3a-4f5a-a6fa-ba379279c14c/a09.jpg', 156030, 'image/jpeg', 'Cipher', ARRAY['context:artists', 'sdt-09']::text[], 'published'),
    ('dc69f6b6-1438-4abd-8c45-36e54a36057b'::uuid, '5ir0w', 'image', '/__l5e/assets-v1/dc69f6b6-1438-4abd-8c45-36e54a36057b/a10.jpg', '/__l5e/assets-v1/dc69f6b6-1438-4abd-8c45-36e54a36057b/a10.jpg', '/__l5e/assets-v1/dc69f6b6-1438-4abd-8c45-36e54a36057b/a10.jpg', 183863, 'image/jpeg', '5ir0w', ARRAY['context:artists', 'sdt-10']::text[], 'published'),
    ('61caa7fe-4a5a-48ea-ae1b-c1544e932ae4'::uuid, 'Pita Shana', 'image', '/__l5e/assets-v1/61caa7fe-4a5a-48ea-ae1b-c1544e932ae4/a11.jpg', '/__l5e/assets-v1/61caa7fe-4a5a-48ea-ae1b-c1544e932ae4/a11.jpg', '/__l5e/assets-v1/61caa7fe-4a5a-48ea-ae1b-c1544e932ae4/a11.jpg', 158897, 'image/jpeg', 'Pita Shana', ARRAY['context:artists', 'sdt-11']::text[], 'published'),
    ('8db60002-3577-48d8-b8c7-14767e8cae04'::uuid, 'Keew080', 'image', '/__l5e/assets-v1/8db60002-3577-48d8-b8c7-14767e8cae04/a12.jpg', '/__l5e/assets-v1/8db60002-3577-48d8-b8c7-14767e8cae04/a12.jpg', '/__l5e/assets-v1/8db60002-3577-48d8-b8c7-14767e8cae04/a12.jpg', 266449, 'image/jpeg', 'Keew080', ARRAY['context:artists', 'sdt-12']::text[], 'published'),
    ('ae87c626-f23a-46cb-b08b-8cbb15ad173a'::uuid, 'Reinaldo King', 'image', '/__l5e/assets-v1/ae87c626-f23a-46cb-b08b-8cbb15ad173a/a13.jpg', '/__l5e/assets-v1/ae87c626-f23a-46cb-b08b-8cbb15ad173a/a13.jpg', '/__l5e/assets-v1/ae87c626-f23a-46cb-b08b-8cbb15ad173a/a13.jpg', 54774, 'image/jpeg', 'Reinaldo King', ARRAY['context:artists', 'sdt-13']::text[], 'published'),
    ('8650b3aa-0fcb-4536-9acc-57681b8ee72b'::uuid, 'Kametee', 'image', '/__l5e/assets-v1/8650b3aa-0fcb-4536-9acc-57681b8ee72b/a14.jpg', '/__l5e/assets-v1/8650b3aa-0fcb-4536-9acc-57681b8ee72b/a14.jpg', '/__l5e/assets-v1/8650b3aa-0fcb-4536-9acc-57681b8ee72b/a14.jpg', 399405, 'image/jpeg', 'Kametee', ARRAY['context:artists', 'sdt-14']::text[], 'published'),
    ('07ab25e7-e7d3-4287-abf9-f0689bde4f99'::uuid, 'Herkey HK', 'image', '/__l5e/assets-v1/07ab25e7-e7d3-4287-abf9-f0689bde4f99/a15.jpg', '/__l5e/assets-v1/07ab25e7-e7d3-4287-abf9-f0689bde4f99/a15.jpg', '/__l5e/assets-v1/07ab25e7-e7d3-4287-abf9-f0689bde4f99/a15.jpg', 152939, 'image/jpeg', 'Herkey HK', ARRAY['context:artists', 'sdt-15']::text[], 'published'),
    ('f9f45301-7ad1-45fc-8fc8-829fa6aa534a'::uuid, 'Skyler', 'image', '/__l5e/assets-v1/f9f45301-7ad1-45fc-8fc8-829fa6aa534a/a16.jpg', '/__l5e/assets-v1/f9f45301-7ad1-45fc-8fc8-829fa6aa534a/a16.jpg', '/__l5e/assets-v1/f9f45301-7ad1-45fc-8fc8-829fa6aa534a/a16.jpg', 107336, 'image/jpeg', 'Skyler', ARRAY['context:artists', 'sdt-16']::text[], 'published'),
    ('d115cdcf-68cb-403f-9cec-e9f25a077dff'::uuid, '3go', 'image', '/__l5e/assets-v1/d115cdcf-68cb-403f-9cec-e9f25a077dff/a17.jpg', '/__l5e/assets-v1/d115cdcf-68cb-403f-9cec-e9f25a077dff/a17.jpg', '/__l5e/assets-v1/d115cdcf-68cb-403f-9cec-e9f25a077dff/a17.jpg', 196220, 'image/jpeg', '3go', ARRAY['context:artists', 'sdt-17']::text[], 'published')
)
INSERT INTO public.media_assets(id,name,asset_type,storage_url,public_url,url,size_bytes,format,alt_text,tags,status)
SELECT id,name,asset_type,storage_url,public_url,url,size_bytes,format,alt_text,tags,status FROM seed
ON CONFLICT (id) DO NOTHING;

WITH seed(slug,number,title,description,position,status) AS (
  VALUES
    ('estudio','01','Estúdio','Os manos gravam juntos no Studio XOYENS.',1,'published'),
    ('estampa-ao-vivo','02','Estampa ao vivo','Camisetas desenhadas e estampadas na hora.',2,'published'),
    ('visualizers','03','Visualizers','Filmagem dos visuais das faixas.',3,'published'),
    ('fotos','04','Fotos','Sessões de foto durante o camping.',4,'published'),
    ('networking','05','Networking','Conexão entre artistas da cena.',5,'published'),
    ('lives','06','Lives','Sessões transmitidas nas redes.',6,'published')
)
INSERT INTO public.camping_events(slug,number,title,description,position,status)
SELECT slug,number,title,description,position,status FROM seed
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.site_flags(key,value)
VALUES ('live','{"on":false,"url":""}'::jsonb),('CAMP','{"start":null,"end":null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.artist_status(artist_id,status)
SELECT id,'ATIVO' FROM public.artists
ON CONFLICT (artist_id) DO NOTHING;

INSERT INTO public.radio_tracks(id,title,artist,audio_url,duration_seconds,kind,status,rotation_weight,position)
VALUES
 ('00000000-0000-4000-8000-000000000001','A Bag','KHRYIS','/audio/KHRYIS - A Bag.wav',null,'music','published',1,1),
 ('00000000-0000-4000-8000-000000000002','Chopper','KHRYIS','/audio/KHRYIS - Chopper.mp3',null,'music','published',1,2),
 ('00000000-0000-4000-8000-000000000003','Freestyle Sujo','KHRYIS','/audio/KHRYIS - Freestyle Sujo.mp3',null,'music','published',1,3),
 ('00000000-0000-4000-8000-000000000004','I’M Flexin up','KHRYIS','/audio/KHRYIS - I’M Flexin up.mp3',null,'music','published',1,4),
 ('00000000-0000-4000-8000-000000000005','Money Talk','KHRYIS','/audio/KHRYIS - Money Talk.mp3',null,'music','published',1,5),
 ('00000000-0000-4000-8000-000000000006','Tsanto Dough','KHRYIS','/audio/KHRYIS - Tsanto Dough.mp3',null,'music','published',1,6),
 ('00000000-0000-4000-8000-000000000007','FASHIIION D’PHANTOM','PHANTOM, Kingston Siriro, Elton Penicela','/audio/(Unmastered) PHANTOM, Kingston Siriro, Elton Penicela - Fashion de Phantom.mp3',null,'music','published',1,7),
 ('00000000-0000-4000-8000-000000000008','A Nova Wave','PHANTOM, Bruno The GOAT, Alemão Wav, Elton Penicela','/audio/Phantom, Bruno The Goat, Alemão Wav & Elton Penicela - A Nova Wave.mp3',null,'music','published',1,8),
 ('00000000-0000-4000-8000-000000000009','Phantom Mode (The final movie)','PHANTOM, INF8M8US, HeyyG, Kingston Siriro','/audio/PHANTOM Mode 2 - The Final Movie W_ INF8M8US, HEYYG, KINGSTON SIRIRO.mp3',null,'music','published',1,9)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.radio_station(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.frequency_station(id,station_started_at,program_seed)
VALUES (1,now()-interval '6 hours',8080808)
ON CONFLICT (id) DO NOTHING;

WITH seed(key,value,position) AS (
  VALUES
    ('hero_title','"O Sindicato do Trap"'::jsonb,1),
    ('hero_subtitle','"A união do trap. Gravado no camping."'::jsonb,2),
    ('marquee','"1ª EDIÇÃO ✕ 17 ARTISTAS ✕ STUDIO XOYENS ✕ 18.12.2026 ✕ TUDO OU NADA ✕ "'::jsonb,3),
    ('drop_at','"2026-12-18T00:00:00+02:00"'::jsonb,4),
    ('social','{"instagram":"","whatsapp":""}'::jsonb,5)
)
INSERT INTO public.site_settings(key,value,position,status)
SELECT key,value,position,'published' FROM seed
ON CONFLICT (key) DO NOTHING;

WITH seed(key,title,subtitle,description,position) AS (
  VALUES
    ('hero','O Sindicato do Trap','A união do trap. Gravado no camping.',0,'published'),
    ('launch','Lançamento','2026-12-18T00:00:00+02:00',1,'published'),
    ('camping-estudio','Estúdio','Os manos gravam juntos no Studio XOYENS.',2,'published'),
    ('camping-estampa','Estampa ao vivo','Camisetas desenhadas e estampadas na hora.',3,'published'),
    ('camping-visualizers','Visualizers','Filmagem dos visuais das faixas.',4,'published'),
    ('camping-fotos','Fotos','Sessões de foto durante o camping.',5,'published'),
    ('camping-networking','Networking','Conexão entre artistas da cena.',6,'published'),
    ('camping-lives','Lives','Sessões transmitidas nas redes.',7,'published')
)
INSERT INTO public.site_sections(key,title,subtitle,description,position,status)
SELECT key,title,subtitle,description,position,'published' FROM seed
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.drop_campaigns(slug,name,title,description,drop_at,marquee,position,status)
VALUES ('drop-1a-edicao','1ª EDIÇÃO','O Sindicato do Trap','A união do trap. Gravado no camping.','2026-12-18T00:00:00+02:00'::timestamptz,
'1ª EDIÇÃO ✕ 17 ARTISTAS ✕ STUDIO XOYENS ✕ 18.12.2026 ✕ TUDO OU NADA ✕ ',1,'published')
ON CONFLICT (slug) DO NOTHING;

-- 7. Reusable updated_at trigger.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_profiles','artists','artist_releases','artist_socials','tapes','releases','beats',
    'camping_events','camping_sessions','site_flags','artist_status','media_assets','gallery_items',
    'revelation_media','merch_products','merch_variants','radio_tracks','radio_blocks','radio_station',
    'frequency_station','site_settings','site_sections','drop_campaigns'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I',t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',t);
  END LOOP;
END $$;

-- 8. RLS and grants. Public endpoints expose only published content.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'artists','artist_releases','artist_socials','tapes','releases','beats',
    'camping_events','camping_sessions','media_assets','gallery_items','revelation_media',
    'site_settings','site_sections','drop_campaigns'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','public read published',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (status IN (''published'',''ready'',''active'',''live''))','public read published',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','admin manage published content',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_admin_role() IN (''OWNER'',''ADMIN'',''EDITOR'')) WITH CHECK (public.current_admin_role() IN (''OWNER'',''ADMIN'',''EDITOR''))','admin manage published content',t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated',t);
    EXECUTE format('GRANT INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  END LOOP;
END $$;

-- Merch catalogue is additionally visible only through an actually published product.
ALTER TABLE public.merch_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read published" ON public.merch_products;
CREATE POLICY "public read published" ON public.merch_products
FOR SELECT TO anon,authenticated USING (status IN ('published','ready','active','live'));
DROP POLICY IF EXISTS "merch admins manage products" ON public.merch_products;
CREATE POLICY "merch admins manage products" ON public.merch_products
FOR ALL TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR','MERCH'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR','MERCH'));
GRANT SELECT ON public.merch_products TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.merch_products TO authenticated;

ALTER TABLE public.merch_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read active variants" ON public.merch_variants;
CREATE POLICY "public read active variants" ON public.merch_variants
FOR SELECT TO anon,authenticated
USING (status='active' AND EXISTS (
  SELECT 1 FROM public.merch_products p WHERE p.id=product_id AND p.status IN ('published','ready','active','live')
));
DROP POLICY IF EXISTS "merch admins manage variants" ON public.merch_variants;
CREATE POLICY "merch admins manage variants" ON public.merch_variants
FOR ALL TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR','MERCH'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR','MERCH'));
GRANT SELECT ON public.merch_variants TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.merch_variants TO authenticated;

ALTER TABLE public.site_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read site flags" ON public.site_flags;
CREATE POLICY "Public can read site flags" ON public.site_flags FOR SELECT TO anon,authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage site flags" ON public.site_flags;
CREATE POLICY "Admins manage site flags" ON public.site_flags FOR ALL TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));
GRANT SELECT ON public.site_flags TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.site_flags TO authenticated;

ALTER TABLE public.artist_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read artist status" ON public.artist_status;
CREATE POLICY "Public can read artist status" ON public.artist_status FOR SELECT TO anon,authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage artist status" ON public.artist_status;
CREATE POLICY "Admins manage artist status" ON public.artist_status FOR ALL TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));
GRANT SELECT ON public.artist_status TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.artist_status TO authenticated;

ALTER TABLE public.live_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_notifications FROM anon,authenticated;

ALTER TABLE public.merch_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_variants ENABLE ROW LEVEL SECURITY;

-- Admin profile reads: self or OWNER/ADMIN. Role changes remain OWNER/ADMIN-only.
DROP POLICY IF EXISTS "admin profile self read" ON public.admin_profiles;
CREATE POLICY "admin profile self read" ON public.admin_profiles FOR SELECT TO authenticated
USING (user_id=auth.uid() OR public.current_admin_role() IN ('OWNER','ADMIN'));
DROP POLICY IF EXISTS "owner manage admin profiles" ON public.admin_profiles;
CREATE POLICY "owner manage admin profiles" ON public.admin_profiles FOR ALL TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN'));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.admin_profiles TO authenticated;

-- Private business data is never directly readable by anonymous clients.
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.members FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.members TO authenticated;
DROP POLICY IF EXISTS "Admins can read members" ON public.members;
CREATE POLICY "Admins can read members" ON public.members FOR SELECT TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR','PARTNERSHIPS'));
DROP POLICY IF EXISTS "Admins can update members" ON public.members;
CREATE POLICY "Admins can update members" ON public.members FOR UPDATE TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));

ALTER TABLE public.fan_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fan_memberships FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.fan_memberships TO authenticated;
DROP POLICY IF EXISTS "Admins read fan memberships" ON public.fan_memberships;
CREATE POLICY "Admins read fan memberships" ON public.fan_memberships FOR SELECT TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));
DROP POLICY IF EXISTS "Admins update fan memberships" ON public.fan_memberships;
CREATE POLICY "Admins update fan memberships" ON public.fan_memberships FOR UPDATE TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN'));

ALTER TABLE public.partnership_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partnership_requests FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.partnership_requests TO authenticated;
DROP POLICY IF EXISTS "partnership admins read" ON public.partnership_requests;
CREATE POLICY "partnership admins read" ON public.partnership_requests FOR SELECT TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','PARTNERSHIPS'));
DROP POLICY IF EXISTS "partnership admins update" ON public.partnership_requests;
CREATE POLICY "partnership admins update" ON public.partnership_requests FOR UPDATE TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','PARTNERSHIPS'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','PARTNERSHIPS'));

-- Reservation writes are made only by the security-definer RPC below.
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='reservations' AND cmd IN ('INSERT','ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reservations',policy_row.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.reservations FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.reservations TO authenticated;
DROP POLICY IF EXISTS "merch admins read reservations" ON public.reservations;
CREATE POLICY "merch admins read reservations" ON public.reservations FOR SELECT TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR','MERCH'));
DROP POLICY IF EXISTS "merch admins update reservations" ON public.reservations;
CREATE POLICY "merch admins update reservations" ON public.reservations FOR UPDATE TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','MERCH'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','MERCH'));

-- The existing public view has an intentionally limited column set. It is read-only for public roles.
REVOKE ALL ON public.partnership_public FROM anon,authenticated;
GRANT SELECT ON public.partnership_public TO anon,authenticated;

-- Radio catalog read access is limited to active, published and non-disabled tracks.
ALTER TABLE public.radio_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "radio_tracks_public_read" ON public.radio_tracks;
CREATE POLICY "radio_tracks_public_read" ON public.radio_tracks FOR SELECT TO anon,authenticated
USING (status IN ('published','active','live','ready') AND temporarily_disabled=false);
DROP POLICY IF EXISTS "radio_tracks_editor_write" ON public.radio_tracks;
CREATE POLICY "radio_tracks_editor_write" ON public.radio_tracks FOR ALL TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));
GRANT SELECT ON public.radio_tracks TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.radio_tracks TO authenticated;

ALTER TABLE public.radio_station ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "radio_station_public_read" ON public.radio_station;
CREATE POLICY "radio_station_public_read" ON public.radio_station FOR SELECT TO anon,authenticated USING (id=1);
DROP POLICY IF EXISTS "radio_station_editor_write" ON public.radio_station;
CREATE POLICY "radio_station_editor_write" ON public.radio_station FOR ALL TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));
GRANT SELECT ON public.radio_station TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.radio_station TO authenticated;

ALTER TABLE public.radio_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "radio_blocks_public_read" ON public.radio_blocks;
CREATE POLICY "radio_blocks_public_read" ON public.radio_blocks FOR SELECT TO anon,authenticated USING (active=true);
DROP POLICY IF EXISTS "radio_blocks_editor_write" ON public.radio_blocks;
CREATE POLICY "radio_blocks_editor_write" ON public.radio_blocks FOR ALL TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'))
WITH CHECK (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));
GRANT SELECT ON public.radio_blocks TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.radio_blocks TO authenticated;

-- No direct REST access to the synchronization clock, listener rows or badge ledger.
ALTER TABLE public.frequency_station ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequency_listeners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequency_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.frequency_station,public.frequency_listeners,public.frequency_badges FROM anon,authenticated;

-- Analytics accepts only explicitly listed event names and object payloads, never arbitrary table reads.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.events FROM anon,authenticated;
GRANT INSERT(sid,name,props) ON public.events TO anon,authenticated;
GRANT SELECT ON public.events TO authenticated;
DROP POLICY IF EXISTS "Public analytics can insert" ON public.events;
CREATE POLICY "Public analytics can insert" ON public.events FOR INSERT TO anon,authenticated
WITH CHECK (char_length(sid) between 4 and 64 AND jsonb_typeof(props)='object');
DROP POLICY IF EXISTS "Admins can read events" ON public.events;
CREATE POLICY "Admins can read events" ON public.events FOR SELECT TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));

-- Audit is readable only by Control Room roles. Inserts are made by the trigger function.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon,authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated
USING (public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));

-- 9. Public RPCs for LIVE notifications and the shared radio.
create or replace function public.create_live_notification(
  p_kind text,
  p_contact_type text,
  p_contact_value text
)
returns table(accepted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text := btrim(coalesce(p_contact_value,''));
  v_type text := lower(btrim(coalesce(p_contact_type,'')));
  v_key text;
begin
  if lower(coalesce(p_kind,'live')) <> 'live' then raise exception using errcode='22023', message='TIPO_INVALIDO'; end if;
  if v_type not in ('email','whatsapp') then raise exception using errcode='22023', message='CONTACTO_INVALIDO'; end if;
  if char_length(v_value) < 5 or char_length(v_value) > 120 then raise exception using errcode='22023', message='CONTACTO_INVALIDO'; end if;
  if v_type='email' then
    v_value := lower(v_value);
    if v_value !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023', message='EMAIL_INVALIDO'; end if;
  else
    if v_value !~ '^\+?[0-9][0-9 .()\-]{4,}$' then raise exception using errcode='22023', message='WHATSAPP_INVALIDO'; end if;
  end if;
  v_key := 'live:' || v_type || ':' || lower(regexp_replace(v_value,'[^a-zA-Z0-9@._+]','','g'));
  insert into public.live_notifications(kind,contact_type,contact_value,contact_key)
  values ('live',v_type,v_value,v_key)
  on conflict (contact_key) do nothing;
  return query select true;
end;
$$;
revoke all on function public.create_live_notification(text,text,text) from public;
grant execute on function public.create_live_notification(text,text,text) to anon,authenticated;

create or replace function public.frequency_clock()
returns table(server_now timestamptz, station_started_at timestamptz, program_seed bigint)
language sql security definer set search_path = ''
as $$ select now(),s.station_started_at,s.program_seed from public.frequency_station s where s.id=1; $$;
revoke all on function public.frequency_clock() from public;
grant execute on function public.frequency_clock() to anon,authenticated;

create or replace function public.frequency_heartbeat(p_sid text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_sid is null or char_length(btrim(p_sid)) not between 4 and 64 then raise exception using errcode='22023',message='SID_INVALIDO'; end if;
  insert into public.frequency_listeners(sid,last_seen) values(btrim(p_sid),now())
  on conflict(sid) do update set last_seen=excluded.last_seen;
end;
$$;
revoke all on function public.frequency_heartbeat(text) from public;
grant execute on function public.frequency_heartbeat(text) to anon,authenticated;

create or replace function public.frequency_listener_count()
returns bigint language sql stable security definer set search_path = ''
as $$ select count(*)::bigint from public.frequency_listeners where last_seen >= now()-interval '45 seconds'; $$;
revoke all on function public.frequency_listener_count() from public;
grant execute on function public.frequency_listener_count() to anon,authenticated;

create or replace function public.frequency_radio_catalog()
returns table(id uuid,title text,artist text,artist_slug text,audio_url text,duration_seconds numeric,kind text,rotation_weight integer,position integer,failure_count integer,temporarily_disabled boolean)
language sql stable security definer set search_path = ''
as $$
  select t.id,t.title,t.artist,t.artist_slug,t.audio_url,t.duration_seconds,t.kind,t.rotation_weight,t.position,t.failure_count,t.temporarily_disabled
  from public.radio_tracks t
  where t.status in ('published','active','live','ready') and t.temporarily_disabled=false
  order by t.position,t.id;
$$;
revoke all on function public.frequency_radio_catalog() from public;
grant execute on function public.frequency_radio_catalog() to anon,authenticated;

create or replace function public.frequency_radio_station()
returns table(station_name text,station_tag_url text,active_block_id uuid,forced_track_id uuid,forced_started_at timestamptz,autoplay boolean,station_seed bigint,crossfade_ms integer,tag_interval integer)
language sql stable security definer set search_path = ''
as $$
  select s.station_name,s.station_tag_url,s.active_block_id,s.forced_track_id,s.forced_started_at,s.autoplay,s.station_seed,s.crossfade_ms,s.tag_interval
  from public.radio_station s where s.id=1;
$$;
revoke all on function public.frequency_radio_station() from public;
grant execute on function public.frequency_radio_station() to anon,authenticated;

create or replace function public.frequency_radio_blocks()
returns table(id uuid,name text,track_ids uuid[],active boolean,randomize boolean)
language sql stable security definer set search_path = ''
as $$ select b.id,b.name,b.track_ids,b.active,b.randomize from public.radio_blocks b where b.active=true order by b.created_at,b.id; $$;
revoke all on function public.frequency_radio_blocks() from public;
grant execute on function public.frequency_radio_blocks() to anon,authenticated;

create or replace function public.frequency_mark_track_failure(p_track_id text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare next_count integer;
begin
  update public.radio_tracks
    set failure_count=failure_count+1,
        last_failure_at=now(),
        temporarily_disabled=(failure_count+1 >= 5),
        updated_at=now()
  where id::text=p_track_id
  returning failure_count into next_count;
  return coalesce(next_count,0);
end;
$$;
revoke all on function public.frequency_mark_track_failure(text) from public;
grant execute on function public.frequency_mark_track_failure(text) to anon,authenticated;

create or replace function public.frequency_award_night(p_code text,p_local_hour integer)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare normalized text := upper(btrim(coalesce(p_code,''))); valid_member boolean;
begin
  if normalized='' or normalized !~ '^[A-Z0-9]{4,16}$' then return false; end if;
  if extract(hour from (now() at time zone 'Africa/Maputo'))::integer <> 3 then return false; end if;
  select exists(select 1 from public.members m where m.code=normalized and m.status='active') into valid_member;
  if not coalesce(valid_member,false) then return false; end if;
  insert into public.frequency_badges(code,badge) values(normalized,'OUVINTE DA MADRUGADA') on conflict(code) do nothing;
  return true;
end;
$$;
revoke all on function public.frequency_award_night(text,integer) from public;
grant execute on function public.frequency_award_night(text,integer) to anon,authenticated;

create or replace function public.frequency_has_night_badge(p_code text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.frequency_badges b where b.code=upper(btrim(coalesce(p_code,''))) and b.badge='OUVINTE DA MADRUGADA'); $$;
revoke all on function public.frequency_has_night_badge(text) from public;
grant execute on function public.frequency_has_night_badge(text) to anon,authenticated;

-- 10. Stock counters are server-managed. Merch clients cannot set reserved/sold quantities directly.
create or replace function public.protect_inventory_counters()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (new.stock_reserved is distinct from old.stock_reserved or new.stock_sold is distinct from old.stock_sold)
     and coalesce(current_setting('app.inventory_internal',true),'') <> 'on' then
    raise exception using errcode='42501', message='INVENTORY_COUNTERS_ARE_SERVER_MANAGED';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_inventory_counters() from public;
DROP TRIGGER IF EXISTS protect_inventory_counters ON public.merch_variants;
CREATE TRIGGER protect_inventory_counters BEFORE UPDATE ON public.merch_variants
FOR EACH ROW EXECUTE FUNCTION public.protect_inventory_counters();

create or replace function public.record_merch_stock_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare delta integer;
begin
  if tg_op='INSERT' then
    delta := new.stock_total;
    if delta <> 0 then
      insert into public.inventory_movements(variant_id,movement_type,quantity,reference,notes,actor_user_id)
      values(new.id,'opening',delta,new.sku,'Stock inicial da variante',auth.uid());
    end if;
    return new;
  end if;
  delta := new.stock_total-old.stock_total;
  if delta <> 0 then
    insert into public.inventory_movements(variant_id,movement_type,quantity,reference,notes,actor_user_id)
    values(new.id,'adjustment',delta,new.sku,'Ajuste manual do stock total',auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.record_merch_stock_change() from public;
DROP TRIGGER IF EXISTS merch_stock_opening_log ON public.merch_variants;
CREATE TRIGGER merch_stock_opening_log AFTER INSERT ON public.merch_variants
FOR EACH ROW EXECUTE FUNCTION public.record_merch_stock_change();
DROP TRIGGER IF EXISTS merch_stock_adjustment_log ON public.merch_variants;
CREATE TRIGGER merch_stock_adjustment_log AFTER UPDATE OF stock_total ON public.merch_variants
FOR EACH ROW EXECUTE FUNCTION public.record_merch_stock_change();

create or replace function public.sync_reservation_inventory()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_variant_id uuid; v_qty integer;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_variant_id := null;
  select v.id into v_variant_id
  from public.merch_variants v
  where v.id::text=coalesce(new.variant_id,new.merch_variant_id,'')
  limit 1;
  if v_variant_id is null then return new; end if;
  v_qty := greatest(1,coalesce(new.quantity,new.qty,1));
  if old.status in ('new','pending','accepted','ready') and new.status in ('rejected','closed','cancelled') then
    perform set_config('app.inventory_internal','on',true);
    update public.merch_variants
      set stock_reserved=greatest(0,stock_reserved-v_qty),updated_at=now()
      where id=v_variant_id;
    insert into public.inventory_movements(variant_id,movement_type,quantity,reference,notes,actor_user_id)
    values(v_variant_id,'reservation_release',-v_qty,coalesce(new.code,new.reference),'Reserva cancelada/rejeitada',auth.uid());
  elsif old.status in ('new','pending','accepted','ready') and new.status in ('fulfilled','completed','delivered') then
    perform set_config('app.inventory_internal','on',true);
    update public.merch_variants
      set stock_reserved=greatest(0,stock_reserved-v_qty),stock_sold=stock_sold+v_qty,updated_at=now()
      where id=v_variant_id;
    insert into public.inventory_movements(variant_id,movement_type,quantity,reference,notes,actor_user_id)
    values(v_variant_id,'sale',v_qty,coalesce(new.code,new.reference),'Reserva concluída',auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.sync_reservation_inventory() from public;
DROP TRIGGER IF EXISTS reservation_inventory_status ON public.reservations;
CREATE TRIGGER reservation_inventory_status AFTER UPDATE OF status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.sync_reservation_inventory();

-- Replace the old reservation RPC: preserve client signature but never trust client price/name/variant.
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
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
  v_product_name text;
  v_size text;
  v_price numeric(12,2);
  v_alias text := left(coalesce(nullif(btrim(p_alias),''),'ANÓNIMO'),120);
  v_id uuid;
  v_code text;
begin
  if nullif(btrim(p_product_id),'') is null then raise exception using errcode='22023',message='PRODUTO_OBRIGATORIO'; end if;
  if nullif(btrim(p_variant_id),'') is null then raise exception using errcode='22023',message='VARIANTE_OBRIGATORIA'; end if;
  if nullif(btrim(p_size),'') is null then raise exception using errcode='22023',message='TAMANHO_OBRIGATORIO'; end if;

  select p.id,p.name,p.price,v.id,v.size
    into v_product_id,v_product_name,v_price,v_variant_id,v_size
  from public.merch_products p
  join public.merch_variants v on v.product_id=p.id
  where p.id::text=btrim(p_product_id)
    and v.id::text=btrim(p_variant_id)
    and lower(v.size)=lower(btrim(p_size))
    and p.status in ('published','ready','active','live')
    and v.status='active'
  for update of v;

  if not found then raise exception using errcode='22023',message='PRODUTO_OU_VARIANTE_INDISPONIVEL'; end if;
  if v_price is null or v_price <= 0 then raise exception using errcode='22023',message='PRECO_NAO_CONFIGURADO'; end if;

  perform set_config('app.inventory_internal','on',true);
  update public.merch_variants
    set stock_reserved=stock_reserved+1,updated_at=now()
  where id=v_variant_id and stock_total-stock_reserved-stock_sold >= 1 and status='active';
  if not found then raise exception using errcode='22023',message='STOCK_ESGOTADO'; end if;

  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  while exists(select 1 from public.reservations r where r.code=v_code) loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  end loop;

  insert into public.reservations(
    product_id,variant_id,merch_product_id,merch_variant_id,product_name,item_name,size,selected_size,
    alias,codename,recipient_alias,quantity,qty,unit_price,price,amount,status,code,reference
  ) values (
    v_product_id::text,v_variant_id::text,v_product_id::text,v_variant_id::text,
    v_product_name,v_product_name,v_size,v_size,v_alias,v_alias,v_alias,1,1,v_price,v_price,v_price,'new',v_code,v_code
  ) returning id into v_id;

  insert into public.inventory_movements(variant_id,movement_type,quantity,reference,notes,actor_user_id)
  values(v_variant_id,'reservation',1,v_code,'Reserva pública criada',auth.uid());

  return jsonb_build_object('id',v_id,'code',v_code,'reference',v_code,'serial_number',null,'status','new');
end;
$$;
revoke all on function public.create_public_merch_reservation(text,text,text,text,text,numeric) from public;
grant execute on function public.create_public_merch_reservation(text,text,text,text,text,numeric) to anon,authenticated;

-- 11. Privacy-safe audit log: field names/status only, never old/new row payloads or contact values.
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_fields text[] := '{}'::text[];
  v_entity_id text;
  v_status text;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  select coalesce(array_agg(k order by k),'{}'::text[]) into v_fields
  from (
    select jsonb_object_keys(v_old) as k
    union
    select jsonb_object_keys(v_new) as k
  ) keys
  where v_old -> k is distinct from v_new -> k;
  v_entity_id := coalesce(v_new->>'id',v_new->>'key',v_new->>'slug',v_old->>'id',v_old->>'key',v_old->>'slug');
  v_status := case when tg_op='DELETE' then v_old->>'status' else v_new->>'status' end;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,changed_fields,payload)
  values(auth.uid(),lower(tg_op),tg_table_name,v_entity_id,v_fields,jsonb_build_object('status',v_status,'changed_fields',to_jsonb(v_fields)));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.write_audit_log() from public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'artists','artist_releases','artist_socials','tapes','releases','beats','camping_events','camping_sessions',
    'site_flags','artist_status','gallery_items','revelation_media','media_assets','merch_products','merch_variants',
    'inventory_movements','reservations','partnership_requests','site_settings','site_sections','drop_campaigns',
    'admin_profiles','members','fan_memberships'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I','trg_phase5_audit',t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()','trg_phase5_audit',t);
  END LOOP;
END $$;

-- 12. Realtime publication (some Supabase projects do not have the default publication yet).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_flags','artist_status'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
    END IF;
  END LOOP;
END $$;

-- 13. Public media storage is intentionally public-only. Private files must never be placed here.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('syndicate-media','syndicate-media',true,104857600,ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
ON CONFLICT (id) DO UPDATE SET name=excluded.name,public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Control Room media read" ON storage.objects;
  CREATE POLICY "Control Room media read" ON storage.objects FOR SELECT TO anon,authenticated USING (bucket_id='syndicate-media');

  DROP POLICY IF EXISTS "Control Room media insert" ON storage.objects;
  CREATE POLICY "Control Room media insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id='syndicate-media' AND public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));

  DROP POLICY IF EXISTS "Control Room media update" ON storage.objects;
  CREATE POLICY "Control Room media update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id='syndicate-media' AND public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'))
    WITH CHECK (bucket_id='syndicate-media' AND public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));

  DROP POLICY IF EXISTS "Control Room media delete" ON storage.objects;
  CREATE POLICY "Control Room media delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id='syndicate-media' AND public.current_admin_role() IN ('OWNER','ADMIN','EDITOR'));
END $$;

COMMENT ON TABLE public.artists IS 'Canonical artist roster for the public site, Camping and Control Room.';
COMMENT ON TABLE public.artist_releases IS 'Published artist release links; artist data is not hardcoded in the 3D scene.';
COMMENT ON TABLE public.camping_sessions IS 'Real scheduled CAMPING sessions. Intentionally empty until genuine session times are entered.';
COMMENT ON TABLE public.merch_products IS 'Canonical merch catalog. No demo products are seeded into production.';
COMMENT ON TABLE public.merch_variants IS 'Authoritative stock counters. Reserved and sold quantities are server-managed.';
COMMENT ON TABLE public.inventory_movements IS 'Append-only inventory ledger, updated by server-side reservation/status triggers.';
COMMENT ON TABLE public.media_assets IS 'Metadata for publishable assets. Do not store restricted files in the public syndicate-media bucket.';
COMMENT ON TABLE public.frequency_station IS 'Authoritative server clock for the shared Frequência 808 radio.';
COMMENT ON TABLE public.audit_logs IS 'Privacy-safe Control Room audit events; payload contains changed field names/status only.';
