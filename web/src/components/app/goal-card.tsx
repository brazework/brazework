"use client";
import { emberCreditCost } from "@/lib/ember-credits";
import { ArrowRight, Briefcase, Building2, CalendarCheck, Check, ChevronLeft, Eye, FlaskConical, GraduationCap, HandCoins, Loader2, Lock, MoreHorizontal, PartyPopper, Pencil, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { CopyLink } from "@/components/app/copy-link";
import { Button, inputCls, menuCls, menuItemCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { askTorch } from "@/lib/ember-bar";
import { dropGoal, reachGoal, setGoal } from "@/lib/goal-actions";
import { GOAL_HELP, GOAL_KINDS, goalChoices, goalPath, goalTitle, isGoalKind, torchGoalFrom, torchNext, torchWeek, type Goal, type GoalKind, type Record_ } from "@/lib/goals";

// Your goal (Linear FIX-95), on your profile and Home: pick what you're working toward, see your path
// to it (built from your real record), the one next step, and close it when you get there. A goal
// picked on the landing page (?goal= at sign-up, kept in this browser) is suggested first.
//
// The setup (redesign Nov 26, Josh: "the flow of setting up goal should be better"): two short steps in
// the same card. 1. the goals as tiles, each saying what it means, in the order that fits a student or
// someone who works. 2. one sentence to finish ("I'm working toward a summer internship in …") with a
// few examples, who can see it, and how it will read on your profile. Edit reopens step 2, filled in.
// Torch (FIX-95, #265) sits on top of it: say it in your own words on step 1 and Torch drafts the goal
// as a card you approve; on the path, the next step's main button hands it to Torch.
// No flags (Josh: "i dont like the flag"): the goal's mark is a dot in a ring (GoalMark).
const SUGGESTED = "brazework-goal";
type AccountType = "student" | "professional" | null | undefined;

export const GOAL_ICON: Record<GoalKind, typeof Briefcase> = { internship: Briefcase, job: Building2, grad: GraduationCap, research: FlaskConical, competition: Trophy, funding: HandCoins };

export function GoalCard({ goal, record, profileId, accountType, compact = false }: { goal: Goal | null; record: Record_; profileId: string; accountType?: AccountType; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [returned, setReturned] = useState(false);
  const active = goal?.status === "active" ? goal : null;
  if (!active || editing) return <GoalSetup current={active} reached={goal?.status === "met" ? goal : null} accountType={accountType} onDone={() => { setEditing(false); setReturned(true); }} compact={compact} />;
  return <GoalPath goal={active} record={record} profileId={profileId} onEdit={() => setEditing(true)} returnFocus={returned} compact={compact} />;
}

const cardCls = (compact: boolean) => cn("glass-card rounded-2xl", compact ? "p-4 sm:p-5" : "p-5");
const tileIconCls = "grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-text-2 [&_svg]:size-4";
const focusCls = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]";

function GoalSetup({ current, reached, accountType, onDone, compact }: { current: Goal | null; reached: Goal | null; accountType: AccountType; onDone: () => void; compact: boolean }) {
  // A goal picked on the landing page, carried through sign-up (read after hydration; null on the server).
  const suggested = useSyncExternalStore(() => () => {}, () => { try { return localStorage.getItem(SUGGESTED); } catch { return null; } }, () => null);
  const hint = !current && isGoalKind(suggested) ? suggested : null;
  const [kind, setKind] = useState<GoalKind | null>(current?.kind ?? null);
  const [step, setStep] = useState<1 | 2>(current ? 2 : 1);
  const [target, setTarget] = useState(current?.target ?? "");
  const [words, setWords] = useState("");
  const [visible, setVisible] = useState(current?.visible ?? true);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const tiles = useRef<Partial<Record<GoalKind, HTMLButtonElement | null>>>({});
  // Opened with Edit (a goal already set): focus goes straight into the sentence.
  const moved = useRef(!!current);
  const choices = goalChoices(accountType);
  const labelOf = (k: GoalKind) => choices.find((c) => c.kind === k)?.label ?? GOAL_KINDS[k].label;

  // Moving between the steps moves focus with you: into the sentence, or back to the goal you'd picked.
  useEffect(() => {
    if (!moved.current) return;
    if (step === 2) input.current?.focus();
    else if (kind) tiles.current[kind]?.focus();
  }, [step, kind]);
  const go = (s: 1 | 2) => { moved.current = true; setMsg(""); setStep(s); };
  const pick = (k: GoalKind) => { if (k !== kind) setTarget(k === current?.kind ? current.target : ""); setKind(k); go(2); };
  const back = () => (current ? onDone() : go(1));

  const save = () => kind && start(async () => {
    const r = await setGoal(kind, target, visible);
    setMsg(r.ok ? "" : r.message);
    if (r.ok) { try { localStorage.removeItem(SUGGESTED); } catch {} onDone(); }
  });

  if (step === 1 || !kind) {
    return (
      <section aria-label="Your goal" className={cardCls(compact)}>
        {reached && !current && (
          <p className="mb-4 flex items-start gap-2 rounded-xl bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-3 py-2 text-sm text-ok">
            <PartyPopper className="mt-0.5 size-4 shrink-0" /> <span><b className="font-semibold">Reached {goalTitle(reached)}.</b>{reached.met_note ? ` ${reached.met_note}` : ""}</span>
          </p>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight">{current ? "Change your goal" : reached ? "What's next?" : "What are you working toward?"}</h2>
          <span className="shrink-0 text-xs text-faint">Step 1 of 2</span>
        </div>
        <p className="mt-1 text-sm text-muted">Say it in your own words and Torch sets it up from your record, or pick one below. You can change it any time.</p>
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); const a = torchGoalFrom(words); if (a) { askTorch(a.prompt); setWords(""); } }}>
          <label className="sr-only" htmlFor={`${id}-words`}>Where are you headed?</label>
          <div className="flex gap-2">
            <input id={`${id}-words`} value={words} onChange={(e) => setWords(e.target.value)} maxLength={200} autoComplete="off" placeholder="e.g. a summer internship at a robotics startup" aria-describedby={`${id}-words-note`} className={cn(inputCls, "min-w-0 flex-1")} />
            <Button type="submit" disabled={!torchGoalFrom(words)} aria-label={`Ask Torch to set it up, ${emberCreditCost("ask")}`}><Sparkles className="size-4" /><span className="hidden sm:inline">Ask Torch</span></Button>
          </div>
          <p id={`${id}-words-note`} className="mt-1.5 text-xs text-faint">Torch drafts the goal as a card you approve · {emberCreditCost("ask")}</p>
        </form>
        <p className="mt-4 flex items-center gap-3 text-xs text-faint" aria-hidden="true"><span className="h-px flex-1 bg-[var(--border)]" />or pick one<span className="h-px flex-1 bg-[var(--border)]" /></p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {choices.map(({ kind: k, label }) => {
            const Icon = GOAL_ICON[k];
            const on = k === (kind ?? hint);
            return (
              <li key={k} className="min-w-0">
                <button ref={(el) => { tiles.current[k] = el; }} type="button" onClick={() => pick(k)} aria-label={label} aria-describedby={`${id}-${k}`}
                  className={cn("group flex h-full w-full gap-3 rounded-xl border p-3 text-left transition", focusCls,
                    on ? "border-line-strong bg-surface-2" : "border-line bg-surface/40 hover:border-line-strong hover:bg-hover")}>
                  <span aria-hidden="true" className={cn(tileIconCls, "hidden transition group-hover:text-text sm:grid")}><Icon /></span>
                  <span className="min-w-0">
                    <span aria-hidden="true" className="flex items-center gap-1.5 text-sm font-medium text-text"><Icon className="size-3.5 shrink-0 text-text-2 sm:hidden" />{label}{k === hint && !kind && <span className="rounded-full border border-line px-1.5 text-[10px] font-normal text-muted">Your pick</span>}</span>
                    <span id={`${id}-${k}`} className="mt-0.5 block text-xs leading-snug text-muted">{GOAL_HELP[k].line}{k === hint && !kind ? " (you picked this when you signed up)" : ""}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {current && <div className="mt-3"><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button></div>}
      </section>
    );
  }

  const k = GOAL_KINDS[kind], help = GOAL_HELP[kind], Icon = GOAL_ICON[kind];
  const preview = goalTitle({ kind, target: target.replace(/\s+/g, " ").trim() });
  return (
    <section aria-label="Your goal" className={cardCls(compact)}
      onKeyDown={(e) => { if (e.key === "Escape" && !pending) { e.stopPropagation(); back(); } }}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(1)} className={cn("-ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted transition hover:text-text", focusCls)}>
          <ChevronLeft className="size-3.5" /> All goals
        </button>
        <span className="text-xs text-faint">Step 2 of 2</span>
      </div>
      <form className="mt-2 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2 className="flex items-center gap-3 text-[15px] font-semibold tracking-tight">
          <span aria-hidden="true" className={tileIconCls}><Icon /></span>
          <span>{labelOf(kind)}<span className="block text-xs font-normal text-muted">{help.line}</span></span>
        </h2>

        <div>
          <label htmlFor={`${id}-target`} className="text-sm font-medium">In what field? <span className="font-normal text-faint">(optional)</span></label>
          <input id={`${id}-target`} ref={input} value={target} onChange={(e) => setTarget(e.target.value)} maxLength={80} autoComplete="off"
            placeholder={`e.g. ${help.examples[0]}`} aria-describedby={`${id}-ex`} className={cn(inputCls, "mt-1.5")} />
          <div id={`${id}-ex`} className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-faint">Examples:</span>
            {help.examples.map((ex) => (
              <button key={ex} type="button" onClick={() => { setTarget(ex); input.current?.focus(); }} aria-pressed={target === ex}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs transition", focusCls, target === ex ? "border-text bg-text text-bg" : "border-line text-text-2 hover:border-line-strong hover:text-text")}>{ex}</button>
            ))}
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Who can see it</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            <Choice name={`${id}-vis`} checked={visible} onChange={() => setVisible(true)} icon={<Eye />} title="On my profile"
              body={`So ${k.looking} can find you.${help.openTo ? ` Adds "Open to ${help.openTo}".` : ""}`} />
            <Choice name={`${id}-vis`} checked={!visible} onChange={() => setVisible(false)} icon={<Lock />} title="Only me"
              body="Your path and next step still work. Nobody else sees the goal." />
          </div>
        </fieldset>

        <div className="rounded-xl border border-dashed border-line px-3 py-2.5" aria-live="polite">
          <p className="text-[13px] font-medium text-faint">{visible ? "How it reads on your profile" : "Only you will see"}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-text"><GoalMark className="size-3.5 shrink-0 text-muted" /> <span className="min-w-0">Working toward {preview}</span></p>
        </div>

        {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {current ? "Save goal" : "Set my goal"}</Button>
          <Button type="button" variant="ghost" onClick={back} disabled={pending}>{current ? "Cancel" : "Back"}</Button>
          <span className="ml-auto hidden text-xs text-faint sm:inline">Esc to go back</span>
        </div>
      </form>
    </section>
  );
}

// One of two choices (who can see the goal): a real radio, drawn as a card.
function Choice({ name, checked, onChange, icon, title, body }: { name: string; checked: boolean; onChange: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <label className={cn("flex cursor-pointer gap-2.5 rounded-xl border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)]",
      checked ? "border-text bg-surface-2" : "border-line hover:border-line-strong hover:bg-hover")}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span aria-hidden="true" className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", checked ? "border-text" : "border-line-strong")}>
        {checked && <span className="size-2 rounded-full bg-text" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-text [&_svg]:size-3.5 [&_svg]:text-muted">{icon}{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{body}</span>
      </span>
    </label>
  );
}

function GoalPath({ goal, record, profileId, onEdit, returnFocus, compact }: { goal: Goal; record: Record_; profileId: string; onEdit: () => void; returnFocus: boolean; compact: boolean }) {
  const { steps, done, next } = goalPath(goal, record);
  const torch = torchNext(goal, record), week = torchWeek(goal);
  const [menu, setMenu] = useState(false);
  const [reaching, setReaching] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const menuBtn = useRef<HTMLButtonElement>(null);
  const Icon = GOAL_ICON[goal.kind];
  // The next step's "#projects" is on your profile; from Home it opens your profile there.
  const href = next.href.startsWith("#") && compact ? `/u/${profileId}${next.href}` : next.href;
  const closeMenu = () => { setMenu(false); menuBtn.current?.focus(); };
  // Back from Edit (saved or cancelled): focus returns to the Edit button, not the top of the page.
  const editBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (returnFocus) editBtn.current?.focus(); }, [returnFocus]);
  return (
    <section aria-label="Your goal" className={cardCls(compact)}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={cn(tileIconCls, "mt-0.5 hidden sm:grid")}><Icon /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Working toward</p>
          <h2 className="text-[17px] leading-snug font-semibold tracking-tight text-balance">{goalTitle(goal)}</h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-faint [&_svg]:size-3.5">
            {goal.visible ? <><Eye /> On your profile, for {GOAL_KINDS[goal.kind].looking}</> : <><Lock /> Only you can see it</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Ring value={done / 3} label={`${done}/3`} />
          <button ref={editBtn} type="button" onClick={onEdit} aria-label="Edit goal" className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted transition hover:bg-hover hover:text-text", focusCls)}>
            <Pencil className="size-3.5" /><span aria-hidden="true" className="hidden sm:inline">Edit</span>
          </button>
          <div className="relative" onKeyDown={(e) => { if (e.key === "Escape" && menu) { e.stopPropagation(); closeMenu(); } }}>
            <button ref={menuBtn} type="button" aria-label="Goal options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className={cn("grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-text", focusCls)}><MoreHorizontal className="size-4" /></button>
            {menu && (
              <div role="menu" className={cn(menuCls, "absolute right-0 z-10 mt-1 w-52")}>
                <button role="menuitem" type="button" autoFocus onClick={() => { setMenu(false); setReaching(true); }} className={menuItemCls}><PartyPopper className="size-4" /> I got it!</button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); start(async () => { const r = await dropGoal(); setMsg(r.ok ? "" : r.message); }); }} className={cn(menuItemCls, "text-muted")}>Stop working toward it</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {reaching ? (
        <form className="mt-4 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await reachGoal(note); setMsg(r.ok ? "" : r.message); if (r.ok) setReaching(false); }); }}>
          <label className="text-sm font-medium">Congratulations. How did it go? <span className="font-normal text-faint">(optional, shown on your profile)</span>
            <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} placeholder="e.g. Accepted an offer at Volt Systems" className={cn(inputCls, "mt-1.5")} />
          </label>
          <div className="flex gap-2"><Button type="submit" disabled={pending}><PartyPopper className="size-4" /> Mark it reached</Button><Button type="button" variant="ghost" onClick={() => setReaching(false)}>Cancel</Button></div>
        </form>
      ) : (
        <>
          <ol aria-label={`Your path: ${done} of 3 done`} className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {steps.map((s, i) => (
              <li key={s.key} className="min-w-0">
                <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <span className={cn("block h-full rounded-full bg-text transition-[width] duration-700", s.state === "done" ? "w-full" : s.state === "now" ? "w-1/3" : "w-0")} />
                </span>
                <span className="mt-2 flex items-center gap-1.5 text-[13px] font-medium">
                  <span aria-hidden="true" className={cn("grid size-4 shrink-0 place-items-center rounded-full text-[10px] tabular-nums", s.state === "done" ? "bg-text text-bg" : "border border-line-strong text-muted")}>{s.state === "done" ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}</span>
                  {s.title}
                  <span className={cn("ml-auto text-[11px] font-normal", s.state === "now" ? "text-text" : "text-faint")}>{s.state === "done" ? "Done" : s.state === "now" ? "Now" : "Next"}</span>
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{s.detail}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-muted">Next step</p>
                <p className="mt-0.5 text-sm leading-snug text-text-2">{next.text}</p>
              </div>
              {/* Torch does it: the ask opens in the Ask Torch bar, with cards to approve (FIX-95). The way to do it yourself stays beside it. */}
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button type="button" onClick={() => askTorch(torch.prompt)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg bg-text px-3 text-xs font-semibold text-bg transition hover:opacity-90 active:scale-95", focusCls)}>
                  <Sparkles className="size-3.5" /> {torch.label}
                </button>
                {next.href === "share"
                  ? <CopyLink path={`/u/${profileId}`} label={next.action} className="h-8 px-3 text-xs font-medium" />
                  : <Link href={href} className={cn("inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-text-2 transition hover:border-line-strong hover:text-text", focusCls)}>{next.action} <ArrowRight className="size-3.5" /></Link>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
              <p className="text-xs text-faint">Torch drafts it; nothing happens until you approve · {emberCreditCost("ask")}</p>
              <button type="button" onClick={() => askTorch(week.prompt)} className={cn("-my-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-hover hover:text-text", focusCls)}>
                <CalendarCheck className="size-3.5" /> {week.label}
              </button>
            </div>
          </div>
        </>
      )}
      {msg && <p role="alert" className="mt-2 text-sm text-danger">{msg}</p>}
    </section>
  );
}

function Ring({ value, label }: { value: number; label: string }) {
  const r = 15, c = 2 * Math.PI * r;
  return (
    <span role="img" className="relative grid size-10 shrink-0 place-items-center" aria-label={`${label} steps done`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="3" />
        {/* The track used var(--line), which isn't a CSS variable (only the Tailwind token is), so it never drew; and at 0 a round cap draws a dot. */}
        {value > 0 && <circle cx="18" cy="18" r={r} fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-[stroke-dashoffset] duration-700" />}
      </svg>
      <span aria-hidden="true" className="text-[10px] font-semibold tabular-nums">{label}</span>
    </span>
  );
}

/** The goal's mark (no flags): a point to aim at, in a ring. */
export function GoalMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.75" />
      <circle cx="8" cy="8" r="2.25" fill="currentColor" />
    </svg>
  );
}

/** On someone else's profile: what they're working toward, or what they reached. */
export function GoalLine({ goal }: { goal: Goal }) {
  const met = goal.status === "met";
  return (
    <p className={cn("inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs", met ? "border-[color-mix(in_oklab,var(--ok)_30%,transparent)] text-ok" : "border-line text-text-2")}>
      {met ? <PartyPopper className="size-3.5 shrink-0" /> : <GoalMark className="size-3.5 shrink-0 text-muted" />}
      <span className="truncate">{met ? `Reached ${goalTitle(goal)}${goal.met_note ? ` · ${goal.met_note}` : ""}` : `Working toward ${goalTitle(goal)}`}</span>
    </p>
  );
}
