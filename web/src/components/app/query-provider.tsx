"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// One client cache for data the browser fetches itself (the feed's later pages, Linear FIX-77).
// Mounted in the app layout, so it outlives page changes: back to Home reuses the pages you scrolled.
// Nothing refetches on focus or reconnect; feed pages are anchored to a moment and new posts arrive
// as the "N new posts" pill, so a cached page is never wrong, only older.
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: 2 },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
