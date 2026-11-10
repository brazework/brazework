"use client";
import { Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Field, inputCls } from "@/components/ui";
import { cn, ALL_TOPICS } from "@/lib/forge";
import { closeChallenge, createChallenge, enterChallenge, placeEntry, publishChallenge, setSponsorship, sponsorChallenge, withdrawEntry, type ChallengeState } from "@/lib/challenges";

const init: ChallengeState = { ok: false, message: "" };
const btn = "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition disabled:opacity-50";
const primary = cn(btn, "bg-accent text-on-accent shadow-[var(--shadow)] hover:opacity-90");
const outline = cn(btn, "border border-line text-text hover:border-line-strong hover:bg-hover");
const Note = ({ s }: { s: ChallengeState }) => s.message ? <p role={s.ok ? "status" : "alert"} className={cn("text-sm", s.ok ? "text-ok" : "text-danger")}>{s.message}</p> : null;

// A button that runs one server action and shows its answer underneath.
function ActionButton({ run, label, busy, variant = "primary", confirm }: { run: () => Promise<ChallengeState>; label: string; busy: string; variant?: "primary" | "outline"; confirm?: string }) {
  const [pending, start] = useTransition();
  const [s, setS] = useState(init);
  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => { if (confirm && !window.confirm(confirm)) return; start(async () => setS(await run())); }}
        className={variant === "primary" ? primary : outline}
      >
        {pending ? <><Loader2 className="size-4 animate-spin" /> {busy}</> : label}
      </button>
      <Note s={s} />
    </span>
  );
}

export function SponsorControls({ id, status, sponsorship, entries }: { id: string; status: string; sponsorship: string; entries: number }) {
  if (status === "draft") {
    if (sponsorship === "paid" || sponsorship === "pilot")
      return <ActionButton run={() => publishChallenge(id)} label="Publish to every club" busy="Publishing…" />;
    if (sponsorship === "requested")
      return <p className="text-sm text-text-2">Sponsorship requested. Once it&apos;s approved (or paid), you can publish.</p>;
    return <ActionButton run={() => sponsorChallenge(id)} label="Sponsor this challenge" busy="Starting…" />;
  }
  if (status === "open")
    return <ActionButton run={() => closeChallenge(id)} label="Close entries and judge" busy="Closing…" variant="outline" confirm={`Close entries now? ${entries} ${entries === 1 ? "entry" : "entries"} so far.`} />;
  if (status === "judging")
    return <ActionButton run={() => closeChallenge(id)} label="Announce winners" busy="Announcing…" />;
  return null;
}

export function PlaceButtons({ challengeId, entryId, placement }: { challengeId: string; entryId: number; placement: number | null }) {
  const [pending, start] = useTransition();
  const [s, setS] = useState(init);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex gap-1" role="group" aria-label="Place">
        {[1, 2, 3].map((p) => (
          <button
            key={p}
            type="button"
            disabled={pending}
            aria-pressed={placement === p}
            onClick={() => start(async () => setS(await placeEntry(challengeId, entryId, placement === p ? null : p)))}
            className={cn("h-8 rounded-full border px-3 text-xs font-medium transition", placement === p ? "border-text bg-text text-bg" : "border-line text-muted hover:text-text")}
          >
            {["1st", "2nd", "3rd"][p - 1]}
          </button>
        ))}
      </span>
      {!s.ok && <Note s={s} />}
    </span>
  );
}

export function WithdrawButton({ challengeId, entryId }: { challengeId: string; entryId: number }) {
  return <ActionButton run={() => withdrawEntry(challengeId, entryId)} label="Withdraw" busy="Withdrawing…" variant="outline" confirm="Withdraw your entry?" />;
}

export function EnterForm({ challengeId, projects }: { challengeId: string; projects: { id: string; title: string }[] }) {
  const [s, action, pending] = useActionState(enterChallenge, init);
  if (!projects.length)
    return <p className="text-sm text-muted">Add a project first, then enter it here. <Link href="/projects" className="text-text underline">Add a project</Link></p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="challengeId" value={challengeId} />
      <Field label="Your project">
        <select id="entry-project" name="projectId" className={inputCls} required defaultValue="">
          <option value="" disabled>Choose a project…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </Field>
      <Field label="Note to the sponsor" optional>
        <textarea name="note" maxLength={1000} rows={3} className={inputCls} placeholder="What you built for this, and where to look first." />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={primary}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />} Enter this project</button>
        <Note s={s} />
      </div>
    </form>
  );
}

export function CreateChallengeForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [s, action, pending] = useActionState(createChallenge, init);
  useEffect(() => { if (s.ok && s.id) router.push(`/challenges/${s.id}`); }, [s, router]);
  // The date picker is local time; send an exact moment.
  const onSubmit = (ev: React.SyntheticEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const v = String(fd.get("deadline") ?? "");
    fd.set("deadline", v ? new Date(v).toISOString() : "");
    startTransition(() => action(fd));
  };
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="orgId" value={orgId} />
      <Field label="Title"><input id="challenge-title" name="title" maxLength={120} className={inputCls} required placeholder="Lightest flight computer that logs at 100 Hz" /></Field>
      <Field label="Brief" hint="What to build, the constraints, and how you'll judge it."><textarea id="challenge-brief" name="brief" rows={6} maxLength={4000} className={inputCls} required /></Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Prize" optional><input id="challenge-prize" name="prize" maxLength={200} className={inputCls} placeholder="$1,000 + interviews" /></Field>
        <Field label="Topic" optional><select name="topic" className={inputCls} defaultValue=""><option value="">Any</option>{ALL_TOPICS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Deadline"><input id="challenge-deadline" name="deadline" type="datetime-local" className={inputCls} required /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={primary}>{pending && <Loader2 className="size-4 animate-spin" />} Save draft</button>
        <Note s={s} />
      </div>
    </form>
  );
}

export function SponsorshipDecision({ id }: { id: string }) {
  return (
    <span className="flex flex-wrap gap-2">
      <ActionButton run={() => setSponsorship(id, "pilot")} label="Approve pilot" busy="Approving…" />
      <ActionButton run={() => setSponsorship(id, "paid")} label="Mark paid" busy="Saving…" variant="outline" />
      <ActionButton run={() => setSponsorship(id, "unpaid")} label="Decline" busy="Declining…" variant="outline" confirm="Decline this sponsorship request?" />
    </span>
  );
}
