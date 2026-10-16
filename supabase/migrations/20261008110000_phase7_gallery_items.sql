create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  type text not null check (type in ('image', 'video')),
  url text null,
  media_asset_id uuid null,
  poster_url text null,
  poster_media_asset_id uuid null,
  alt text not null default 'Registo visual da Sala de Revelação',
  caption text not null default '',
  tag text not null default 'REVELAÇÃO',
  roll text not null default 'CABINE',
  day integer not null default 1 check (day between 1 and 99),
  timecode text not null default '00:00',
  ratio text not null default '4:3' check (ratio in ('4:3', '3:4')),
  downloadable boolean not null default false,
  download_name text null,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gallery_items_public_idx
  on public.gallery_items(status, position);

create index if not exists gallery_items_roll_day_idx
  on public.gallery_items(roll, day, position);

alter table public.gallery_items enable row level security;

revoke all on public.gallery_items from anon, authenticated;
grant select on public.gallery_items to anon, authenticated;
grant insert, update, delete on public.gallery_items to authenticated;

drop policy if exists "Public can read published gallery" on public.gallery_items;
create policy "Public can read published gallery"
  on public.gallery_items for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Admins can manage gallery" on public.gallery_items;
create policy "Admins can manage gallery"
  on public.gallery_items for all
  to authenticated
  using (current_admin_role() in ('OWNER', 'ADMIN', 'EDITOR'))
  with check (current_admin_role() in ('OWNER', 'ADMIN', 'EDITOR'));

comment on table public.gallery_items is 'Phase 7: Galeria publicada da Sala de Revelação.';
comment on column public.gallery_items.roll is 'ROLO editorial: CABINE, ESTAMPA, BEAT, VISUALIZER ou LIVES.';
comment on column public.gallery_items.day is 'Dia editorial da gravação, usado nos filtros da sala.';
