"use client";
import { useEffect } from "react";
import { BUILD_KEY, cleanBuild } from "@/lib/front-door";

// /signup?build=<line> (from the landing page's "What are you building?" box): keep it in this
// browser so the first-build box on Today opens with it already typed (app/(app)/feed/first-build.tsx).
// Nothing is sent anywhere until they tap "Start my build".
export function RememberBuild({ build }: { build: string }) {
  useEffect(() => { const b = cleanBuild(build); if (b) try { localStorage.setItem(BUILD_KEY, b); } catch {} }, [build]);
  return null;
}
