-- ============================================================================
-- PK Battle (1v1) durable tables
-- ----------------------------------------------------------------------------
-- Durable source of truth for PK battles. The live scoreboard/state lives in
-- Redis; PostgreSQL stores battle history, participants, final scores and the
-- winner. The Core API (apps/api) owns these tables; the realtime service only
-- reads battle identity for authorization and never writes live scores here.
-- ============================================================================

create table if not exists public.pk_battles (
  id             uuid primary key default gen_random_uuid(),
  room_a_id      uuid not null references public.rooms (id) on delete cascade,
  room_b_id      uuid not null references public.rooms (id) on delete cascade,
  host_a_id      uuid not null references public.profiles (id) on delete cascade,
  host_b_id      uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'INVITED'
                   check (status in (
                     'INVITED', 'ACCEPTED', 'STARTING', 'ACTIVE',
                     'FINALIZING', 'FINISHED', 'CANCELLED'
                   )),
  score_a        bigint not null default 0,
  score_b        bigint not null default 0,
  winner_host_id uuid references public.profiles (id) on delete set null,
  -- 'A' | 'B' | 'DRAW' (normalized); winner_host_id carries the actual id.
  winner_side    text check (winner_side in ('A', 'B', 'DRAW')),
  started_at     timestamptz,
  ends_at        timestamptz,
  ended_at       timestamptz,
  invited_by     uuid not null references public.profiles (id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint pk_battles_distinct_hosts check (host_a_id <> host_b_id),
  constraint pk_battles_distinct_rooms check (room_a_id <> room_b_id)
);

create index if not exists pk_battles_status_idx on public.pk_battles (status);
create index if not exists pk_battles_host_a_idx on public.pk_battles (host_a_id);
create index if not exists pk_battles_host_b_idx on public.pk_battles (host_b_id);
create index if not exists pk_battles_ends_at_idx on public.pk_battles (ends_at);

-- One row per (battle, user) tracking who took part (and on which side).
create table if not exists public.pk_participants (
  id         uuid primary key default gen_random_uuid(),
  battle_id  uuid not null references public.pk_battles (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  side       text not null check (side in ('A', 'B')),
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  constraint pk_participants_unique unique (battle_id, user_id)
);

create index if not exists pk_participants_battle_idx on public.pk_participants (battle_id);
create index if not exists pk_participants_user_idx on public.pk_participants (user_id);

-- Keep updated_at moving on battle writes.
create or replace function public.set_pk_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pk_battles_set_updated_at on public.pk_battles;
create trigger pk_battles_set_updated_at
  before update on public.pk_battles
  for each row execute function public.set_pk_updated_at();
