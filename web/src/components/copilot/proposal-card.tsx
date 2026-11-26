"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, CalendarCheck, CalendarPlus, Check, ExternalLink, Flag, Loader2, Megaphone, MessageSquare, PenLine, PencilLine, Sparkles, Target, Bookmark, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createPost } from "@/app/(app)/feed/actions";
import { joinCommunity, postInCommunity } from "@/app/(app)/communities/actions";
import { saveEvent } from "@/app/(app)/org/actions";
import { Celebrate } from "@/components/app/celebrate";
import type { Proposal } from "@/lib/copilot-agent";
import { EVENT_FORMATS, EVENT_TYPES } from "@/lib/events";
import { cardLabels, cardSummary } from "@/lib/ember-bar";
import { emberAskToSign } from "@/lib/ember-sign";
import { ALL_TOPICS, cn } from "@/lib/forge";
import { LINKEDIN_PLACEHOLDER, LINKEDIN_PRIVATE, LINKEDIN_WHY } from "@/lib/linkedin";
import { addMilestone, reviewMilestone } from "@/lib/milestones";
import { saveProject, updateProjectFields } from "@/lib/projects";
import { addTeammate } from "@/lib/project-team";
import { dismissDraft, settleDraft } from "@/lib/tool-drafts";
import { acceptInviteCard } from "@/lib/invites";
import { toggleFollow } from "@/lib/network";
import { toggleRsvp } from "@/app/(app)/events/actions";
import { acceptConversation, messagePerson } from "@/lib/messages";
import { setGoal } from "@/lib/goal-actions";
import { rememberThis } from "@/lib/ember-memory";
import { GOAL_KINDS } from "@/lib/goals";
import { RELATIONSHIPS } from "@/lib/vouch-email";

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-line-strong";
const HEAD = {
  memory: { icon: Bookmark, title: "Remember this", done: "Remembered", href: "/settings#ember", go: "See what Jig remembers" },
  goal: { icon: Target, title: "Set your goal", done: "Goal set", href: "/feed", go: "See your path on Home" },
  post: { icon: Megaphone, title: "Post to the feed", done: "Posted", href: "/feed?tab=latest", go: "See it in the feed" },
  milestone: { icon: Flag, title: "Ask your club to verify", done: "Sent to the club", href: "/profile#projects", go: "See your projects" },
  signature: { icon: PenLine, title: "Ask them to sign", done: "Asked", href: "/profile#projects", go: "See your projects" },
  join: { icon: Users, title: "Join a club", done: "Done", href: "", go: "Open the club" },
  follow: { icon: UserPlus, title: "Follow", done: "Following", href: "", go: "Open their profile" },
  event: { icon: CalendarPlus, title: "Host a club event", done: "Published", href: "", go: "See the club's events" },
  club_post: { icon: Megaphone, title: "Post in your club", done: "Posted", href: "", go: "See it in the club" },
  review: { icon: BadgeCheck, title: "Review a milestone", done: "Reviewed", href: "", go: "Back to the queue" },
  project: { icon: Flag, title: "Add a project", done: "Added to your profile", href: "/profile#projects", go: "See your projects" },
  rsvp: { icon: CalendarCheck, title: "RSVP to an event", done: "You're going", href: "", go: "Open the event" },
  message: { icon: MessageSquare, title: "Send a message", done: "Sent", href: "/messages", go: "Open the conversation" },
  project_edit: { icon: PencilLine, title: "Update a project", done: "Saved", href: "", go: "Open the project" },
  teammate: { icon: UserPlus, title: "Add a teammate", done: "Added", href: "", go: "Open the project" },
  invite: { icon: Users, title: "Accept a club invite", done: "You're in", href: "", go: "Open the club" },
} as const;
// Shown under a field a card changes: what's there now.
const was = (v: string) => <span className="block text-[11px] text-faint">Now: {v ? (v.length > 140 ? `${v.slice(0, 140)}…` : v) : "empty"}</span>;

// ISO time <-> the value a datetime-local input wants (the member's own timezone).
const toLocal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => new Date(v).toISOString();

