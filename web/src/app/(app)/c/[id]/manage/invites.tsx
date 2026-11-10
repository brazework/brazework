"use client";
import { Check, Copy, Link2, Loader2, Share2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";
import { createInvite, revokeInvite, type Invite } from "../../../communities/actions";

const DURATIONS: [number | null, string][] = [[1, "1 day"], [7, "7 days"], [30, "30 days"], [null, "Never"]];
const LIMITS: [number | null, string][] = [[10, "10 people"], [25, "25 people"], [100, "100 people"], [null, "No limit"]];

const status = (i: Invite) =>
  i.revoked ? "Turned off" : i.expires_at && Date.parse(i.expires_at) <= Date.now() ? "Expired" : i.max_uses !== null && i.uses >= i.max_uses ? "Used up" : "Active";

export function InviteLinks({ cid, clubName, origin, invites }: { cid: string; clubName: string; origin: string; invites: Invite[] }) {
  const [days, setDays] = useState<number | null>(7);
  const [limit, setLimit] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");
  const url = (code: string) => `${origin}/join/${code}`;

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(url(code)); setCopied(code); setTimeout(() => setCopied(""), 2000); } catch { setMsg("Copy didn't work. Select the link and copy it."); }
  };
  const share = async (code: string) => {
    if (navigator.share) {
      try { await navigator.share({ title: `Join ${clubName} on Brazework`, text: `You're invited to ${clubName} on Brazework.`, url: url(code) }); } catch {}
    } else void copy(code);
  };
  const chip = "rounded-full border border-line px-3 py-1 text-xs text-muted transition aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">New invite link</h2>
          <p className="mt-1 text-sm text-muted">Anyone with the link joins right away, without asking. Banned people still can&apos;t.</p>
        </div>
        <fieldset><legend className="mb-2 text-xs font-medium text-text-2">Expires after</legend>
          <div className="flex flex-wrap gap-1.5">{DURATIONS.map(([v, l]) => <button key={l} type="button" aria-pressed={days === v} onClick={() => setDays(v)} className={chip}>{l}</button>)}</div>
        </fieldset>
        <fieldset><legend className="mb-2 text-xs font-medium text-text-2">Who can use it</legend>
          <div className="flex flex-wrap gap-1.5">{LIMITS.map(([v, l]) => <button key={l} type="button" aria-pressed={limit === v} onClick={() => setLimit(v)} className={chip}>{l}</button>)}</div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pending} onClick={() => start(async () => { const r = await createInvite(cid, days, limit); setMsg(r.message); if (r.ok && r.code) void copy(r.code); })}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Create and copy link
          </Button>
          {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
        </div>
      </div>

      <div>
        <h2 className="font-semibold">Your links</h2>
        <ul className="mt-3 flex flex-col divide-y divide-line rounded-2xl border border-line">
          {invites.map((i) => {
            const st = status(i);
            const active = st === "Active";
            return (
              <li key={i.code} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !active && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm">{url(i.code).replace(/^https?:\/\//, "")}</div>
                  <div className="text-xs text-faint">
                    {st} · {i.uses}{i.max_uses !== null ? ` of ${i.max_uses}` : ""} joined{i.expires_at && active ? ` · expires ${new Date(i.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                  </div>
                </div>
                {active && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => copy(i.code)} aria-label="Copy link" className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-text">{copied === i.code ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
                    <button type="button" onClick={() => share(i.code)} aria-label="Share link" className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-text"><Share2 className="size-4" /></button>
                    <button type="button" disabled={pending} onClick={() => confirm("Turn this link off? People who already joined stay in.") && start(async () => setMsg((await revokeInvite(cid, i.code)).message))} className="ml-1 rounded-full px-3 py-1.5 text-xs text-danger hover:bg-hover">Turn off</button>
                  </div>
                )}
              </li>
            );
          })}
          {!invites.length && <li className="px-4 py-6 text-center text-sm text-muted">No links yet. Create one and share it in your club&apos;s group chat.</li>}
        </ul>
      </div>
    </div>
  );
}
