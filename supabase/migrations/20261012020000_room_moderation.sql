-- =============================================================================
-- Room moderation: a host can BLOCK or MUTE a person in their room.
--   block -> removed from the stream, cannot rejoin, room hidden from them
--   mute  -> cannot comment; if on stage, their mic is force-muted
-- Written only by the API (service_role). RLS on with no policies = no direct
-- access from the browser anon/authenticated keys.
-- =============================================================================
create table if not exists public.room_moderation (
  room_id    uuid        not null references public.rooms(id) on delete cascade,
  user_id    uuid        not null,
  kind       text        not null check (kind in ('block', 'mute')),
  created_by uuid        not null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id, kind)
);

-- "which rooms has this user been blocked from?" (room list filtering)
create index if not exists room_moderation_user_kind_idx
  on public.room_moderation (user_id, kind);

alter table public.room_moderation enable row level security;
revoke all on table public.room_moderation from anon, authenticated;
