"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarPlus, Check, Flag, Loader2, Megaphone, Sparkles, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createPost } from "@/app/(app)/feed/actions";
import { joinCommunity } from "@/app/(app)/communities/actions";
import { saveEvent } from "@/app/(app)/org/actions";
import { Celebrate } from "@/components/app/celebrate";
import type { Proposal } from "@/lib/copilot-agent";
import { EVENT_FORMATS, EVENT_TYPES } from "@/lib/events";
import { cn } from "@/lib/forge";
import { addMilestone } from "@/lib/milestones";
import { toggleFollow } from "@/lib/network";

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-line-strong";
const HEAD = {
  post: { icon: Megaphone, title: "Post to the feed", done: "Posted", href: "/feed?tab=latest", go: "See it in the feed" },
  milestone: { icon: Flag, title: "Ask your club to verify", done: "Sent to the club", href: "/profile#projects", go: "See your projects" },
  join: { icon: Users, title: "Join a club", done: "Done", href: "", go: "Open the club" },
  follow: { icon: UserPlus, title: "Follow", done: "Following", href: "", go: "Open their profile" },
  event: { icon: CalendarPlus, title: "Host a club event", done: "Published", href: "", go: "See the club's events" },
} as const;

// ISO time <-> the value a datetime-local input wants (the member's own timezone).
const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => new Date(v).toISOString();

