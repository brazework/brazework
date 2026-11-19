"use client";
import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { startPlus } from "@/lib/money";

// Get Plus: Stripe Checkout when Plus is on sale (the action redirects there), otherwise the waitlist.
export function PlusButton({ label }: { label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (msg?.ok) return <p role="status" className="flex items-start gap-2 text-[15px]"><Check className="mt-0.5 size-4 shrink-0 text-ok" /> {msg.message}</p>;
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => setMsg(await startPlus()))}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent hover:opacity-90 disabled:opacity-60">
        {pending && <Loader2 className="size-4 animate-spin" />} {label}
      </button>
      {msg && !msg.ok && <p role="alert" className="text-sm text-danger">{msg.message}</p>}
    </div>
  );
}
