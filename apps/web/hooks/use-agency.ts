"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  agencyApi,
  type Agency,
  type AgencyApplication,
} from "@/lib/api/agency";

type AgencyView = "discover" | "my-agency";

export function useAgency() {
  const [myAgency, setMyAgency] = useState<Agency | null>(null);

  const [agencies, setAgencies] = useState<Agency[]>([]);

  const [applications, setApplications] = useState<
    AgencyApplication[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [view, setView] =
    useState<AgencyView>("discover");

  const [error, setError] = useState<string | null>(null);

  /**
   * --------------------------------------------------------------------------
   * LOAD CURRENT AGENCY + AVAILABLE AGENCIES
   * --------------------------------------------------------------------------
   */

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        currentAgency,
        availableAgencies,
      ] = await Promise.all([
        agencyApi.myAgency(),
        agencyApi.list(),
      ]);

      setMyAgency(currentAgency);
      setAgencies(availableAgencies);

      /*
       * If the user already belongs to an agency, don't show
       * the discovery screen.
       *
       * This also applies to pending memberships.
       */

      if (currentAgency) {
        setView("my-agency");
      } else {
        setView("discover");
      }
    } catch (err) {
      console.error(
        "Failed to load agency data:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load agency information.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * --------------------------------------------------------------------------
   * FILTER AGENCIES
   * --------------------------------------------------------------------------
   */

  const filteredAgencies = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return agencies;
    }

    return agencies.filter((agency) => {
      return (
        agency.name
          ?.toLowerCase()
          .includes(query) ||
        agency.description
          ?.toLowerCase()
          .includes(query) ||
        agency.country
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [agencies, search]);

  /**
   * --------------------------------------------------------------------------
   * JOIN AGENCY
   *
   * This does NOT immediately make the user a member.
   *
   * The backend:
   *
   * 1. verifies the agency code
   * 2. creates a pending membership
   * 3. returns the agency with membershipStatus = pending
   *
   * The owner must approve it before the user becomes approved.
   * --------------------------------------------------------------------------
   */

  const join = useCallback(
    async (
      agencyId: string,
      agencyCode: string,
    ) => {
      try {
        setJoining(agencyId);
        setError(null);

        const agency =
          await agencyApi.requestToJoin(
            agencyId,
            agencyCode,
          );

        setMyAgency(agency);

        setView("my-agency");

        /*
         * Remove the agency from discover results.
         *
         * The user now has an active application,
         * so they shouldn't be able to submit another
         * request from the discovery screen.
         */

        setAgencies((current) =>
          current.filter(
            (item) => item.id !== agencyId,
          ),
        );

        return agency;
      } catch (err) {
        console.error(
          "Failed to join agency:",
          err,
        );

        const message =
          err instanceof Error
            ? err.message
            : "Unable to submit agency application.";

        setError(message);

        throw err;
      } finally {
        setJoining(null);
      }
    },
    [],
  );

  /**
   * --------------------------------------------------------------------------
   * CANCEL PENDING APPLICATION / LEAVE AGENCY
   *
   * Backend decides what to do based on membership state:
   *
   * pending  -> cancel application
   * approved -> leave agency
   * --------------------------------------------------------------------------
   */

  const leave = useCallback(async () => {
    if (!myAgency) {
      return;
    }

    try {
      setError(null);

      await agencyApi.leave(myAgency.id);

      setMyAgency(null);

      setView("discover");

      /*
       * Reload agencies because the previously joined
       * agency may now be available in discovery again.
       */

      const availableAgencies =
        await agencyApi.list();

      setAgencies(availableAgencies);
    } catch (err) {
      console.error(
        "Failed to leave agency:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to leave agency.",
      );

      throw err;
    }
  }, [myAgency]);

  /**
   * --------------------------------------------------------------------------
   * REFRESH
   * --------------------------------------------------------------------------
   */

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    /**
     * Current user's agency.
     *
     * null      = no agency
     * pending   = waiting for owner
     * approved  = full membership
     */
    myAgency,

    /**
     * All discoverable agencies.
     */
    agencies,

    /**
     * Agencies filtered by search.
     */
    filteredAgencies,

    /**
     * Pending applications for current user.
     */
    applications,

    /**
     * UI state.
     */
    loading,
    joining,
    search,
    setSearch,
    view,
    setView,
    error,

    /**
     * Number of agencies available to discover.
     */
    totalAgencyCount: agencies.length,

    /**
     * Actions.
     */
    join,
    leave,
    refresh,
  };
}