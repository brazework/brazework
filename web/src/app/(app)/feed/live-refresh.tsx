"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

// Supabase Realtime: when posts change, re-render the server feed (debounced like live() in supabase.js).
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const sb = getBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = sb
      .channel(`feed-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      sb.removeChannel(ch);
    };
  }, [router]);
  return null;
}
