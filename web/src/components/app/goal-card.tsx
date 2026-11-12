"use client";
import { ArrowRight, Check, Flag, Flame, Loader2, MoreHorizontal, PartyPopper, Search, BadgeCheck, Hammer } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { CopyLink } from "@/components/app/copy-link";
import { Button, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { dropGoal, reachGoal, setGoal } from "@/lib/goal-actions";
import { GOAL_KINDS, goalPath, goalTitle, isGoalKind, type Goal, type GoalKind, type Record_ } from "@/lib/goals";

// Your goal (Linear FIX-95), on your profile and Home: pick what you're working toward, see your path
// to it (built from your real record), the one next step, and close it when you get there. A goal
// picked on the landing page (?goal= at sign-up, kept in this browser) is suggested first.
const STEP_ICON = { build: Hammer, sign: BadgeCheck, found: Search } as const;
const SUGGESTED = "brazework-goal";

export function GoalCard({ goal, record, profileId, compact = false }: { goal: Goal | null; record: Record_; profileId: string; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const active = goal?.status === "active" ? goal : null;
  if (!active || editing) return <GoalPicker current={active} reached={goal?.status === "met" ? goal : null} onDone={() => setEditing(false)} compact={compact} />;
  return <GoalPath goal={active} record={record} profileId={profileId} onChange={() => setEditing(true)} compact={compact} />;
}

function GoalPicker({ current, reached, onDone, compact }: { current: Goal | null; reached: Goal | null; onDone: () => void; compact: boolean }) {
  const [picked, setKind] = useState<GoalKind | null>(current?.kind ?? null);
  // A goal picked on the landing page, carried through sign-up (read after hydration; null on the server).
  const suggested = useSyncExternalStore(() => () => {}, () => { try { return localStorage.getItem(SUGGESTED); } catch { return null; } }, () => null);
  const kind = picked ?? (!current && isGoalKind(suggested) ? suggested : null);
  const [target, setTarget] = useState(current?.target ?? "");
  const [visible, setVisible] = useState(current?.visible ?? true);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const save = () => kind && start(async () => {
    const r = await setGoal(kind, target, visible);
    setMsg(r.ok ? "" : r.message);
    if (r.ok) { try { localStorage.removeItem(SUGGESTED); } catch {} onDone(); }
  });
  return (
    <section aria-label="Your goal" className={cn("glass-card rounded-2xl", compact ? "p-4" : "p-5")}>
      {reached && !current && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-3 py-2 text-sm text-ok">
          <PartyPopper className="mt-0.5 size-4 shrink-0" /> <span><b className="font-semibold">Reached {goalTitle(reached)}.</b>{reached.met_note ? ` ${reached.met_note}` : ""}</span>
        </p>
      )}
      <h2 className="flex items-center gap-2 font-semibold"><Flag className="size-4" /> {current ? "Change your goal" : reached ? "What's next?" : "What are you working toward?"}</h2>
      <p className="mt-1 text-sm text-muted">Pick one. Your path to it, and the next step, come from what&apos;s on your record.</p>
      <div role="radiogroup" aria-label="Goal" className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(GOAL_KINDS) as GoalKind[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={cn("rounded-lg border px-2.5 py-1 text-sm transition", kind === k ? "border-text bg-text text-bg" : "border-line text-muted hover:border-line-strong hover:text-text")}>
            {GOAL_KINDS[k].label}
          </button>
        ))}
      </div>
      {kind && (
        <div className="mt-3 flex flex-col gap-2.5">
          <label className="text-sm font-medium">In what? <span className="font-normal text-faint">(optional)</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} maxLength={80} placeholder="e.g. power electronics, robotics, CRISPR" className={cn(inputCls, "mt-1.5")} />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-2">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Show it on my profile, so {GOAL_KINDS[kind].looking} can find me
          </label>
          {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />} {current ? "Save goal" : "Set my goal"}</Button>
            {current && <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>}
          </div>
        </div>
      )}
    </section>
  );
}

