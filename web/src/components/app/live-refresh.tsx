"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

// Supabase Realtime: when any of these tables change, re-render the current server page.
// Debounced like live() in the vanilla app's supabase.js. Row-level security still applies:
// the browser only hears about rows the signed-in person can read.
// `quietOn`: pages where it stays out of the way. Home is one: a refresh there re-renders the whole
// feed (~100 database requests) for a badge; its own "N new posts" pill covers posts (Linear FIX-77).
export function LiveRefresh({ tables, delay = 400, quietOn = [] }: { tables: string[]; delay?: number; quietOn?: string[] }) {
  const router = useRouter();
  const quiet = quietOn.join(",");
  const key = tables.join(",");
  useEffect(() => {
    // Read here, not with usePathname(): that would make every page using this wait to prerender.
    if (quiet && quiet.split(",").includes(window.location.pathname)) return;
    const sb = getBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = sb.channel(`live-${key}-${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(",")) {
      ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), delay);
      });
    }
    ch.subscribe();
    return () => {
      clearTimeout(timer);
      sb.removeChannel(ch);
    };
  }, [key, delay, router, quiet]);
  return null;
}
