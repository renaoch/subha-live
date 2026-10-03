-- ============================================================================
-- Campaign configuration (admin)
-- ----------------------------------------------------------------------------
-- Admin-controlled settings for referral reward + active promotions. Daily
-- reward schedule already lives in daily_reward_definitions (editable via the
-- same admin surface). All values are server-side; the client never dictates a
-- reward amount.
-- ============================================================================

-- Single-row referral settings (id is always 1).
create table if not exists public.referral_settings (
  id           integer primary key check (id = 1),
  reward_coins integer not null default 100 check (reward_coins >= 0),
  updated_at   timestamptz not null default now()
);

insert into public.referral_settings (id, reward_coins)
values (1, 100)
on conflict (id) do nothing;

-- Configurable promotions (top-up bonuses, events, etc.).
create table if not exists public.promotions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  subtitle     text not null default '',
  icon         text not null default 'Gift',
  type         text not null default 'bonus' check (type in ('bonus', 'event', 'milestone')),
  reward_coins integer not null default 0 check (reward_coins >= 0),
  is_active    boolean not null default true,
  starts_at    timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists promotions_active_idx
  on public.promotions (is_active, starts_at, expires_at);
