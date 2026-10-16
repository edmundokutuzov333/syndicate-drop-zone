create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  sid text not null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint events_sid_length check (char_length(sid) between 4 and 64),
  constraint events_name_allowed check (name in (
    'gate_open','tape_play','tape_10s','key_earned','merch_view','cart_add','reserve','proof_sent',
    'join_start','join_done','card_share','selo_found','live_notify','artist_view','sponsor_click'
  )),
  constraint events_props_object check (jsonb_typeof(props) = 'object')
);

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;
grant insert (sid, name, props) on table public.events to anon, authenticated;

drop policy if exists "Public analytics can insert" on public.events;
create policy "Public analytics can insert"
  on public.events
  for insert
  to anon, authenticated
  with check (
    char_length(sid) between 4 and 64
    and name in (
      'gate_open','tape_play','tape_10s','key_earned','merch_view','cart_add','reserve','proof_sent',
      'join_start','join_done','card_share','selo_found','live_notify','artist_view','sponsor_click'
    )
    and jsonb_typeof(props) = 'object'
  );