function GoalPath({ goal, record, profileId, onChange, compact }: { goal: Goal; record: Record_; profileId: string; onChange: () => void; compact: boolean }) {
  const { steps, done, next } = goalPath(goal, record);
  const [menu, setMenu] = useState(false);
  const [reaching, setReaching] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <section aria-label="Your goal" className={cn("glass-card rounded-2xl", compact ? "p-4" : "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">Working toward</p>
          <h2 className="truncate text-lg font-semibold tracking-tight">{goalTitle(goal)}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Ring value={done / 3} label={`${done}/3`} />
          <div className="relative">
            <button type="button" aria-label="Goal options" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-text"><MoreHorizontal className="size-4" /></button>
            {menu && (
              <div role="menu" className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-line bg-surface p-1 text-sm shadow-[var(--shadow)]">
                <button role="menuitem" type="button" onClick={() => { setMenu(false); setReaching(true); }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-hover">I got it!</button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); onChange(); }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-hover">Change goal</button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); start(async () => { const r = await dropGoal(); setMsg(r.ok ? "" : r.message); }); }} className="w-full rounded-lg px-3 py-2 text-left text-muted hover:bg-hover">Stop working toward it</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {reaching ? (
        <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await reachGoal(note); setMsg(r.ok ? "" : r.message); if (r.ok) setReaching(false); }); }}>
          <label className="text-sm font-medium">Congratulations. How did it go? <span className="font-normal text-faint">(optional, shown on your profile)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} placeholder="e.g. Accepted an offer at Volt Systems" className={cn(inputCls, "mt-1.5")} />
          </label>
          <div className="flex gap-2"><Button type="submit" disabled={pending}><PartyPopper className="size-4" /> Mark it reached</Button><Button type="button" variant="ghost" onClick={() => setReaching(false)}>Cancel</Button></div>
        </form>
      ) : (
        <>
          <ol className="mt-3 flex flex-col gap-1.5">
            {steps.map((s) => {
              const Icon = STEP_ICON[s.key];
              return (
                <li key={s.key} className={cn("flex gap-3 rounded-xl border px-3 py-2", s.state === "now" ? "border-line-strong bg-surface" : "border-line bg-surface/60")}>
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", s.state === "done" ? "bg-text text-bg" : s.state === "now" ? "border border-text" : "border border-line text-faint")}>
                    {s.state === "done" ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">{s.title}<span className="text-[11px] font-normal text-faint">{s.state === "done" ? "Done" : s.state === "now" ? "Now" : "Next"}</span></span>
                    <span className="block text-xs text-muted">{s.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 rounded-xl bg-[color-mix(in_oklab,#f28c28_10%,transparent)] px-3 py-2.5 text-[13px] leading-snug">
            <p className="flex items-start gap-2"><Flame className="mt-0.5 size-4 shrink-0 text-[#f28c28]" /><span><b className="font-semibold text-[#c2410c] dark:text-[#f28c28]">Next step:</b> <span className="text-text-2">{next.text}</span></span></p>
            <div className="mt-2 flex flex-wrap items-center gap-3 pl-6">
              {next.href === "share" ? <CopyLink path={`/u/${profileId}`} label={next.action} /> : <Link href={next.href} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">{next.action} <ArrowRight className="size-3.5" /></Link>}
              <Link href={`/copilot?q=${encodeURIComponent(`Help me plan my next step toward ${goalTitle(goal)}.`)}`} className="text-sm text-muted hover:text-text hover:underline">Ask Ember</Link>
            </div>
          </div>
        </>
      )}
      {msg && <p role="alert" className="mt-2 text-sm text-danger">{msg}</p>}
      {!goal.visible && <p className="mt-2 text-xs text-faint">Only you can see this goal.</p>}
    </section>
  );
}

function Ring({ value, label }: { value: number; label: string }) {
  const r = 15, c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-10 shrink-0 place-items-center" aria-label={`${label} steps done`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="text-[10px] font-semibold tabular-nums">{label}</span>
    </span>
  );
}

/** On someone else's profile: what they're working toward, or what they reached. */
export function GoalLine({ goal }: { goal: Goal }) {
  const met = goal.status === "met";
  return (
    <p className={cn("inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs", met ? "border-[color-mix(in_oklab,var(--ok)_30%,transparent)] text-ok" : "border-line text-text-2")}>
      {met ? <PartyPopper className="size-3.5 shrink-0" /> : <Flag className="size-3.5 shrink-0" />}
      <span className="truncate">{met ? `Reached ${goalTitle(goal)}${goal.met_note ? ` · ${goal.met_note}` : ""}` : `Working toward ${goalTitle(goal)}`}</span>
    </p>
  );
}
