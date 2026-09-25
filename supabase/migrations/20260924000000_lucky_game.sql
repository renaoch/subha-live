-- ============================================================================
-- Subha Lucky — 3x3 fruit luck game
-- ----------------------------------------------------------------------------
-- Adds the economically-sensitive persistence + atomic settlement for the
-- "Subha Lucky" mini-game inside live rooms.
--
-- The game reuses the existing economy: profiles.coins is the single coin
-- balance, and every debit/credit is recorded in financial_ledger (created by
-- 20260903120000_financial_system.sql). There is NO second wallet/balance.
--
-- Tables:
--   lucky_rounds - one auditable row per completed spin (the economic + game
--                  result reference). Dedicated to Subha Lucky because the
--                  generic game_rounds/game_results tables carry no user/bet/
--                  payout/idempotency columns and are session-scoped.
--
-- The authoritative result (symbols/multiplier/payout) is computed server-side
-- by the Core API (crypto.randomInt) and passed into fin_lucky_spin(), which
-- is the ONLY place coins can move for a spin. The client never determines an
-- outcome and never sends a payout — fin_lucky_spin() re-verifies balance and
-- idempotency under a row lock and settles atomically.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- lucky_rounds
-- ----------------------------------------------------------------------------
create table if not exists public.lucky_rounds (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  room_id            uuid not null references public.rooms (id) on delete cascade,
  game_type          text not null default 'subha_lucky'
                       check (game_type = 'subha_lucky'),
  bet                integer not null check (bet > 0),
  -- Authoritative result: { "symbols": [9 symbol ids], "multiplier": n,
  --   "payout": n, "winningLines": [[cellIndex,...],...], "isJackpot": bool }
  result             jsonb not null,
  multiplier         integer not null check (multiplier >= 0),
  payout             integer not null check (payout >= 0),
  is_jackpot         boolean not null default false,
  status             text not null default 'completed'
                       check (status in ('completed')),
  -- Idempotency anchor: one round per (user, client request id). A retry after
  -- a network failure reuses the same id and returns the already-settled round
  -- instead of spinning twice.
  client_request_id  text not null,
  config_version     integer not null default 1,
  created_at         timestamptz not null default now(),

  constraint lucky_rounds_user_request_unique unique (user_id, client_request_id)
);

create index if not exists lucky_rounds_user_id_created_idx
  on public.lucky_rounds (user_id, created_at desc);
create index if not exists lucky_rounds_room_id_idx
  on public.lucky_rounds (room_id);
create index if not exists lucky_rounds_created_at_idx
  on public.lucky_rounds (created_at desc);

