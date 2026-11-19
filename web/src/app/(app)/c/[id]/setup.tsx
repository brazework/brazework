"use client";
import { ArrowRight, Check, Copy, Link2, Loader2, ScrollText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { DismissButton } from "@/components/app/dismiss";
import { inviteMessage, inviteUrl, setupProgress } from "@/lib/club-setup";
import { cn } from "@/lib/forge";
import type { GuideStep } from "@/lib/guide";
import { addStarterRules, clubInviteLink } from "../../communities/actions";

// "Set up your club", on the club page for its owner and admins until every step is done (or they
// hide it). The two steps that stall new clubs happen right here: get a link into the group chat
// people already use, and post rules. The rest link to where they're done.
export function ClubSetup({ cid, name, steps, origin, invite }: { cid: string; name: string; steps: GuideStep[]; origin: string; invite: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(invite);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);
  const { done, total, next } = setupProgress(steps);
  const url = code ? inviteUrl(origin, code) : "";
  const text = code ? inviteMessage(name, url) : "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { field.current?.focus(); field.current?.select(); setMsg("Copy didn't work here. The message is selected: copy it with your keyboard."); }
  };
  const getLink = () => {
    setBusy("invite"); setMsg("");
    start(async () => {
      const r = await clubInviteLink(cid);
      setBusy(null);
      if (r.ok && r.code) { setCode(r.code); router.refresh(); } else setMsg(r.message);
    });
  };
  const rules = () => {
    setBusy("rules"); setMsg("");
    start(async () => { const r = await addStarterRules(cid); setBusy(null); setMsg(r.message); if (r.ok) router.refresh(); });
  };

  return (
    <section aria-label="Set up your club" className="mt-4 rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Set up your club</h2>
          <p className="mt-0.5 text-sm text-muted">{done} of {total} done. Most clubs finish in about five minutes.</p>
        </div>
        <DismissButton id={`club-setup-${cid}`} label="Hide setup for this club" />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Setup progress">
        <div className="h-full rounded-full bg-[var(--ok)] transition-[width] duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      <ol className="mt-4 flex flex-col gap-1">
        {steps.map((s) => {
          const isNext = next?.id === s.id;
          return (
            <li key={s.id} className={cn("rounded-2xl px-3 py-2.5", isNext && "bg-surface-2/70")}>
              {/* On a phone the button drops under the text (indented past the check) instead of squeezing it to a word a line. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[11px]", s.done ? "border-transparent bg-[var(--ok)] text-white" : "border-line text-faint")} aria-hidden="true">{s.done ? <Check className="size-3.5" /> : null}</span>
                <span className="min-w-[min(100%,11rem)] flex-1">
                  <span className={cn("block text-sm", s.done ? "text-muted line-through decoration-line" : "font-medium text-text")}>{s.label}</span>
                  {isNext && <span className="block text-xs text-muted">{s.why}</span>}
                </span>
                {!s.done && s.id === "invite" && !code && (
                  <button type="button" onClick={getLink} disabled={busy !== null} className="ml-9 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-on-accent disabled:opacity-60 sm:ml-0">
                    {busy === "invite" ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />} Get invite link
                  </button>
                )}
                {!s.done && s.id === "rules" && (
                  <button type="button" onClick={rules} disabled={busy !== null} className="ml-9 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium hover:bg-hover disabled:opacity-60 sm:ml-0">
                    {busy === "rules" ? <Loader2 className="size-3.5 animate-spin" /> : <ScrollText className="size-3.5" />} Use starter rules
                  </button>
                )}
                {!s.done && s.id !== "invite" && s.id !== "rules" && (
                  <Link href={s.href} className="ml-9 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-text-2 hover:text-text sm:ml-0">{isNext ? "Do it" : "Open"} <ArrowRight className="size-3.5" /></Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* The invite, ready to paste into the group chat the club already uses. */}
      {code && steps.some((s) => (s.id === "invite" || s.id === "members") && !s.done) && (
        <div className="mt-3 rounded-2xl border border-line bg-surface-2/60 p-3">
          <p className="text-xs font-medium text-text-2">Paste this in your club&apos;s group chat</p>
          <textarea ref={field} readOnly value={text} rows={3} aria-label="Invite message" onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text-2" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent">{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy message"}</button>
            <span className="min-w-0 truncate font-mono text-xs text-muted">{url}</span>
          </div>
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-xs text-muted">{msg}</p>}
    </section>
  );
}
