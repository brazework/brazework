"use client";
import { useActionState, useState, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { decideClaim, requestClaim, withdrawClaim, type ClaimState } from "@/lib/club-claims";
import { submitWithoutReset } from "@/lib/submit";

const init: ClaimState = { ok: false, message: "" };

// The claim form on /c/[id]/claim.
export function ClaimForm({ cid, clubName }: { cid: string; clubName: string }) {
  const [state, action, pending] = useActionState(requestClaim, init);
  if (state.ok) return <p role="status" className="rounded-2xl bg-ok/10 p-4 text-sm text-ok">{state.message}</p>;
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-4">
      <input type="hidden" name="cid" value={cid} />
      <Field label={`Your role in ${clubName}`} hint="As the organization itself would say it.">
        <input name="role" required minLength={2} maxLength={80} placeholder="President" className={inputCls} />
      </Field>
      <Field label="How we can check it" hint="A link to a page that lists the officers (school, national organization or the club's own site), or the advisor who can confirm it.">
        <textarea name="evidence" required minLength={10} maxLength={600} rows={4} placeholder="https://… lists me as president. Our advisor, Dr. Lee, can confirm." className={cn(inputCls, "h-auto py-2.5")} />
      </Field>
      {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <div><Button type="submit" disabled={pending}>Send claim</Button></div>
    </form>
  );
}

export function WithdrawClaim({ id, cid }: { id: number; cid: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ClaimState>(init);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => setMsg(await withdrawClaim(id, cid)))} className="h-8 rounded-full border border-line px-3 text-xs hover:bg-hover disabled:opacity-50">Withdraw</button>
      {msg.message && !msg.ok && <span role="alert" className="text-xs text-danger">{msg.message}</span>}
    </span>
  );
}

// Approve or deny on /admin, with an optional note the claimant sees if denied.
export function ClaimDecision({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<ClaimState>(init);
  const run = (approve: boolean) => start(async () => setMsg(await decideClaim(id, approve, note)));
  return (
    <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (optional)" aria-label="Note for the claimant" className="h-8 min-w-0 flex-1 rounded-full border border-line bg-transparent px-3 text-xs sm:w-44 sm:flex-none" />
      <button type="button" disabled={pending} onClick={() => run(true)} className="h-8 rounded-full bg-accent px-3 text-xs font-medium text-on-accent disabled:opacity-50">Approve</button>
      <button type="button" disabled={pending} onClick={() => run(false)} className="h-8 rounded-full border border-line px-3 text-xs hover:bg-hover disabled:opacity-50">Deny</button>
      {msg.message && !msg.ok && <span role="alert" className="text-xs text-danger">{msg.message}</span>}
    </span>
  );
}
