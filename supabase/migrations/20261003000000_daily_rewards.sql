-- ============================================================================
-- Daily Rewards / Check-in
-- ----------------------------------------------------------------------------
-- A streak-based daily reward system. Every claim is exactly-once per reward
-- day (a UTC calendar day), granted atomically with a coin credit + immutable
-- ledger entry. Streak + longest streak are tracked separately for O(1) reads.
--
-- Reuses the existing economy: profiles.coins is the balance, financial_ledger
-- the immutable ledger, user_level_progress the XP store.
--
-- Tables:
--   daily_reward_definitions - admin-configurable schedule (day_index -> reward)
--   daily_reward_claims      - one row per (user, reward_date) — the idempotency
--                              anchor
--   daily_reward_streaks     - per-user current/longest streak + last claim date
--
-- The official reward-day boundary is the UTC calendar day. Clients display it
-- in their local timezone, but eligibility/claiming is always resolved against
-- the server-side UTC date so a device-clock or timezone change cannot mint
-- extra rewards.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- daily_reward_definitions
-- ----------------------------------------------------------------------------
create table if not exists public.daily_reward_definitions (
  day_index    integer primary key check (day_index >= 1),
  reward_coins integer not null default 0 check (reward_coins >= 0),
  reward_xp    integer not null default 0 check (reward_xp >= 0),
  reward_type  text not null default 'coins' check (reward_type in ('coins')),
  metadata     jsonb not null default '{}'::jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- daily_reward_claims
-- ----------------------------------------------------------------------------
create table if not exists public.daily_reward_claims (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  day_index    integer not null,
  reward_date  date not null,
  streak       integer not null check (streak >= 1),
  reward_coins integer not null check (reward_coins >= 0),
  reward_xp    integer not null check (reward_xp >= 0),
  created_at   timestamptz not null default now(),

  constraint daily_reward_claims_user_date_unique unique (user_id, reward_date)
);

create index if not exists daily_reward_claims_user_created_idx
  on public.daily_reward_claims (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- daily_reward_streaks
-- ----------------------------------------------------------------------------
create table if not exists public.daily_reward_streaks (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  current_streak  integer not null default 0 check (current_streak >= 0),
  longest_streak  integer not null default 0 check (longest_streak >= 0),
  last_claim_date date,
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- fin_claim_daily_reward(p_user_id, p_reward_date, p_day_index,
--                        p_reward_coins, p_reward_xp)
-- ----------------------------------------------------------------------------
-- Atomic, idempotent daily-reward claim:
--   * locks the streak row FOR UPDATE (serializes concurrent claims);
--   * if today is already claimed, returns already_processed = true;
--   * advances the streak (consecutive-day rule) and persists longest streak;
--   * credits coins + writes financial_ledger in the same transaction;
--   * inserts the claim row (UNIQUE(user_id, reward_date) is the backstop).
-- The reward amount/day_index come from the trusted service layer; the client
-- never supplies them. Coins are the only atomic grant — XP is applied by the
-- service after commit (progression, not money).
-- ----------------------------------------------------------------------------
create or replace function public.fin_claim_daily_reward(
  p_user_id      uuid,
  p_reward_date  date,
  p_day_index    integer,
  p_reward_coins integer,
  p_reward_xp    integer
)
returns table (
  claim_id         uuid,
  new_coins        integer,
  new_streak       integer,
  already_processed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_streak       public.daily_reward_streaks%rowtype;
  v_new_streak   integer;
  v_claim_id     uuid;
  v_new_coins    integer;
begin
  if p_day_index <= 0 then
    raise exception 'INVALID_REWARD_DAY';
  end if;

  -- Upsert + lock the streak row so concurrent claims serialize here.
  insert into public.daily_reward_streaks (user_id, current_streak, longest_streak)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  select * into v_streak
    from public.daily_reward_streaks
   where user_id = p_user_id
   for update;

  -- Idempotency: already claimed today.
  if v_streak.last_claim_date = p_reward_date then
    select coins into v_new_coins from public.profiles where id = p_user_id;
    return query select
      (select id from public.daily_reward_claims
        where user_id = p_user_id and reward_date = p_reward_date limit 1),
      coalesce(v_new_coins, 0), v_streak.current_streak, true;
    return;
  end if;

  -- Consecutive-day streak rule: +1 if yesterday was claimed, else reset to 1.
  if v_streak.last_claim_date = p_reward_date - 1 then
    v_new_streak := v_streak.current_streak + 1;
  else
    v_new_streak := 1;
  end if;

  update public.daily_reward_streaks
     set current_streak = v_new_streak,
         longest_streak = greatest(longest_streak, v_new_streak),
         last_claim_date = p_reward_date,
         updated_at = now()
   where user_id = p_user_id;

  v_claim_id := gen_random_uuid();

  -- Credit coins atomically + immutable ledger entry.
  if p_reward_coins > 0 then
    update public.profiles
       set coins = coalesce(coins, 0) + p_reward_coins
     where id = p_user_id
     returning coins into v_new_coins;

    insert into public.financial_ledger (
      id, user_id, wallet_type, direction, amount, balance_after, reason,
      reference_type, reference_id, metadata
    ) values (
      gen_random_uuid(), p_user_id, 'coins', 'credit', p_reward_coins, v_new_coins,
      'daily_reward', 'daily_reward_claim', v_claim_id,
      jsonb_build_object('day_index', p_day_index, 'streak', v_new_streak)
    );
  else
    select coins into v_new_coins from public.profiles where id = p_user_id;
  end if;

  insert into public.daily_reward_claims (
    id, user_id, day_index, reward_date, streak, reward_coins, reward_xp
  ) values (
    v_claim_id, p_user_id, p_day_index, p_reward_date, v_new_streak,
    p_reward_coins, p_reward_xp
  );

  return query select v_claim_id, coalesce(v_new_coins, 0), v_new_streak, false;
end;
$$;

-- Seed the default 7-day schedule (admins can edit/extend this table).
insert into public.daily_reward_definitions (day_index, reward_coins, reward_xp) values
  (1, 50, 0),
  (2, 75, 0),
  (3, 100, 0),
  (4, 150, 0),
  (5, 200, 0),
  (6, 300, 0),
  (7, 500, 0)
on conflict (day_index) do nothing;

-- Service-role only: accepts caller-supplied reward amounts.
grant execute on function public.fin_claim_daily_reward(uuid, date, integer, integer, integer) to service_role;
