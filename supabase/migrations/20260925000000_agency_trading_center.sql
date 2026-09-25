-- ============================================================================
-- Agency Trading Center
-- ----------------------------------------------------------------------------
-- Adds the "Agency Trading Market" — a distinct, immutable-ledger coin balance
-- owned by an AGENCY (not a user) that Agency Owners use to pay their hosts.
--
-- This is a SEPARATE balance from profiles.coins (a user's personal wallet) and
-- from host_earnings (host diamonds from gifts). Coins the agency purchases are
-- credited HERE, never into the owner's personal wallet.
--
-- Tables:
--   agency_trading_accounts - one available balance per agency
--   agency_trading_ledger   - immutable per-agency transaction history
--   agency_host_payments    - one row per host payment (idempotency anchor)
--
-- All balance movement happens inside fin_agency_trading_credit() and
-- fin_agency_pay_host() — never a bare `balance += amount`. Every mutation also
-- writes a ledger row, and host payments additionally credit the host's
-- profiles.coins + a financial_ledger row.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- agency_trading_accounts
-- ----------------------------------------------------------------------------
create table if not exists public.agency_trading_accounts (
  agency_id         text primary key references public.agencies (id) on delete cascade,
  available_balance bigint not null default 0 check (available_balance >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- agency_trading_ledger
-- ----------------------------------------------------------------------------
create table if not exists public.agency_trading_ledger (
  id               uuid primary key default gen_random_uuid(),
  agency_id        text not null references public.agencies (id) on delete cascade,
  transaction_type text not null
                     check (transaction_type in ('AGENCY_COIN_PURCHASE', 'HOST_PAYMENT', 'ADJUSTMENT', 'REVERSAL')),
  direction        text not null check (direction in ('credit', 'debit')),
  amount           bigint not null check (amount >= 0),
  balance_before   bigint not null check (balance_before >= 0),
  balance_after    bigint not null check (balance_after >= 0),
  reference_type   text,
  reference_id     text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists agency_trading_ledger_agency_created_idx
  on public.agency_trading_ledger (agency_id, created_at desc);

-- ----------------------------------------------------------------------------
-- agency_host_payments
-- ----------------------------------------------------------------------------
create table if not exists public.agency_host_payments (
  id              uuid primary key default gen_random_uuid(),
  agency_id       text not null references public.agencies (id) on delete cascade,
  host_id         uuid not null references public.profiles (id) on delete cascade,
  amount          bigint not null check (amount > 0),
  status          text not null default 'completed' check (status in ('completed')),
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz not null default now(),

  constraint agency_host_payments_idempotency_unique unique (agency_id, idempotency_key)
);

create index if not exists agency_host_payments_agency_created_idx
  on public.agency_host_payments (agency_id, created_at desc);
create index if not exists agency_host_payments_host_idx
  on public.agency_host_payments (host_id);

-- ----------------------------------------------------------------------------
-- fin_agency_trading_credit(p_agency_id, p_amount, p_reference_type,
--                           p_reference_id, p_metadata)
-- ----------------------------------------------------------------------------
-- Credits the agency's Trading Market balance (the "Agency Coin Purchase"
-- operation) and writes an immutable ledger row. Atomic: balance + ledger
-- commit together.
-- ----------------------------------------------------------------------------
create or replace function public.fin_agency_trading_credit(
  p_agency_id      text,
  p_amount         bigint,
  p_reference_type text,
  p_reference_id   text,
  p_metadata       jsonb default '{}'::jsonb
)
returns table (
  new_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before bigint;
  v_after  bigint;
begin
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  insert into public.agency_trading_accounts (agency_id, available_balance)
  values (p_agency_id, 0)
  on conflict (agency_id) do nothing;

  select available_balance into v_before
    from public.agency_trading_accounts
   where agency_id = p_agency_id
   for update;

  if v_before is null then
    raise exception 'AGENCY_NOT_FOUND';
  end if;

  v_after := v_before + p_amount;

  update public.agency_trading_accounts
     set available_balance = v_after, updated_at = now()
   where agency_id = p_agency_id;

  insert into public.agency_trading_ledger (
    agency_id, transaction_type, direction, amount, balance_before, balance_after,
    reference_type, reference_id, metadata
  ) values (
    p_agency_id, 'AGENCY_COIN_PURCHASE', 'credit',
    p_amount, v_before, v_after, p_reference_type, p_reference_id, p_metadata
  );

  return query select v_after;
end;
$$;

-- ----------------------------------------------------------------------------
-- fin_agency_pay_host(p_agency_id, p_host_id, p_amount, p_idempotency_key)
-- ----------------------------------------------------------------------------
-- Pays a host out of the agency's Trading Market balance. Atomic, idempotent
-- and concurrency-safe:
--   * the trading account row is locked FOR UPDATE, serializing every payment
--     for the same agency (no double-spend);
--   * (agency_id, idempotency_key) is UNIQUE — retries return the original
--     payment without paying again;
--   * balance is verified under the lock;
--   * account debit + host credit + ledger + financial_ledger + payment row
--     all commit in one transaction.
-- ----------------------------------------------------------------------------
create or replace function public.fin_agency_pay_host(
  p_agency_id       text,
  p_host_id         uuid,
  p_amount          bigint,
  p_idempotency_key text
)
returns table (
  payment_id        uuid,
  new_balance       bigint,
  already_processed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before     bigint;
  v_after      bigint;
  v_payment    uuid;
  v_existing   uuid;
  v_host_coins bigint;
begin
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Serialize every payment for this agency.
  select available_balance into v_before
    from public.agency_trading_accounts
   where agency_id = p_agency_id
   for update;

  if v_before is null then
    raise exception 'AGENCY_NOT_FOUND';
  end if;

  -- Idempotency: a retried request returns the original payment.
  select id into v_existing
    from public.agency_host_payments
   where agency_id = p_agency_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return query select v_existing, v_before, true;
    return;
  end if;

  if v_before < p_amount then
    raise exception 'INSUFFICIENT_TRADING_BALANCE';
  end if;

  -- Lock + verify the host profile (after the account lock, so no deadlock).
  select coalesce(coins, 0) into v_host_coins
    from public.profiles
   where id = p_host_id
   for update;
  if not found then
    raise exception 'HOST_NOT_FOUND';
  end if;

  v_after  := v_before - p_amount;
  v_payment := gen_random_uuid();

  update public.agency_trading_accounts
     set available_balance = v_after, updated_at = now()
   where agency_id = p_agency_id;

  update public.profiles
     set coins = v_host_coins + p_amount
   where id = p_host_id;

  insert into public.agency_host_payments (
    id, agency_id, host_id, amount, status, idempotency_key
  ) values (
    v_payment, p_agency_id, p_host_id, p_amount, 'completed', p_idempotency_key
  );

  insert into public.agency_trading_ledger (
    agency_id, transaction_type, direction, amount, balance_before, balance_after,
    reference_type, reference_id, metadata
  ) values (
    p_agency_id, 'HOST_PAYMENT', 'debit', p_amount, v_before, v_after,
    'agency_host_payment', v_payment::text,
    jsonb_build_object('host_id', p_host_id, 'payment_id', v_payment)
  );

  insert into public.financial_ledger (
    id, user_id, wallet_type, direction, amount, balance_after, reason,
    reference_type, reference_id, metadata
  ) values (
    gen_random_uuid(), p_host_id, 'coins', 'credit', p_amount,
    v_host_coins + p_amount,
    'agency_host_payment', 'agency_host_payment', v_payment,
    jsonb_build_object('agency_id', p_agency_id, 'payment_id', v_payment)
  );

  return query select v_payment, v_after, false;
end;
$$;

-- Grant execution to the service role (Supabase API) ONLY.
-- Both functions move real value and accept caller-supplied amounts; exposing
-- them to `authenticated` would let a browser mint/steal coins directly.
grant execute on function public.fin_agency_trading_credit(text, bigint, text, text, jsonb) to service_role;
grant execute on function public.fin_agency_pay_host(text, uuid, bigint, text) to service_role;

-- ----------------------------------------------------------------------------
-- fin_credit_agency_trading_recharge(p_recharge_id, p_admin_id, p_action,
--                                    p_coins, p_agency_id)
-- ----------------------------------------------------------------------------
-- Settles an agency coin PURCHASE (an offline_recharge tagged with agency_id)
-- into the agency's Trading Market balance instead of the owner's personal
-- wallet. Atomic + idempotent: locks the recharge row, flips its status, and
-- credits the trading account + ledger in one transaction. Reused by the admin
-- approval path in offline-recharge.service.ts.
-- ----------------------------------------------------------------------------
create or replace function public.fin_credit_agency_trading_recharge(
  p_recharge_id text,
  p_admin_id     uuid,
  p_action       text,
  p_coins        bigint,
  p_agency_id    text
)
returns table (
  new_balance       bigint,
  already_processed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recharge public.offline_recharges%rowtype;
  v_before   bigint;
  v_after    bigint;
begin
  select * into v_recharge
    from public.offline_recharges
   where id = p_recharge_id
   for update;

  if not found then
    raise exception 'RECHARGE_NOT_FOUND';
  end if;

  -- Idempotent: an already-processed recharge returns the current balance.
  if v_recharge.status <> 'pending' then
    select available_balance into v_after
      from public.agency_trading_accounts
     where agency_id = p_agency_id;
    return query select coalesce(v_after, 0), true;
    return;
  end if;

  if p_action = 'rejected' then
    update public.offline_recharges
       set status = 'rejected', processed_by = p_admin_id, processed_at = now()
     where id = p_recharge_id;
    select available_balance into v_after
      from public.agency_trading_accounts
     where agency_id = p_agency_id;
    return query select coalesce(v_after, 0), false;
    return;
  end if;

  if p_action <> 'approved' then
    raise exception 'INVALID_ACTION';
  end if;

  insert into public.agency_trading_accounts (agency_id, available_balance)
  values (p_agency_id, 0)
  on conflict (agency_id) do nothing;

  select available_balance into v_before
    from public.agency_trading_accounts
   where agency_id = p_agency_id
   for update;

  if v_before is null then
    raise exception 'AGENCY_NOT_FOUND';
  end if;

  v_after := v_before + p_coins;

  update public.agency_trading_accounts
     set available_balance = v_after, updated_at = now()
   where agency_id = p_agency_id;

  insert into public.agency_trading_ledger (
    agency_id, transaction_type, direction, amount, balance_before, balance_after,
    reference_type, reference_id, metadata
  ) values (
    p_agency_id, 'AGENCY_COIN_PURCHASE', 'credit', p_coins, v_before, v_after,
    'offline_recharge', p_recharge_id,
    jsonb_build_object('recharge_id', p_recharge_id)
  );

  update public.offline_recharges
     set status = 'approved', coins_credited = p_coins,
         processed_by = p_admin_id, processed_at = now()
   where id = p_recharge_id;

  return query select v_after, false;
end;
$$;

grant execute on function public.fin_credit_agency_trading_recharge(text, uuid, text, bigint, text) to service_role;
