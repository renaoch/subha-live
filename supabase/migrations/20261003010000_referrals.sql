-- ============================================================================
-- Referrals
-- ----------------------------------------------------------------------------
-- Each user gets a unique referral code. A new user applies a code once; the
-- referrer earns a coin reward exactly once per referred user. Self-referrals
-- and duplicate applications are rejected; the reward is credited atomically
-- with an immutable ledger entry.
--
-- Qualification model (clearly defined): a referral qualifies the moment the
-- referred user (an existing, valid profile) applies a valid code exactly once.
-- Future campaign tiers can gate additional rewards behind further actions.
--
-- Reuses profiles.coins + financial_ledger. No second wallet.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- referral_codes
-- ----------------------------------------------------------------------------
create table if not exists public.referral_codes (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- referrals
-- ----------------------------------------------------------------------------
create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references public.profiles (id) on delete cascade,
  referred_id  uuid not null references public.profiles (id) on delete cascade,
  reward_coins integer not null check (reward_coins >= 0),
  status       text not null default 'qualified' check (status in ('qualified')),
  created_at   timestamptz not null default now(),

  -- One referral per referred user — also the idempotency anchor against
  -- duplicate applications and referral loops.
  constraint referrals_referred_unique unique (referred_id)
);

create index if not exists referrals_referrer_created_idx
  on public.referrals (referrer_id, created_at desc);

-- ----------------------------------------------------------------------------
-- fin_apply_referral(p_referred_id, p_referrer_id, p_reward_coins)
-- ----------------------------------------------------------------------------
-- Applies a referral code once. Idempotent + concurrency-safe:
--   * self-referral is rejected;
--   * a referred user can only ever have one referral (UNIQUE(referred_id));
--   * the reward is credited to the referrer atomically with a ledger entry;
--   * a retry/duplicate returns already_processed = true without crediting.
-- ----------------------------------------------------------------------------
create or replace function public.fin_apply_referral(
  p_referred_id  uuid,
  p_referrer_id  uuid,
  p_reward_coins integer
)
returns table (
  referral_id      uuid,
  referrer_coins   integer,
  already_processed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_id       uuid;
  v_new_coins    integer;
  v_existing     public.referrals%rowtype;
begin
  if p_referred_id = p_referrer_id then
    raise exception 'SELF_REFERRAL';
  end if;

  -- Idempotency: this referred user already has a referral.
  select * into v_existing
    from public.referrals
   where referred_id = p_referred_id;
  if found then
    select coins into v_new_coins from public.profiles where id = p_referrer_id;
    return query select v_existing.id, coalesce(v_new_coins, 0), true;
    return;
  end if;

  -- Lock + verify the referrer exists.
  select coins into v_new_coins from public.profiles where id = p_referrer_id for update;
  if not found then
    raise exception 'REFERRER_NOT_FOUND';
  end if;

  -- Insert; the UNIQUE(referred_id) is the concurrency backstop.
  insert into public.referrals (referrer_id, referred_id, reward_coins, status)
  values (p_referrer_id, p_referred_id, p_reward_coins, 'qualified')
  on conflict (referred_id) do nothing
  returning id into v_ref_id;

  if v_ref_id is null then
    -- Lost a race with a concurrent application: return the winner's result.
    select id into v_ref_id from public.referrals where referred_id = p_referred_id;
    select coins into v_new_coins from public.profiles where id = p_referrer_id;
    return query select v_ref_id, coalesce(v_new_coins, 0), true;
    return;
  end if;

  if p_reward_coins > 0 then
    update public.profiles
       set coins = coalesce(coins, 0) + p_reward_coins
     where id = p_referrer_id
     returning coins into v_new_coins;

    insert into public.financial_ledger (
      id, user_id, wallet_type, direction, amount, balance_after, reason,
      reference_type, reference_id, metadata
    ) values (
      gen_random_uuid(), p_referrer_id, 'coins', 'credit', p_reward_coins, v_new_coins,
      'referral_reward', 'referral', v_ref_id,
      jsonb_build_object('referred_id', p_referred_id)
    );
  end if;

  return query select v_ref_id, coalesce(v_new_coins, 0), false;
end;
$$;

grant execute on function public.fin_apply_referral(uuid, uuid, integer) to service_role;
