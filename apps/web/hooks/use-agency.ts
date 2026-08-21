// File: hooks/use-agency.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { agencyApi, type Agency } from "@/lib/api/agency";

export type AgencyView = "discover" | "my-agency";

export function useAgency() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [myAgency, setMyAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<AgencyView>("discover");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [agencyList, mine] = await Promise.all([
        agencyApi.list(),
        agencyApi.me(),
      ]);

      setAgencies(agencyList);
      setMyAgency(mine.agency);
    } catch (err) {
      console.error("AGENCY API ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to load agencies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredAgencies = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return agencies;

    return agencies.filter((agency) =>
      [agency.name, agency.code].some((field) =>
        field.toLowerCase().includes(value),
      ),
    );
  }, [agencies, search]);

  const join = useCallback(
    async (agency: Agency) => {
      if (joining) return;

      try {
        setJoining(agency.id);
        setError(null);
        await agencyApi.join(agency.id);
        await load();
      } catch (err) {
        console.error("AGENCY JOIN ERROR:", err);
        setError(err instanceof Error ? err.message : "Unable to join agency.");
      } finally {
        setJoining(null);
      }
    },
    [joining, load],
  );

  const leave = useCallback(async () => {
    try {
      setError(null);
      await agencyApi.leave();
      await load();
      setView("discover");
    } catch (err) {
      console.error("AGENCY LEAVE ERROR:", err);
      setError(err instanceof Error ? err.message : "Unable to leave agency.");
    }
  }, [load]);

  return {
    myAgency,
    loading,
    joining,
    search,
    setSearch,
    view,
    setView,
    error,
    filteredAgencies,
    totalAgencyCount: agencies.length,
    join,
    leave,
    refresh: load,
  };
}