-- ----------------------------------------------------------------------------
-- fin_lucky_spin(p_user_id, p_room_id, p_bet, p_client_request_id,
--                p_result, p_config_version)
-- ----------------------------------------------------------------------------
-- Atomic, idempotent spin settlement. Re-verifies everything server-side and
-- moves coins exactly once per logical spin. Safe against double-taps, racing
-- requests and network retries:
--   * the profile row is locked with SELECT ... FOR UPDATE, serializing every
--     concurrent spin for the same user (no double-spend of the same balance);
--   * (user_id, client_request_id) is UNIQUE — the idempotency guard;
--   * if the same client request is re-submitted, the already-settled round is
--     returned WITHOUT deducting or paying again;
--   * the balance check happens under the lock, never against a stale read;
--   * debit + credit + round + ledger all commit in one transaction — there is
--     no state where coins moved but no round/ledger row exists.
-- ----------------------------------------------------------------------------
create or replace function public.fin_lucky_spin(
  p_user_id           uuid,
  p_room_id           uuid,
  p_bet               integer,
  p_client_request_id text,
  p_result            jsonb,
  p_config_version    integer
)
returns table (
  round_id          uuid,
  new_coins         integer,
  payout            integer,
  multiplier        integer,
  is_jackpot        boolean,
  already_processed boolean,
  result            jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile            public.profiles%rowtype;
  v_existing           public.lucky_rounds%rowtype;
  v_round_id           uuid;
  v_payout             integer;
  v_multiplier         integer;
  v_is_jackpot         boolean;
  v_new_coins          integer;
  v_balance_after_debit integer;
begin
  -- Serialize every spin for this user (blocks concurrent spins).
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  -- Idempotency: a retry of an already-settled request returns the ORIGINAL
  -- stored result (never a freshly-generated one) and touches nothing.
  select * into v_existing
    from public.lucky_rounds
   where user_id = p_user_id and client_request_id = p_client_request_id;
  if found then
    return query select v_existing.id, coalesce(v_profile.coins, 0),
      v_existing.payout, v_existing.multiplier, v_existing.is_jackpot, true,
      v_existing.result;
    return;
  end if;

  -- Extract the authoritative result the (trusted) API server computed.
  v_multiplier := coalesce((p_result->>'multiplier')::integer, 0);
  v_payout     := coalesce((p_result->>'payout')::integer, 0);
  v_is_jackpot := coalesce((p_result->>'isJackpot')::boolean, false);

  -- Defense-in-depth: a trusted caller should never produce these.
  if p_bet <= 0 then
    raise exception 'INVALID_BET';
  end if;
  if v_multiplier < 0 or v_payout < 0 then
    raise exception 'INVALID_RESULT';
  end if;

  -- Balance verification under the lock.
  if coalesce(v_profile.coins, 0) < p_bet then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  v_round_id            := gen_random_uuid();
  v_balance_after_debit := coalesce(v_profile.coins, 0) - p_bet;
  v_new_coins           := v_balance_after_debit + v_payout;

  update public.profiles set coins = v_new_coins where id = p_user_id;

  insert into public.lucky_rounds (
    id, user_id, room_id, game_type, bet, result, multiplier, payout,
    is_jackpot, status, client_request_id, config_version
  ) values (
    v_round_id, p_user_id, p_room_id, 'subha_lucky', p_bet, p_result,
    v_multiplier, v_payout, v_is_jackpot, 'completed', p_client_request_id,
    p_config_version
  );

  -- Ledger: debit the bet (balance_after = balance immediately after the bet).
  insert into public.financial_ledger (
    id, user_id, wallet_type, direction, amount, balance_after, reason,
    reference_type, reference_id, metadata
  ) values (
    gen_random_uuid(), p_user_id, 'coins', 'debit', p_bet, v_balance_after_debit,
    'lucky_spin_bet', 'lucky_round', v_round_id,
    jsonb_build_object('round_id', v_round_id, 'game_type', 'subha_lucky',
                       'config_version', p_config_version)
  );

  -- Ledger: credit the payout (only when there is a win; balance_after = final).
  if v_payout > 0 then
    insert into public.financial_ledger (
      id, user_id, wallet_type, direction, amount, balance_after, reason,
      reference_type, reference_id, metadata
    ) values (
      gen_random_uuid(), p_user_id, 'coins', 'credit', v_payout, v_new_coins,
      'lucky_spin_win', 'lucky_round', v_round_id,
      jsonb_build_object('round_id', v_round_id, 'game_type', 'subha_lucky',
                         'multiplier', v_multiplier,
                         'config_version', p_config_version)
    );
  end if;

  return query select v_round_id, v_new_coins, v_payout, v_multiplier,
    v_is_jackpot, false, p_result;
end;
$$;

-- Grant execution to the service role (Supabase API) ONLY.
--
-- IMPORTANT: unlike claim_host_task_reward() (which derives its reward
-- internally and is safe to expose to authenticated), fin_lucky_spin()
-- accepts a caller-supplied result/payout. Exposing it to `authenticated`
-- would let a browser (which holds the anon key + a user JWT) call it directly
-- and mint coins with an arbitrary payout. Only the Core API server — which
-- computes the authoritative outcome — may invoke it via the service role.
grant execute on function public.fin_lucky_spin(uuid, uuid, integer, text, jsonb, integer) to service_role;

