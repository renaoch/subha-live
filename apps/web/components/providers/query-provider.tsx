// File: apps/web/components/providers/query-provider.tsx
//
// React Query is the "background fetching" engine: it caches responses per
// query key, serves cached data instantly on repeat visits, and silently
// revalidates in the background instead of blocking the UI on a spinner.
//
// Defaults below are tuned for a live-social app:
// - staleTime: data is considered fresh for 15s, so navigating between
//   pages (home -> profile -> home) doesn't refetch instantly.
// - refetchOnWindowFocus/refetchOnReconnect: pulls fresh data the moment the
//   tab regains focus or the network comes back, without user action.
// - retry: 1 network hiccup shouldn't nuke the whole screen.
// - gcTime: keep unused data around for 5 min so back-navigation is instant.

"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export { keepPreviousData };

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // Server: always make a new client.
  if (typeof window === "undefined") return makeQueryClient();
  // Browser: reuse a single client across renders/navigations.
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(getQueryClient);

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
