-- ============================================================================
-- Agency commission versioning
-- ----------------------------------------------------------------------------
-- Every change to an agency's commission_rate is recorded as an immutable
-- version row. The effective rate applied to any historical gift is already
-- captured per-transaction in agency_commissions.rate_applied (written by
-- fin_send_gift at gift time), so changing the current rate never rewrites
-- previously earned commissions — the version table is the audit trail that
-- links a rate change to a point in time.
-- ============================================================================

create table if not exists public.agency_commission_versions (
  id              uuid primary key default gen_random_uuid(),
  agency_id       text not null references public.agencies (id) on delete cascade,
  version         integer not null,
  commission_rate numeric not null check (commission_rate >= 0),
  changed_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint agency_commission_versions_agency_version_unique unique (agency_id, version)
);

create index if not exists agency_commission_versions_agency_idx
  on public.agency_commission_versions (agency_id, version desc);
