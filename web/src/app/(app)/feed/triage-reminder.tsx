"use client";
import { BellRing, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { saveDraftReminder } from "@/lib/settings";

// Under the triage list: turn on the once-a-day email (off by default; also in Settings → Email).
export function ReminderToggle() {
  const [state, setState] = useState<"off" | "on" | "error">("off");
  const [pending, start] = useTransition();
  if (state === "on") return <p role="status" className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted"><Check className="size-3.5" />We&apos;ll email you once a day when your tools notice something. Turn it off in Settings.</p>;
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => setState((await saveDraftReminder(true)).ok ? "on" : "error"))}
      className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted underline-offset-4 hover:text-text hover:underline disabled:opacity-50">
      <BellRing className="size-3.5" />{state === "error" ? "That didn't save. Try again" : "Email me once a day when my tools notice something"}
    </button>
  );
}
