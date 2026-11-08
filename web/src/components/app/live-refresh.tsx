"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

// Supabase Realtime: when any of these tables change, re-render the current server page.
// Debounced like live() in the vanilla app's supabase.js. Row-level security still applies:
// the browser only hears about rows the signed-in person can read.
export function LiveRefresh({ tables, delay = 400 }: { tables: string[]; delay?: number }) {
  const router = useRouter();
  const key = tables.join(",");
  useEffect(() => {
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
  }, [key, delay, router]);
  return null;
}