// A draft Copilot prepared. Nothing is saved until the member presses Confirm, which runs the
// app's normal server action (with all its checks) as them.
export function ProposalCard({ p: initial }: { p: Proposal }) {
  const [p, setP] = useState(initial);
  const [state, setState] = useState<"open" | "done" | "dismissed">("open");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const h = HEAD[p.kind];
  const href = p.kind === "join" ? `/c/${p.club_id}` : p.kind === "follow" ? `/u/${p.person_id}` : p.kind === "event" ? `/c/${p.club_id}?tab=events` : h.href;
  const set = (patch: Partial<Proposal>) => setP((cur) => ({ ...cur, ...patch }) as Proposal);

  const confirm = () => start(async () => {
    setMsg("");
    let r: { ok: boolean; message: string };
    if (p.kind === "post") {
      const f = new FormData();
      f.set("body", p.body); f.set("kind", p.postKind); p.tags.forEach((t) => f.append("tags", t)); f.set("media", "[]");
      r = await createPost({ ok: false, message: "", nonce: 0 }, f);
    } else if (p.kind === "milestone") {
      const f = new FormData();
      f.set("projectId", p.project_id); f.set("communityId", p.club_id); f.set("title", p.title); f.set("detail", p.detail); f.set("evidence", ""); f.set("achievedOn", p.achieved_on);
      r = await addMilestone({ ok: false, message: "" }, f);
    } else if (p.kind === "join") {
      r = await joinCommunity(p.club_id);
    } else if (p.kind === "follow") {
      r = await toggleFollow(p.person_id, true);
    } else {
      const f = new FormData();
      for (const k of ["title", "description", "type", "format", "location", "topic", "starts_at", "ends_at"] as const) f.set(k, String(p[k]));
      f.set("link", ""); f.set("community_id", p.club_id);
      r = await saveEvent({ ok: false, message: "" }, f);
    }
    if (r.ok) setState("done");
    else setMsg(r.message || "That didn't work. Check the details and try again.");
  });

  if (state === "dismissed") return <p className="mt-2 text-xs text-faint">Dismissed. Nothing was saved.</p>;
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("relative mt-3 rounded-2xl border p-4 text-sm whitespace-normal", state === "done" ? "border-[color-mix(in_oklab,var(--ok)_40%,transparent)] bg-[color-mix(in_oklab,var(--ok)_8%,transparent)]" : "grad-edge")}>
      {state === "done" && <Celebrate />}
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-lg", state === "done" ? "bg-ok text-white" : "bg-accent-grad text-on-accent")}>{state === "done" ? <Check className="size-4" /> : <h.icon className="size-4" />}</span>
        <span className="font-semibold text-text">{state === "done" ? h.done : h.title}</span>
        {state === "open" && <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-faint"><Sparkles className="size-3" /> Drafted by Copilot · not saved yet</span>}
      </div>

      {state === "done" ? (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-text hover:underline">{h.go} <ArrowRight className="size-4" /></Link>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {p.kind === "post" && (
            <>
              <textarea aria-label="Post text" value={p.body} onChange={(e) => set({ body: e.target.value })} maxLength={3000} rows={Math.min(8, 2 + Math.ceil(p.body.length / 70))} className={cn(field, "resize-y leading-relaxed")} />
              <div className="flex flex-wrap gap-1.5 text-xs text-muted"><span className="rounded-full bg-surface-2 px-2 py-0.5 capitalize">{p.postKind}</span>{p.tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5">#{t}</span>)}</div>
            </>
          )}
          {p.kind === "milestone" && (
            <>
              <p className="text-xs text-muted">On <b className="font-medium text-text-2">{p.project_title}</b>, for <b className="font-medium text-text-2">{p.club_name}</b> to verify</p>
              <input aria-label="Milestone" value={p.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={field} />
              <textarea aria-label="Details" value={p.detail} onChange={(e) => set({ detail: e.target.value })} maxLength={600} rows={2} placeholder="Details (optional)" className={cn(field, "resize-none")} />
              <input aria-label="Date" type="date" value={p.achieved_on} onChange={(e) => set({ achieved_on: e.target.value })} className={cn(field, "w-auto")} />
            </>
          )}
          {p.kind === "join" && <p className="text-text-2"><b className="font-medium">{p.club_name}</b> · {p.privacy === "public" ? "open to join" : "the club approves new members, so this sends a request"}</p>}
          {p.kind === "follow" && <p className="text-text-2"><b className="font-medium">{p.name}</b>{p.headline && <span className="text-muted"> · {p.headline}</span>}</p>}
          {p.kind === "event" && (
            <>
              <p className="text-xs text-muted">For <b className="font-medium text-text-2">{p.club_name}</b>. Members see it on the club page and in Events.</p>
              <input aria-label="Event title" value={p.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={field} />
              <textarea aria-label="Description" value={p.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} rows={3} className={cn(field, "resize-y")} />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted">Starts<input type="datetime-local" value={toLocal(p.starts_at)} onChange={(e) => e.target.value && set({ starts_at: fromLocal(e.target.value) })} className={cn(field, "mt-1")} /></label>
                <label className="text-xs text-muted">Ends<input type="datetime-local" value={toLocal(p.ends_at)} onChange={(e) => e.target.value && set({ ends_at: fromLocal(e.target.value) })} className={cn(field, "mt-1")} /></label>
                <label className="text-xs text-muted">Type<select value={p.type} onChange={(e) => set({ type: e.target.value })} className={cn(field, "mt-1")}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
                <label className="text-xs text-muted">Format<select value={p.format} onChange={(e) => set({ format: e.target.value })} className={cn(field, "mt-1")}>{EVENT_FORMATS.map((t) => <option key={t}>{t}</option>)}</select></label>
              </div>
              <input aria-label="Location" value={p.location} onChange={(e) => set({ location: e.target.value })} maxLength={160} placeholder="Where (room, building or link)" className={field} />
            </>
          )}
          <AnimatePresence>{msg && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="text-xs text-danger">{msg}</motion.p>}</AnimatePresence>
          <div className="flex items-center gap-2">
            <button type="button" onClick={confirm} disabled={pending} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent shadow-[0_8px_20px_-10px_var(--accent)] transition hover:-translate-y-px active:scale-95 disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirm
            </button>
            <button type="button" onClick={() => setState("dismissed")} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-muted hover:text-text"><X className="size-4" /> Dismiss</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
