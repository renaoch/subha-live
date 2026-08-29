-- ============================================================================
-- Host Task / User Reward
-- ----------------------------------------------------------------------------
-- Adds the per-user task/reward model used by the live room "Host Task"
-- feature. A host (or admin) configures a task on a room; viewers/host make
-- progress (hours or coins) toward that task and, once completed, claim a
-- coin reward exactly once.
--
-- Tables:
--   host_tasks           - one configurable task per room
--   host_task_progress   - one row per (task, user) tracking progress + claim
--
-- Idempotency / atomicity for claiming lives in claim_host_task_reward()
-- (see bottom). The API layer never trusts the client; every eligibility,
-- expiry, completion and "already claimed" check is re-verified inside the
-- function under row locks.
--
-- Naming follows the existing room_tasks / room_task_claims convention.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- host_tasks
-- ----------------------------------------------------------------------------
create table if not exists public.host_tasks (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms (id) on delete cascade,
  created_by          uuid not null references public.profiles (id) on delete cascade,
  title               text not null,
  description         text not null default '',
  -- Who this task applies to.
  audience            text not null default 'all'
                        check (audience in ('all', 'new_users', 'existing_users')),
  -- Window (in days) used to decide "new user" for the new_users /
  -- existing_users audiences, measured against profiles.created_at.
  new_user_window_days integer not null default 7,
  -- Requirements (at least one of target_hours / target_coins must be set).
  target_hours        numeric(10, 2),
  target_coins        integer,
  -- Reward, separate from the requirement. 0 = progress-only task.
  reward_amount       integer not null default 0,
  starts_at           timestamptz,
  expires_at          timestamptz,
  max_claims          integer,
  status              text not null default 'active'
                        check (status in ('active', 'inactive', 'ended')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint host_tasks_has_target check (
    target_hours is not null or target_coins is not null
  )
);

create index if not exists host_tasks_room_id_idx on public.host_tasks (room_id);
create index if not exists host_tasks_status_idx on public.host_tasks (status);
create index if not exists host_tasks_expires_at_idx on public.host_tasks (expires_at);

-- ----------------------------------------------------------------------------
-- host_task_progress
-- ----------------------------------------------------------------------------
create table if not exists public.host_task_progress (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.host_tasks (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  room_id        uuid not null references public.rooms (id) on delete cascade,
  hours_progress numeric(10, 2) not null default 0,
  coins_progress integer not null default 0,
  status         text not null default 'in_progress'
                   check (status in ('in_progress', 'completed', 'claimed')),
  completed_at   timestamptz,
  claimed_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- One progress row per (task, user) — also the idempotency anchor that
  -- stops a user claiming the same task reward twice.
  constraint host_task_progress_task_user_unique unique (task_id, user_id)
);

create index if not exists host_task_progress_user_id_idx on public.host_task_progress (user_id);
create index if not exists host_task_progress_task_id_idx on public.host_task_progress (task_id);
create index if not exists host_task_progress_status_idx on public.host_task_progress (status);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_host_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists host_tasks_set_updated_at on public.host_tasks;
create trigger host_tasks_set_updated_at
  before update on public.host_tasks
  for each row execute function public.set_host_task_updated_at();

drop trigger if exists host_task_progress_set_updated_at on public.host_task_progress;
create trigger host_task_progress_set_updated_at
  before update on public.host_task_progress
  for each row execute function public.set_host_task_updated_at();

-- ----------------------------------------------------------------------------
-- claim_host_task_reward(p_task_id, p_user_id)
-- ----------------------------------------------------------------------------
-- Atomic, idempotent reward claim. Re-verifies everything server-side and
-- credits coins exactly once. Safe against double-clicks, multiple tabs and
-- racing requests:
--   * rows are locked with SELECT ... FOR UPDATE;
--   * the progress.status transition 'completed' -> 'claimed' is the single
--     point of truth — the coins are only credited when that transition wins;
--   * if a row is already 'claimed' the function short-circuits and returns
--     the existing result WITHOUT crediting again.
-- ----------------------------------------------------------------------------
create or replace function public.claim_host_task_reward(
  p_task_id uuid,
  p_user_id uuid
)
returns table (
  reward_amount integer,
  new_coins     integer,
  claimed_at    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task      public.host_tasks%rowtype;
  v_progress  public.host_task_progress%rowtype;
  v_is_new    boolean := false;
  v_claimed   timestamptz;
  v_new_coins integer;
begin
  -- Lock the task row to serialize concurrent claims for the same task.
  select * into v_task from public.host_tasks where id = p_task_id for update;
  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if v_task.status <> 'active' then
    raise exception 'TASK_NOT_ACTIVE';
  end if;

  if v_task.expires_at is not null and v_task.expires_at <= now() then
    raise exception 'TASK_EXPIRED';
  end if;

  if v_task.starts_at is not null and v_task.starts_at > now() then
    raise exception 'TASK_NOT_STARTED';
  end if;

  -- Eligibility (audience). A missing profile / null created_at is treated
  -- as an "existing" user, mirroring the API service's fallback.
  select (now() - p.created_at) <= make_interval(days => v_task.new_user_window_days)
    into v_is_new
    from public.profiles p
   where p.id = p_user_id and p.created_at is not null;

  if v_task.audience = 'new_users' and v_is_new is not true then
    raise exception 'TASK_NOT_ELIGIBLE';
  end if;

  if v_task.audience = 'existing_users' and v_is_new is true then
    raise exception 'TASK_NOT_ELIGIBLE';
  end if;

  -- Lock the progress row. Because of READ COMMITTED + FOR UPDATE, a second
  -- concurrent claim blocks here and, once the first commits, re-reads the
  -- now-'claimed' row and hits the short-circuit below.
  select * into v_progress
    from public.host_task_progress
   where task_id = p_task_id and user_id = p_user_id
   for update;

  if not found then
    raise exception 'TASK_NOT_COMPLETED';
  end if;

  -- Idempotent: already claimed -> return the existing result, no new coins.
  if v_progress.status = 'claimed' then
    v_claimed := v_progress.claimed_at;
    select coins into v_new_coins from public.profiles where id = p_user_id;
    return query select v_task.reward_amount, coalesce(v_new_coins, 0), v_claimed;
    return;
  end if;

  if v_progress.status <> 'completed' then
    raise exception 'TASK_NOT_COMPLETED';
  end if;

  -- Re-verify completion against the currently-stored progress.
  if (v_task.target_hours is not null and v_progress.hours_progress < v_task.target_hours)
     or (v_task.target_coins is not null and v_progress.coins_progress < v_task.target_coins) then
    raise exception 'TASK_NOT_COMPLETED';
  end if;

  -- Optional claim cap.
  if v_task.max_claims is not null then
    if (select count(*) from public.host_task_progress
         where task_id = p_task_id and status = 'claimed') >= v_task.max_claims then
      raise exception 'TASK_CLAIM_LIMIT_REACHED';
    end if;
  end if;

  v_claimed := now();

  -- The idempotency guard: flip the status first, and only proceed if this
  -- update actually matched a 'completed' row.
  update public.host_task_progress
     set status = 'claimed', claimed_at = v_claimed, updated_at = now()
   where id = v_progress.id and status = 'completed';

  if not found then
    -- Lost a race with a concurrent claim that already flipped it.
    select claimed_at into v_claimed from public.host_task_progress where id = v_progress.id;
    select coins into v_new_coins from public.profiles where id = p_user_id;
    return query select v_task.reward_amount, coalesce(v_new_coins, 0), v_claimed;
    return;
  end if;

  -- Credit coins once and record an auditable wallet transaction.
  update public.profiles
     set coins = coalesce(coins, 0) + v_task.reward_amount
   where id = p_user_id
   returning coins into v_new_coins;

  insert into public.wallet_transactions (id, user_id, type, amount, coins, status, metadata)
  values (
    gen_random_uuid(),
    p_user_id,
    'task_reward',
    0,
    v_task.reward_amount,
    'completed',
    jsonb_build_object(
      'host_task_id', p_task_id,
      'room_id', v_task.room_id,
      'reward_amount', v_task.reward_amount
    )
  );

  return query select v_task.reward_amount, coalesce(v_new_coins, 0), v_claimed;
end;
$$;

-- Grant execution to the service role (Supabase API) and authenticated users.
grant execute on function public.claim_host_task_reward(uuid, uuid) to service_role;
grant execute on function public.claim_host_task_reward(uuid, uuid) to authenticated;
