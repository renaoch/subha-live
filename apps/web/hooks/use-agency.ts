"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  agencyApi,
  type Agency,
  type AgencyApplication,
} from "@/lib/api/agency";

type AgencyView =
  | "discover"
  | "my-agency";

export function useAgency() {
  const [myAgency, setMyAgency] =
    useState<Agency | null>(null);

  const [agencies, setAgencies] =
    useState<Agency[]>([]);

  const [applications, setApplications] =
    useState<AgencyApplication[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [joining, setJoining] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [view, setView] =
    useState<AgencyView>("discover");

  const [error, setError] =
    useState<string | null>(null);

  /*
   * Selected agency waiting for the user
   * to enter the private agency code.
   */
  const [
    selectedAgency,
    setSelectedAgency,
  ] = useState<Agency | null>(null);

  /*
   * Whether the join-code dialog should
   * be displayed.
   */
  const [
    joinDialogOpen,
    setJoinDialogOpen,
  ] = useState(false);

  /* ======================================================================== */
  /* LOAD                                                                     */
  /* ======================================================================== */

  const load = useCallback(
    async () => {
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

        setMyAgency(
          currentAgency,
        );

        setAgencies(
          availableAgencies,
        );

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
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* ======================================================================== */
  /* FILTER                                                                   */
  /* ======================================================================== */

  const filteredAgencies =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return agencies;
      }

      return agencies.filter(
        (agency) =>
          agency.name
            ?.toLowerCase()
            .includes(query) ||
          agency.description
            ?.toLowerCase()
            .includes(query) ||
          agency.country
            ?.toLowerCase()
            .includes(query),
      );
    }, [
      agencies,
      search,
    ]);

  /* ======================================================================== */
  /* OPEN JOIN FLOW                                                           */
  /* ======================================================================== */

  /*
   * This is the function passed to DiscoverPanel.
   *
   * DiscoverPanel gives us ONE Agency.
   *
   * We DO NOT submit the join request here.
   *
   * We first open the code-entry flow.
   */
  const join = useCallback(
    (agency: Agency) => {
      setSelectedAgency(
        agency,
      );

      setError(null);

      setJoinDialogOpen(
        true,
      );
    },
    [],
  );

  /* ======================================================================== */
  /* SUBMIT JOIN                                                              */
  /* ======================================================================== */

  const submitJoin = useCallback(
    async (
      agencyCode: string,
    ) => {
      if (!selectedAgency) {
        throw new Error(
          "No agency selected.",
        );
      }

      const code =
        agencyCode.trim();

      if (!code) {
        throw new Error(
          "Agency code is required.",
        );
      }

      const agencyId =
        selectedAgency.id;

      try {
        setJoining(
          agencyId,
        );

        setError(null);

        /*
         * THIS is where the actual API
         * request happens.
         */
        const agency =
          await agencyApi.requestToJoin(
            agencyId,
            code,
          );

        /*
         * Backend should return:
         *
         * membershipStatus = "pending"
         *
         * The user is NOT an approved
         * member yet.
         */
        setMyAgency(
          agency,
        );

        setView(
          "my-agency",
        );

        /*
         * Close the dialog.
         */
        setJoinDialogOpen(
          false,
        );

        setSelectedAgency(
          null,
        );

        /*
         * Remove the agency from discovery
         * because this user already has a
         * pending application.
         */
        setAgencies(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                agencyId,
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
    [selectedAgency],
  );

  /* ======================================================================== */
  /* CLOSE JOIN DIALOG                                                        */
  /* ======================================================================== */

  const cancelJoin = useCallback(
    () => {
      if (joining) {
        return;
      }

      setJoinDialogOpen(
        false,
      );

      setSelectedAgency(
        null,
      );

      setError(null);
    },
    [joining],
  );

  /* ======================================================================== */
  /* LEAVE / CANCEL APPLICATION                                               */
  /* ======================================================================== */

  const leave =
    useCallback(async () => {
      if (!myAgency) {
        return;
      }

      try {
        setError(null);

        await agencyApi.leave(
          myAgency.id,
        );

        setMyAgency(null);

        setView(
          "discover",
        );

        const availableAgencies =
          await agencyApi.list();

        setAgencies(
          availableAgencies,
        );
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

  /* ======================================================================== */
  /* REFRESH                                                                  */
  /* ======================================================================== */

  const refresh =
    useCallback(async () => {
      await load();
    }, [load]);

  /* ======================================================================== */
  /* RETURN                                                                   */
  /* ======================================================================== */

  return {
    /*
     * Current agency.
     *
     * null
     *   = no agency
     *
     * pending
     *   = waiting for owner
     *
     * approved
     *   = full membership
     */
    myAgency,

    /*
     * Discoverable agencies.
     */
    agencies,

    filteredAgencies,

    /*
     * Current user's applications.
     */
    applications,

    /*
     * Loading / UI state.
     */
    loading,

    joining,

    search,
    setSearch,

    view,
    setView,

    error,

    /*
     * Join-code state.
     */
    selectedAgency,

    joinDialogOpen,

    /*
     * Number of discoverable agencies.
     */
    totalAgencyCount:
      agencies.length,

    /*
     * Actions.
     */
    join,

    submitJoin,

    cancelJoin,

    leave,

    refresh,
  };
}