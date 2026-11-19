"use client";
import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { startPlus } from "@/lib/money";
import { cn } from "@/lib/forge";

// Get Plus: Stripe Checkout when Plus is on sale (the action redirects there), otherwise the waitlist.
// `yearly`: checkout by the year (only offered when its price is set). `quiet`: the second choice.
export function PlusButton({ label, yearly = false, quiet = false }: { label: string; yearly?: boolean; quiet?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  if (msg?.ok) return <p role="status" className="flex items-start gap-2 text-[15px]"><Check className="mt-0.5 size-4 shrink-0 text-ok" /> {msg.message}</p>;
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => setMsg(await startPlus(yearly)))}
        className={cn("inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg px-5 text-[15px] font-medium disabled:opacity-60", quiet ? "border border-line bg-surface text-text hover:bg-hover" : "bg-accent text-on-accent hover:opacity-90")}>
        {pending && <Loader2 className="size-4 animate-spin" />} {label}
      </button>
      {msg && !msg.ok && <p role="alert" className="text-sm text-danger">{msg.message}</p>}
    </div>
  );
}
