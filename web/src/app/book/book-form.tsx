"use client";
import { Check, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { requestSales, type MoneyState } from "@/lib/money";
import { SALES, type SalesKind } from "@/lib/pricing";
import { submitWithoutReset } from "@/lib/submit";

// "Book a pilot" (supabase/money.sql request_sales()): what they'd like, their organization, a note.
// No email field: the request carries the account's email, and lands in the founders' admin queue.
export function BookForm({ kind: start, club, clubName, email }: { kind: SalesKind; club: string; clubName: string; email: string }) {
  const [state, action, pending] = useActionState<MoneyState, FormData>(requestSales, { ok: false, message: "" });
  const [kind, setKind] = useState<SalesKind>(start);
  const kinds = (Object.keys(SALES) as SalesKind[]).filter((k) => k !== "plus" || start === "plus");
  if (state.ok) return <p role="status" className="flex items-start gap-2 rounded-2xl border border-line bg-surface-2 p-4 text-[15px]"><Check className="mt-0.5 size-4 shrink-0 text-ok" /> {state.message}</p>;
  const org = SALES[kind].org;
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="What you'd like" className="grid gap-2">
        {kinds.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={cn("rounded-xl border p-3.5 text-left transition", kind === k ? "border-accent ring-[3px] ring-accent/15" : "border-line hover:border-line-strong")}>
            <span className="block font-medium">{SALES[k].label}</span>
            <span className="block text-sm text-muted">{SALES[k].ask}</span>
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="club" value={club} />
      {clubName && kind === "chapter" && <p className="text-sm text-text-2">For <strong className="font-medium">{clubName}</strong>.</p>}
      {org && (
        <Field label={org}>
          <input name="org" required minLength={2} maxLength={120} placeholder={org === "Company" ? "Acme Robotics" : "State University"} className={inputCls} />
        </Field>
      )}
      <Field label="Anything we should know?" optional>
        <textarea name="note" maxLength={500} rows={3} placeholder="How many people would search, which campuses, when you'd like to start…" className={cn(inputCls, "h-auto py-2.5")} />
      </Field>
      {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent hover:opacity-90 disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" />} {kind === "plus" ? "Join the waitlist" : "Send request"}
        </button>
        <span className="text-sm text-muted">We reply to {email || "your account email"}.</span>
      </div>
    </form>
  );
}
