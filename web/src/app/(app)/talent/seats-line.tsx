"use client";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { startSeats } from "@/lib/money";

// One quiet line under the search box for a verified company: search seats for the team, through
// Stripe Checkout when it's on, or a pilot request the founders answer (lib/money.ts startSeats()).
export function SeatsLine({ paid }: { paid: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (paid) return <p role="status" className="mt-2 text-xs text-ok">Seats added. Thank you: the founders will be in touch to set up your team.</p>;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1 text-xs text-muted" aria-live="polite">
      {msg ? <span className={msg.ok ? "text-ok" : "text-danger"}>{msg.message}</span> : <>
        <span>Search signed work for your whole team:</span>
        <button type="button" disabled={pending} onClick={() => start(async () => setMsg(await startSeats()))} className="inline-flex items-center gap-1 font-medium text-text underline-offset-4 hover:underline disabled:opacity-60">
          {pending && <Loader2 className="size-3 animate-spin" />} add seats
        </button>
      </>}
    </p>
  );
}