// A draft Copilot prepared, or one an AI tool left over MCP (fromTool: the same card, from /drafts and
// Jig's page; supabase/tool-actions.sql). Nothing is saved until the member presses Confirm, which
// runs the app's normal server action (with all its checks) as them; a tool's draft is then marked done.
// `inline`: in a page (under the Ask Jig bar, or a project's own drafts), the card is a short summary
// with buttons that say what happens ("Log and send to club", "Edit", "Not now"); Edit opens the fields.
export function ProposalCard({ p: initial, fromTool, inline = false }: { p: Proposal; fromTool?: { draftId: string; via: string; source: string }; inline?: boolean }) {
  const [p, setP] = useState(initial);
  const [state, setState] = useState<"open" | "done" | "dismissed">("open");
  const [msg, setMsg] = useState("");
  const [held, setHeld] = useState("");
  const [cid, setCid] = useState("");
  // The signature card: what the server said when it sent the ask, and the LinkedIn link a working
  // account adds first (the field shows only once the server asks for it).
  const [note, setNote] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [askLinkedin, setAskLinkedin] = useState(false);
  // The goal card: whether companies searching Brazework may see it. Off until the member says so.
  const [goalVisible, setGoalVisible] = useState(false);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const h = HEAD[p.kind];
  const labels = cardLabels(p.kind, inline);
  const short = inline && !editing ? cardSummary(p) : null;
  const href = p.kind === "join" || p.kind === "club_post" || p.kind === "invite" ? `/c/${p.club_id}` : p.kind === "follow" ? `/u/${p.person_id}` : p.kind === "event" ? `/c/${p.club_id}?tab=events` : p.kind === "review" ? "/communities" : p.kind === "rsvp" ? `/events/${p.event_id}` : p.kind === "message" && cid ? `/messages/${cid}` : p.kind === "project_edit" || p.kind === "teammate" ? `/projects/${p.project_id}` : h.href;
  const set = (patch: Partial<Proposal>) => setP((cur) => ({ ...cur, ...patch }) as Proposal);

  const confirm = () => start(async () => {
    setMsg("");
    // Optimistic: the card shows it's done at once, and goes back with the reason if the server says no.
    setState("done");
    try {
    let r: { ok: boolean; message: string };
    if (p.kind === "post") {
      const f = new FormData();
      f.set("body", p.body); f.set("kind", p.postKind); p.tags.forEach((t) => f.append("tags", t)); f.set("media", "[]");
      r = await createPost({ ok: false, message: "", nonce: 0 }, f);
    } else if (p.kind === "milestone") {
      const f = new FormData();
      f.set("projectId", p.project_id); f.set("communityId", p.club_id); f.set("title", p.title); f.set("detail", p.detail); f.set("evidence", p.evidence); f.set("achievedOn", p.achieved_on); f.set("showOnProfile", "on");
      r = await addMilestone({ ok: false, message: "" }, f);
    } else if (p.kind === "signature") {
      const res = await emberAskToSign({ milestone_id: p.milestone_id, project_id: p.project_id, title: p.title, evidence: p.evidence, detail: p.detail, achieved_on: p.achieved_on, email: p.email, relationship: p.relationship, linkedin });
      if (res.linkedin) setAskLinkedin(true);
      if (res.ok) setNote(res.message);
      r = res;
    } else if (p.kind === "join") {
      r = await joinCommunity(p.club_id);
    } else if (p.kind === "follow") {
      r = await toggleFollow(p.person_id, true);
    } else if (p.kind === "project") {
      const f = new FormData();
      f.set("title", p.title); f.set("summary", p.summary); f.set("details", p.details); f.set("link", p.link); f.set("status", p.status); f.set("year", p.year);
      p.tags.forEach((t) => f.append("tags", t));
      r = await saveProject({ ok: false, message: "" }, f);
    } else if (p.kind === "club_post") {
      const res = await postInCommunity(p.club_id, p.body, p.postKind, []);
      // Auto-moderation can hold a post for review; say so instead of "Posted".
      if (res.ok && res.held) { setHeld(res.message || "Held for a moderator to review before it shows."); }
      r = res;
    } else if (p.kind === "review") {
      r = await reviewMilestone(p.milestone_id, p.verify, p.note);
    } else if (p.kind === "rsvp") {
      r = await toggleRsvp(p.event_id, !p.cancel);
    } else if (p.kind === "memory") {
      r = await rememberThis(p.body);
    } else if (p.kind === "goal") {
      r = await setGoal(p.goal_kind, p.target, goalVisible);
    } else if (p.kind === "project_edit") {
      r = await updateProjectFields(p.project_id, { summary: p.summary, details: p.details, link: p.link, specs: p.specs });
    } else if (p.kind === "invite") {
      r = await acceptInviteCard(p.code);
    } else if (p.kind === "teammate") {
      r = await addTeammate(p.project_id, p.person_id, p.role);
    } else if (p.kind === "message") {
      // A reply to someone's message request accepts it first (the card says so), as in Messages.
      const acc = p.accepts ? await acceptConversation(p.accepts.conversation_id) : { ok: true, message: "" };
      const res = acc.ok ? await messagePerson(p.person_id, p.body) : { ...acc, cid: undefined };
      if (res.cid) setCid(res.cid);
      r = res;
    } else {
      const f = new FormData();
      for (const k of ["title", "description", "type", "format", "location", "topic", "starts_at", "ends_at"] as const) f.set(k, String(p[k]));
      f.set("link", ""); f.set("community_id", p.club_id);
      r = await saveEvent({ ok: false, message: "" }, f);
    }
    if (r.ok) {
      if (fromTool) await settleDraft(fromTool.draftId);
    } else { setState("open"); setMsg(r.message || "That didn't work. Check the details and try again."); }
    } catch { setState("open"); setMsg("That didn't work. Check your connection and try again."); }
  });
  const dismiss = () => start(async () => {
    if (fromTool) await dismissDraft(fromTool.draftId);
    setState("dismissed");
  });

  if (state === "dismissed") return <p className="mt-2 text-xs text-faint">Dismissed. Nothing was saved.</p>;
  return (
    <motion.div layout role="group" aria-label={`${h.title}${fromTool ? ` from ${fromTool.via}` : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("relative mt-3 rounded-2xl border p-4 text-sm whitespace-normal", state === "done" ? "border-[color-mix(in_oklab,var(--ok)_40%,transparent)] bg-[color-mix(in_oklab,var(--ok)_8%,transparent)]" : "grad-edge")}>
      {state === "done" && <Celebrate />}
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-lg", state === "done" ? "bg-ok text-white" : "bg-accent-grad text-on-accent")}>{state === "done" ? <Check className="size-4" /> : <h.icon className="size-4" />}</span>
        <span className="font-semibold text-text">{p.kind === "rsvp" && p.cancel ? (state === "done" ? "You're not going" : "Take back your RSVP") : state === "done" ? (held ? "Sent for review" : h.done) : h.title}</span>
        {state === "open" && <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-faint"><Sparkles className="size-3" /> Drafted by {fromTool ? fromTool.via : "Jig"} · not saved yet</span>}
      </div>

      {state === "done" ? (
        <>
          {held && <p className="mt-2 text-xs text-muted">{held}</p>}
          {note && <p className="mt-2 text-xs text-muted">{note}</p>}
          <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-text hover:underline">{h.go} <ArrowRight className="size-4" /></Link>
        </>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {short && (
            <div className="text-text-2">
              <p className="font-medium text-text">{short.title}</p>
              {short.lines.map((l) => <p key={l} className="mt-0.5 text-xs text-muted">{l}</p>)}
              {short.link && <a href={short.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-text underline underline-offset-4"><ExternalLink className="size-3 shrink-0" /> {short.link.replace(/^https?:\/\//, "")}</a>}
            </div>
          )}
          {!short && <>
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
              <input aria-label="Evidence link" type="url" value={p.evidence} onChange={(e) => set({ evidence: e.target.value })} maxLength={300} placeholder="Evidence: https://…" className={field} />
              <textarea aria-label="Details" value={p.detail} onChange={(e) => set({ detail: e.target.value })} maxLength={600} rows={2} placeholder="Details (optional)" className={cn(field, "resize-none")} />
              <input aria-label="Date" type="date" value={p.achieved_on} onChange={(e) => set({ achieved_on: e.target.value })} className={cn(field, "w-auto")} />
            </>
          )}
          {p.kind === "signature" && (
            <>
              <p className="text-xs text-muted">On <b className="font-medium text-text-2">{p.project_title}</b>, for the person who saw it to sign. They get one email with a link and don&apos;t need an account.</p>
              {p.milestone_id ? (
                <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                  <div className="font-medium text-text">{p.title}</div>
                  {p.detail && <p className="mt-1 text-xs text-text-2">{p.detail}</p>}
                  {p.evidence && <a href={p.evidence} target="_blank" rel="noopener noreferrer nofollow" className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-text underline underline-offset-4"><ExternalLink className="size-3 shrink-0" /> {p.evidence.replace(/^https?:\/\//, "")}</a>}
                </div>
              ) : (
                <>
                  <input aria-label="Milestone" value={p.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={field} />
                  <input aria-label="Evidence link" type="url" value={p.evidence} onChange={(e) => set({ evidence: e.target.value })} maxLength={300} placeholder="Evidence: https://…" className={field} />
                  <textarea aria-label="Details" value={p.detail} onChange={(e) => set({ detail: e.target.value })} maxLength={600} rows={2} placeholder="Details (optional)" className={cn(field, "resize-none")} />
                  <input aria-label="Date" type="date" value={p.achieved_on} onChange={(e) => set({ achieved_on: e.target.value })} className={cn(field, "w-auto")} />
                </>
              )}
              <div className="grid grid-cols-1 gap-2">
                <label className="text-xs text-muted">Their email<input aria-label="Their email" type="email" value={p.email} onChange={(e) => set({ email: e.target.value })} maxLength={254} autoComplete="off" placeholder="name@company.com" className={cn(field, "mt-1")} /></label>
                <label className="text-xs text-muted">They&apos;re<select aria-label="They're" value={p.relationship} onChange={(e) => set({ relationship: e.target.value })} className={cn(field, "mt-1")}>{Object.entries(RELATIONSHIPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              </div>
              <p className="text-[11px] text-faint">A work or university address carries the most weight; a personal one works too, and the signature says which kind it came from.</p>
              {askLinkedin && <label className="text-xs text-muted">Your LinkedIn profile<input aria-label="Your LinkedIn profile" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} maxLength={300} autoComplete="off" placeholder={LINKEDIN_PLACEHOLDER} className={cn(field, "mt-1")} /><span className="mt-1 block text-[11px] text-faint">{LINKEDIN_WHY} {LINKEDIN_PRIVATE}</span></label>}
            </>
          )}
          {p.kind === "project" && (
            <>
              {p.source && <p className="text-xs text-muted">From {p.source}: <a href={p.link} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">{p.link.replace(/^https?:\/\//, "")}</a></p>}
              <input aria-label="Project title" value={p.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={field} />
              <textarea aria-label="Summary" value={p.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={600} rows={2} className={cn(field, "resize-none")} />
              <details className="text-xs text-muted"><summary className="cursor-pointer">Write-up ({p.details.length} characters)</summary><textarea aria-label="Write-up" value={p.details} onChange={(e) => set({ details: e.target.value })} maxLength={5000} rows={6} className={cn(field, "mt-2 resize-y")} /></details>
              <div className="flex flex-wrap gap-1.5 text-xs text-muted"><span className="rounded-full bg-surface-2 px-2 py-0.5">{p.status === "completed" ? `Completed${p.year ? ` ${p.year}` : ""}` : "In progress"}</span>{p.tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5">#{t}</span>)}</div>
            </>
          )}
          {p.kind === "club_post" && (
            <>
              <p className="text-xs text-muted">In <b className="font-medium text-text-2">{p.club_name}</b>. Only the club sees it.</p>
              <textarea aria-label="Club post text" value={p.body} onChange={(e) => set({ body: e.target.value })} maxLength={3000} rows={Math.min(10, 3 + Math.ceil(p.body.length / 70))} className={cn(field, "resize-y leading-relaxed")} />
            </>
          )}
          {p.kind === "review" && (
            <>
              <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                <div className="text-xs text-muted">{p.member} asked {p.club_name} to verify</div>
                <div className="mt-0.5 font-medium text-text">{p.title}</div>
                {p.detail && <p className="mt-1 text-xs text-text-2">{p.detail}</p>}
                {p.evidence ? <a href={p.evidence} target="_blank" rel="noopener noreferrer nofollow" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-text underline underline-offset-4"><ExternalLink className="size-3" /> Open the evidence</a> : <p className="mt-1.5 text-xs text-faint">No evidence link.</p>}
              </div>
              <div role="radiogroup" aria-label="Decision" className="inline-flex gap-1 self-start rounded-full bg-surface-2 p-1">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" role="radio" aria-checked={p.verify === v} onClick={() => set({ verify: v })} className={cn("rounded-full px-3 py-1 text-xs font-medium transition", p.verify === v ? (v ? "bg-ok text-white" : "bg-danger text-white") : "text-muted")}>{v ? "Verify" : "Decline"}</button>
                ))}
              </div>
              <input aria-label="Note to the member" value={p.note} onChange={(e) => set({ note: e.target.value })} maxLength={300} placeholder={p.verify ? "Note (optional)" : "Why? They'll see this."} className={field} />
            </>
          )}
          {p.kind === "join" && <p className="text-text-2"><b className="font-medium">{p.club_name}</b> · {p.privacy === "public" ? "open to join" : "the club approves new members, so this sends a request"}</p>}
          {p.kind === "memory" && (
            <div className="space-y-1">
              <p className="text-text-2">&ldquo;{p.body}&rdquo;</p>
              <p className="text-xs text-muted">Jig will use this in your next chats. Only you can see it, and you can forget it any time in Settings.</p>
            </div>
          )}
          {p.kind === "goal" && (
            <div className="space-y-2">
              <p className="text-text-2">Work toward <b className="font-medium">{p.title}</b></p>
              {p.why && <p className="text-xs text-muted">{p.why}</p>}
              <p className="text-xs text-muted">Your path: log your work, get {GOAL_KINDS[p.goal_kind].target} milestones signed by {GOAL_KINDS[p.goal_kind].signers}, then get found by {GOAL_KINDS[p.goal_kind].looking}.</p>
              <label className="flex items-center gap-2 text-xs text-text-2">
                <input type="checkbox" checked={goalVisible} onChange={(e) => setGoalVisible(e.target.checked)} className="size-4 accent-[var(--text)]" />
                Let companies searching Brazework see this goal
              </label>
            </div>
          )}
          {p.kind === "rsvp" && (
            <p className="text-text-2"><b className="font-medium">{p.title}</b><span className="block text-xs text-muted">{new Date(p.starts_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{p.where && ` · ${p.where}`} · {p.going} going</span></p>
          )}
          {p.kind === "message" && (
            <>
              <p className="text-xs text-muted">To <b className="font-medium text-text-2">{p.name}</b>{p.headline && ` · ${p.headline}`}. {p.accepts ? <> Sending it accepts their message request.</> : <> If you aren&apos;t connected, it arrives as a message request.</>}</p>
              <textarea aria-label="Message" value={p.body} onChange={(e) => set({ body: e.target.value })} maxLength={2000} rows={Math.min(6, 2 + Math.ceil(p.body.length / 70))} className={cn(field, "resize-y leading-relaxed")} />
            </>
          )}
          {fromTool?.source && <p className="text-xs text-muted">{fromTool.source}</p>}
          {p.kind === "project_edit" && (
            <>
              <p className="text-xs text-muted">On <b className="font-medium text-text-2">{p.project_title}</b>. Only these change.</p>
              {p.summary !== undefined && <label className="text-xs text-muted">Summary<textarea aria-label="Summary" value={p.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={600} rows={3} className={cn(field, "mt-1 resize-y")} />{was(p.before.summary)}</label>}
              {p.details !== undefined && <label className="text-xs text-muted">Write-up<textarea aria-label="Write-up" value={p.details} onChange={(e) => set({ details: e.target.value })} maxLength={5000} rows={5} className={cn(field, "mt-1 resize-y")} />{was(p.before.details)}</label>}
              {p.link !== undefined && <label className="text-xs text-muted">Link<input aria-label="Link" value={p.link} onChange={(e) => set({ link: e.target.value })} maxLength={300} className={cn(field, "mt-1")} />{was(p.before.link)}</label>}
              {p.specs !== undefined && (
                <div className="text-xs text-muted">Specs
                  <ul className="mt-1 flex flex-wrap gap-1.5">{p.specs.map((x) => <li key={`${x.label}:${x.value}`} className="rounded-full bg-surface-2 px-2 py-0.5 text-text-2">{x.label}: {x.value}</li>)}</ul>
                  {was(p.before.specs.map((x) => `${x.label}: ${x.value}`).join(", "))}
                </div>
              )}
            </>
          )}
          {p.kind === "invite" && <p className="text-text-2">Join <b className="font-medium">{p.club_name}</b> with the invite link you were sent.</p>}
          {p.kind === "teammate" && <p className="text-text-2">Add <b className="font-medium">{p.name}</b>{p.headline && <span className="text-muted"> · {p.headline}</span>} to <b className="font-medium">{p.project_title}</b> as {p.role === "viewer" ? "a viewer (sees it, changes nothing)" : "a teammate (posts updates, logs milestones)"}.</p>}
          {p.kind === "follow" && <p className="text-text-2"><b className="font-medium">{p.name}</b>{p.headline && <span className="text-muted"> · {p.headline}</span>}</p>}
          {p.kind === "event" && (
            <>
              <p className="text-xs text-muted">For <b className="font-medium text-text-2">{p.club_name}</b>. Members see it on the club page and in Events.</p>
              <input aria-label="Event title" value={p.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className={field} />
              <textarea aria-label="Description" value={p.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} rows={3} className={cn(field, "resize-y")} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted">Starts<input type="datetime-local" value={toLocal(p.starts_at)} onChange={(e) => e.target.value && set({ starts_at: fromLocal(e.target.value) })} className={cn(field, "mt-1")} /></label>
                <label className="text-xs text-muted">Ends<input type="datetime-local" value={toLocal(p.ends_at)} onChange={(e) => e.target.value && set({ ends_at: fromLocal(e.target.value) })} className={cn(field, "mt-1")} /></label>
                <label className="text-xs text-muted">Type<select value={p.type} onChange={(e) => set({ type: e.target.value })} className={cn(field, "mt-1")}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
                <label className="text-xs text-muted">Format<select value={p.format} onChange={(e) => set({ format: e.target.value })} className={cn(field, "mt-1")}>{EVENT_FORMATS.map((t) => <option key={t}>{t}</option>)}</select></label>
                <label className="text-xs text-muted sm:col-span-2">Topic<select aria-label="Topic" value={p.topic} onChange={(e) => set({ topic: e.target.value })} className={cn(field, "mt-1")}><option value="" disabled>Pick a topic</option>{ALL_TOPICS.map((t) => <option key={t}>{t}</option>)}</select></label>
              </div>
              <input aria-label="Location" value={p.location} onChange={(e) => set({ location: e.target.value })} maxLength={160} placeholder="Where (room, building or link)" className={field} />
            </>
          )}
          </>}
          <AnimatePresence>{msg && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="text-xs text-danger">{msg}</motion.p>}</AnimatePresence>
          <div className="flex items-center gap-2">
            <button type="button" onClick={confirm} disabled={pending} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-on-accent transition active:scale-95 disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {labels.confirm}
            </button>
            {labels.edit && short && <button type="button" onClick={() => setEditing(true)} disabled={pending} className="inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-sm text-text-2 transition hover:bg-hover hover:text-text"><PencilLine className="size-4" /> {labels.edit}</button>}
            <button type="button" onClick={dismiss} disabled={pending} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-muted hover:text-text"><X className="size-4" /> {labels.dismiss}</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

