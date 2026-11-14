"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Building2, CalendarDays, Check, Heart, Lock, MessageSquare, RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/forge";
import { CountUp } from "./count-up";

const STEPS = [
  { title: "Build it, with your club", body: "Your club runs here: members, events, chat and announcements in one place, instead of a group chat, a form and a spreadsheet. You log what you build as you go, and Ember does the busywork." },
  { title: "Get it signed", body: "Ask for a result to be verified, with its evidence. A club officer who saw it happen signs it by name. No club? A professor, PI or manager who saw it can vouch instead." },
  { title: "Get found", body: "Companies and labs search signed work, not résumés. They sponsor the clubs behind it and message you through a requests inbox you control." },
];

// The landing is black and white (FIX-92): the active step, its bar and the buttons are the text colour.
const BRASS = "var(--text)";

const URLS = ["brazework.com/c/robotics-team", "brazework.com/projects/rover-nav", "brazework.com/inbox"];

// Three steps on the left, joined by a rail that fills as the loop goes round; a live mock of the app
// for the active step on the right, in a browser frame whose address follows the step. Steps advance
// on their own (the bar under the active step) until someone picks one. Each mock plays its moment
// (FIX-92): someone joins, a milestone gets verified, a company reaches out. Reduced motion: still.
export function HowItWorks() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center [&>*]:min-w-0">
      <div>
        <ol className="relative flex flex-col gap-2">
          {/* The rail behind the step numbers, filled up to the active step. */}
          <span aria-hidden="true" className="absolute top-10 bottom-10 left-[2.6rem] w-px bg-line">
            <span className="absolute inset-x-0 top-0 block origin-top transition-[height] duration-700 ease-out" style={{ height: `${(step / (STEPS.length - 1)) * 100}%`, background: BRASS }} />
          </span>
          {STEPS.map((s, n) => (
            <li key={s.title} className="relative">
              <button
                type="button"
                aria-pressed={n === step}
                onClick={() => { setAuto(false); setStep(n); }}
                className={cn(
                  "relative w-full overflow-hidden rounded-2xl border p-6 text-left transition duration-300",
                  n === step ? "border-line-strong bg-surface shadow-[var(--shadow)]" : "border-transparent hover:bg-surface/70",
                )}
              >
                <div className="flex items-start gap-4">
                  <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ring-4 ring-bg transition", n === step ? "text-bg" : n < step ? "bg-text text-bg" : "bg-surface-2 text-muted")} style={n === step ? { background: BRASS } : undefined}>
                    {n < step ? <Check className="size-4" /> : n + 1}
                  </span>
                  <div>
                    <h3 className={cn("text-lg font-semibold tracking-tight transition", n !== step && "text-text-2")}>{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
                  </div>
                </div>
                {n === step && auto && !reduce && (
                  <span key={`bar-${step}`} className="step-progress absolute inset-x-0 bottom-0 h-0.5 origin-left" style={{ background: BRASS }} onAnimationEnd={() => setStep((v) => (v + 1) % STEPS.length)} aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ol>
        <p className="m-hide mt-4 flex items-center gap-2 pl-6 text-sm text-muted"><RefreshCw className="size-4 shrink-0" /> Then sponsors back the club behind the work, and the loop starts again.</p>
      </div>

      {/* The product, in a browser frame. */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_40px_100px_-50px_rgb(0_0_0/0.45)]">
        <div className="flex items-center gap-3 border-b border-line bg-surface-2/70 px-4 py-2.5" aria-hidden="true">
          <span className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-line-strong" />)}</span>
          <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-md bg-bg/70 px-3 py-1 font-mono text-[11px] text-muted">
            <Lock className="size-3 shrink-0" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={step} className="truncate" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>{URLS[step]}</motion.span>
            </AnimatePresence>
          </span>
          <span className="w-[42px]" />
        </div>
        <div className="relative min-h-[420px] bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-[size:16px_16px] p-4 sm:p-6" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              {step === 0 ? <ClubMock play={!reduce} /> : step === 1 ? <ProjectMock play={!reduce} /> : <InboxMock play={!reduce} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const card = "rounded-xl border border-line bg-surface p-4 shadow-sm";
const Dot = ({ g, t }: { g: string; t: string }) => <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: g }}>{t}</span>;

// Children appear one after another; each mock's pieces are motion.divs with these.
const stagger = (play: boolean) => ({ initial: play ? "hidden" : false, animate: "shown", variants: { shown: { transition: { staggerChildren: 0.22, delayChildren: 0.1 } } } }) as const;
const item = { variants: { hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } } } as const;

/** Text that types itself out after `delay` ms (whole text at once with reduced motion). */
function Typed({ text, play, delay = 0, speed = 22 }: { text: string; play: boolean; delay?: number; speed?: number }) {
  const [n, setN] = useState(play ? 0 : text.length);
  useEffect(() => {
    if (!play) return;
    let i = 0, t: ReturnType<typeof setTimeout>;
    const tick = () => { i += 1; setN(i); if (i < text.length) t = setTimeout(tick, speed); };
    t = setTimeout(tick, delay);
    return () => clearTimeout(t);
  }, [play, text, delay, speed]);
  return <>{text.slice(0, n)}{n < text.length && <span className="ml-px inline-block h-[1em] w-px translate-y-[2px] animate-pulse bg-current" />}</>;
}

/** Turns true after `ms` (immediately with reduced motion). */
function useAfter(ms: number, play: boolean) {
  const [on, setOn] = useState(!play);
  useEffect(() => { if (!play) return; const t = setTimeout(() => setOn(true), ms); return () => clearTimeout(t); }, [ms, play]);
  return on;
}

function ClubMock({ play }: { play: boolean }) {
  const joined = useAfter(900, play);
  return (
    <motion.div {...stagger(play)} className="flex flex-col gap-3">
      <motion.div {...item} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div className="h-16" style={{ background: "linear-gradient(135deg,#18181b,#52525b)" }} />
        <div className="flex items-center gap-3 p-4">
          <span className="-mt-10 grid size-14 place-items-center rounded-xl border-4 border-surface bg-text text-lg font-semibold text-bg">RT</span>
          <div className="min-w-0 flex-1"><div className="font-semibold">Robotics Team</div><div className="text-xs text-muted">{joined ? <CountUp from={141} to={142} duration={500} /> : 141} members · Approval to join</div></div>
          <motion.span animate={joined ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 0.4 }} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", joined ? "text-bg" : "border border-line text-text")} style={joined ? { background: BRASS } : undefined}>
            {joined ? "Joined" : "Join"}
          </motion.span>
        </div>
      </motion.div>
      <motion.div {...item} className={card}>
        <div className="flex items-center gap-3"><Dot g="linear-gradient(135deg,#3f3f46,#71717a)" t="PN" /><div className="text-sm"><b>Priya Nair</b> <span className="text-muted">· Captain</span></div></div>
        <p className="mt-2 min-h-[2.5rem] text-sm text-text-2"><Typed play={play} delay={700} text="Build night Thursday 7pm: drivetrain swap and the first autonomous run. Pizza on us." /></p>
      </motion.div>
      <motion.div {...item} className={cn(card, "flex items-center gap-3")}>
        <span className="grid size-10 place-items-center rounded-lg bg-surface-2"><CalendarDays className="size-5" /></span>
        <div className="flex-1 text-sm"><b>Competition prep</b><div className="text-xs text-muted">Sat 10:00 · Engineering lab</div></div>
        <span className="flex -space-x-2">
          {["#27272a", "#52525b", "#a1a1aa"].map((c, i) => <motion.span key={c} initial={play ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: 1 + i * 0.18, type: "spring", stiffness: 500, damping: 20 }} className="size-6 rounded-full border-2 border-surface" style={{ background: c }} />)}
        </span>
        <span className="text-xs text-muted">+<CountUp from={30} to={38} duration={1400} /></span>
      </motion.div>
    </motion.div>
  );
}

function ProjectMock({ play }: { play: boolean }) {
  const MILESTONES = ["Simulation passes all 12 courses", "First outdoor run", "Competition run: 0.3 m path error"];
  const verified = useAfter(2300, play);
  return (
    <motion.div {...stagger(play)} className="flex flex-col gap-3">
      <motion.div {...item} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <div className="relative grid h-40 place-items-center" style={{ background: "linear-gradient(135deg,#09090b,#3f3f46)" }}>
          <span className="grid size-14 place-items-center rounded-full bg-white/90 text-slate-900 shadow-xl"><span className="ml-1 border-y-[9px] border-l-[14px] border-y-transparent border-l-current" /></span>
          <span className="absolute bottom-3 left-3 rounded-md bg-black/50 px-2 py-0.5 font-mono text-[11px] text-white">0:42 · autonomous run</span>
          {/* The video plays: its progress bar fills, then starts again. */}
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15"><motion.span className="block h-full origin-left" style={{ background: BRASS }} initial={{ scaleX: play ? 0 : 0.6 }} animate={play ? { scaleX: [0, 1] } : {}} transition={{ duration: 6, ease: "linear", repeat: Infinity }} /></span>
        </div>
        <div className="p-4">
          <div className="font-semibold">Autonomous rover navigation stack</div>
          <div className="mt-1 flex gap-4 text-xs text-muted"><span className="inline-flex items-center gap-1"><Heart className="size-3.5" /> <CountUp from={70} to={86} /></span><span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" /> 14</span></div>
        </div>
      </motion.div>
      <motion.div {...item} className={card}>
        <div className="text-xs font-medium text-faint">Milestones</div>
        <ul className="mt-3 flex flex-col gap-2.5 text-sm">
          {MILESTONES.map((t, i) => (
            <li key={t} className="flex items-center gap-2.5">
              <motion.span initial={play ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: 0.7 + i * 0.45, type: "spring", stiffness: 500, damping: 18 }} className="grid size-5 place-items-center rounded-full bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] text-ok"><Check className="size-3" /></motion.span>
              <span className="text-text-2">{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 h-6">
          <AnimatePresence>{verified && <motion.span initial={play ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 rounded-md bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-1 text-xs font-medium text-ok"><BadgeCheck className="size-3.5" /> Verified by the club&apos;s officers</motion.span>}</AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InboxMock({ play }: { play: boolean }) {
  const typing = !useAfter(900, play);
  const nudge = useAfter(3600, play);
  return (
    <motion.div {...stagger(play)} className="flex flex-col gap-3">
      <motion.div {...item} className={card}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-text text-bg"><Building2 className="size-5" /></span>
          <div className="flex-1 text-sm"><div className="flex items-center gap-1 font-semibold">Autonomy team recruiter <BadgeCheck className="size-4 text-info" /></div><div className="text-xs text-muted">Verified company · in Requests</div></div>
        </div>
        <p className="mt-3 min-h-[3.75rem] rounded-xl rounded-tl-sm bg-surface-2 p-3 text-sm text-text-2">
          {typing
            ? <span className="inline-flex gap-1" aria-label="Typing">{[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-faint" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />)}</span>
            : <Typed play={play} text="Hi Priya, we watched your rover's competition run. Our autonomy team would love to talk about a summer internship." speed={16} />}
        </p>
        <div className="mt-3 flex gap-2">
          <motion.span animate={nudge && play ? { scale: [1, 1.06, 1] } : {}} transition={{ duration: 0.45 }} className="rounded-md px-3 py-1.5 text-xs font-medium text-bg" style={{ background: BRASS }}>Accept</motion.span>
          <span className="rounded-md border border-line px-3 py-1.5 text-xs text-muted">Decline</span>
        </div>
      </motion.div>
      <motion.div {...item} className={cn(card, "flex items-center gap-3")}>
        <span className="grid size-10 place-items-center rounded-lg bg-surface-2"><Users className="size-5" /></span>
        <div className="flex-1 text-sm"><b><CountUp to={11} /> companies</b> follow your work<div className="text-xs text-muted">Only you can see this</div></div>
      </motion.div>
      <motion.div {...item} className={cn(card, "flex items-center gap-3")}>
        <span className="grid size-10 place-items-center rounded-lg bg-surface-2"><CalendarDays className="size-5" /></span>
        <div className="flex-1 text-sm"><b>Autonomy tech talk</b><div className="text-xs text-muted">Hosted by a verified company · next to your club&apos;s events</div></div>
      </motion.div>
    </motion.div>
  );
}
