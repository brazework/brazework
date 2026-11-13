"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck, Briefcase, Check, Flame, FlaskConical, GraduationCap, Hammer, Rocket, Search, Trophy, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";
import { cleanBuild, signupHref } from "@/lib/front-door";
import { Orb } from "./orb";

// The hero: one clear line, then something to try. Type what you're building and it becomes the
// first step of the path card, live; pick what you're working toward (Linear FIX-95) and the card
// shows the rest: the proof it takes and who signs it, who's looking for exactly that, and Ember's
// next step. The goals cycle until you pick one or start typing. The button carries both into
// sign-up (?goal= and ?build=, lib/front-door.ts). Everything you didn't type is example data.
const GOALS = [
  {
    id: "internship", label: "Internship", icon: Briefcase, title: "a summer internship",
    line: "Companies hiring interns search signed work in your field. Show them three real milestones, not a list of courses.",
    build: "Battery management board, updated weekly", prove: { done: 2, of: 3, by: "your club or a mentor" },
    looking: "Volt Systems · power electronics intern", next: "Log Tuesday's scope captures as a milestone and ask Dr. Lee to vouch.",
  },
  {
    id: "job", label: "First job", icon: Rocket, title: "your first full-time role",
    line: "Hiring teams filter by verified results. A project with real users or real load, signed by people who saw it, beats a polished résumé.",
    build: "Campus shuttle tracker, 2.1k weekly riders", prove: { done: 3, of: 4, by: "a manager or your club" },
    looking: "Northwind Software · new-grad engineer", next: "Add the load test from Friday; your officer can sign it this week.",
  },
  {
    id: "grad", label: "Grad school", icon: GraduationCap, title: "grad school",
    line: "Programs want research you can explain. A professor who vouches for what they saw goes next to your application.",
    build: "Thrust stand calibration study", prove: { done: 1, of: 2, by: "a professor or PI" },
    looking: "MSc Robotics programs · reviewing applicants", next: "Write up the method and ask your advisor to vouch for the results.",
  },
  {
    id: "research", label: "Research lab", icon: FlaskConical, title: "a spot in a research lab",
    line: "Labs look for students who've already done the method. Replicate a result, get the PI or TA to sign it, and you're the obvious pick.",
    build: "CRISPR knockout, confirmed on a gel", prove: { done: 2, of: 2, by: "the PI or TA" },
    looking: "Gene-editing lab · undergraduate researcher", next: "Your proof is complete. Send your page to the two labs that viewed it.",
  },
  {
    id: "competition", label: "Competition", icon: Trophy, title: "a competition win",
    line: "Sponsors back teams with verified progress. A weekly build log your club signs is how you get the parts, the money and the judges' attention.",
    build: "Formula SAE gearbox, weekly build log", prove: { done: 4, of: 6, by: "your club's officers" },
    looking: "Vector Motors · sponsoring two student teams", next: "Post the dyno pull from Saturday; it's the milestone sponsors ask about.",
  },
  {
    id: "funding", label: "Funding", icon: Wallet, title: "funding for what you build",
    line: "Grants, accelerators and sponsors want traction someone can check. Results signed by the people who saw them are the check.",
    build: "Crop disease classifier, field trial", prove: { done: 1, of: 3, by: "a professor or a partner" },
    looking: "AgTech fund · student founders", next: "Ask the ag school's PI to vouch for the field trial results.",
  },
] as const;
type Goal = (typeof GOALS)[number];

export function Hero() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [typed, setTyped] = useState("");
  const reduce = useReducedMotion();
  const g = GOALS[i];
  // What they typed, tidied; "" until it's long enough to be a build.
  const build = cleanBuild(typed);

  useEffect(() => {
    if (!auto || reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % GOALS.length), 5200);
    return () => clearInterval(t);
  }, [auto, reduce]);

  return (
    <section id="top" data-story="Brazework" className="story-sec relative isolate overflow-hidden pt-32 pb-20 sm:pt-40">
      {/* The orb (FIX-92): everything you build flows into one place. Phones: a soft backdrop at the top
          (the preview card is hidden there). Wide screens: it rises behind the preview card's top corner, half showing. */}
      <Orb tone="auto" className="pointer-events-none absolute -top-6 -right-24 -z-10 size-80 opacity-90 md:hidden" />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-[1.05fr_1fr] [&>*]:min-w-0">
        <div>
          <a href="#founding" className="rise-in inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-text-2 shadow-sm transition hover:border-line-strong">
            <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-60" /><span className="relative size-2 rounded-full bg-ok" /></span>
            <span className="truncate">Founding clubs program is open</span>
            <ArrowRight className="size-3.5 shrink-0" />
          </a>
          <h1 className="focus-in mt-7 text-[clamp(2.6rem,5.4vw,4.6rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
            Prove what
            <br />
            <span className="text-grad">you built.</span>
          </h1>
          <p className="m-hide focus-in mt-6 max-w-xl text-lg leading-relaxed text-muted" style={{ ["--delay" as string]: "0.1s" }}>
            Log your work, get it signed by someone who saw it, and get found by the teams hiring for it. Code, circuits, experiments, models, proofs: if you built it, it counts.
          </p>
          <p className="m-only focus-in mt-5 text-base leading-relaxed text-muted">Log your work, get it signed by someone who saw it, and get found.</p>

          {/* Try it: what you type becomes the first step of the path card, as you type. */}
          <div className="rise-in mt-8" style={{ ["--delay" as string]: "0.15s" }}>
            <label htmlFor="hero-build" className="text-sm font-medium">What are you building?</label>
            <input id="hero-build" value={typed} onChange={(e) => { setTyped(e.target.value); setAuto(false); }} maxLength={300} autoComplete="off" enterKeyHint="go"
              onKeyDown={(e) => { if (e.key === "Enter" && build) window.location.assign(signupHref(g.id, build)); }}
              placeholder="A line-following robot"
              aria-describedby="hero-build-hint" aria-controls="hero-preview"
              className="mt-2.5 block h-12 w-full max-w-xl rounded-2xl border border-line bg-surface px-4 text-[16px] transition outline-none placeholder:text-faint focus:border-line-strong focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_9%,transparent)]" />
            <p id="hero-build-hint" className="mt-2 text-xs text-faint">One line is enough. Watch it land on your path{build ? ", then take it with you" : ""}.</p>
          </div>

          <div className="rise-in mt-6" style={{ ["--delay" as string]: "0.2s" }}>
            <p className="text-sm font-medium">What are you working toward?</p>
            <div role="tablist" aria-label="Your goal" className="mt-2.5 flex flex-wrap gap-2">
              {GOALS.map((x, n) => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={n === i}
                  aria-controls="hero-preview"
                  onClick={() => { setAuto(false); setI(n); }}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border px-3 py-1.5 text-sm transition",
                    n === i ? "border-text bg-text text-bg" : "border-line bg-surface text-muted hover:border-line-strong hover:text-text",
                  )}
                >
                  <x.icon className="size-4" /> {x.label}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} aria-live="polite">
                <p className="m-hide mt-4 min-h-[3.25rem] max-w-xl text-[15px] leading-relaxed text-text-2">{g.line}</p>
                {/* Phones (no room for the path card): the path in one line, and Ember's next step. */}
                <div className="m-only mt-4">
                  <p className="flex items-center gap-1.5 text-sm">
                    {/* With a build typed, the path is theirs: their line, nothing signed yet. */}
                    <span className="inline-flex min-w-0 items-center gap-1 font-medium"><Check className="size-3.5 shrink-0" /> <span className="max-w-[9.5rem] truncate">{build || "Build"}</span></span><span className="text-faint">→</span>
                    <span className="shrink-0 font-medium">Signed {build ? 0 : g.prove.done}/{g.prove.of}</span><span className="text-faint">→</span>
                    <span className="text-muted">Found</span>
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-text-2"><Flame className="mt-0.5 size-3.5 shrink-0 text-[#f28c28]" /> {build ? `Create your account, log one result on it, and ask ${g.prove.by} to sign it.` : g.next}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="rise-in mt-7 flex flex-wrap items-center gap-3" style={{ ["--delay" as string]: "0.3s" }}>
            <Button href={signupHref(g.id, typed)} size="lg">{build ? "Start with this build" : `Start toward ${g.label.toLowerCase()}`} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Button>
            {/* The other two ways in: each jumps to its own section. */}
            <Button href="#clubs" variant="outline" size="lg">For clubs</Button>
            <Button href="#companies" variant="outline" size="lg">For companies</Button>
          </div>
          <p className="rise-in mt-4 text-sm text-faint" style={{ ["--delay" as string]: "0.35s" }}>Free for students and clubs · Verified university and work emails</p>
        </div>

        <div id="hero-preview" role="tabpanel" className="relative mx-auto w-full max-w-[440px]">
          <Orb tone="auto" className="pointer-events-none absolute top-0 right-0 -z-10 hidden aspect-square w-[118%] translate-x-[42%] -translate-y-[38%] md:block" />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={g.id} initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.98 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
              <GoalPath g={g} play={!reduce} build={build} />
            </motion.div>
          </AnimatePresence>
          <p className="mt-3 text-center text-xs text-faint">{build ? "Your build · the rest is example data" : "Example data"}</p>
        </div>
      </div>
    </section>
  );
}

// A goal's path: build → prove → get found, with where you are on it and Ember's next step.
// With a build typed in the hero, the card is theirs: their line is the Build step, signing is what's
// next (nothing is signed yet), and Ember's next step is to ask for the first signature.
function GoalPath({ g, play, build = "" }: { g: Goal; play: boolean; build?: string }) {
  const proven = !build && g.prove.done >= g.prove.of;
  const stepsDone = 1 + (proven ? 1 : 0);
  const signed = build ? 0 : g.prove.done;
  const row = (k: number) => ({ initial: play ? { opacity: 0, x: -8 } : false, animate: { opacity: 1, x: 0 }, transition: { delay: play ? 0.15 + k * 0.12 : 0, duration: 0.35 } }) as const;
  return (
    <div className="glass-card rounded-3xl p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">Your path to</p>
          <p className="text-lg font-semibold tracking-tight">{g.title}</p>
        </div>
        <ProgressRing value={stepsDone / 3} label={`${stepsDone}/3`} />
      </div>
      <ol className="mt-4 flex flex-col gap-2">
        <Step motionProps={row(0)} state="done" icon={Hammer} title="Build" text={build || g.build} />
        <Step motionProps={row(1)} state={proven ? "done" : "now"} icon={BadgeCheck} title="Get it signed" text={build ? `Ask ${g.prove.by} to sign your first milestone` : `${g.prove.done} of ${g.prove.of} milestones signed by ${g.prove.by}`}>
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2">
            <motion.span className="block h-full origin-left rounded-full bg-text" initial={play ? { scaleX: 0 } : false} animate={{ scaleX: signed / g.prove.of }} transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
          </span>
        </Step>
        <Step motionProps={row(2)} state={proven ? "now" : "next"} icon={Search} title="Get found" text={g.looking} />
      </ol>
      <motion.p {...row(3)} className="mt-4 flex items-start gap-2 rounded-xl bg-[color-mix(in_oklab,#f28c28_10%,transparent)] px-3 py-2.5 text-[13px] leading-snug">
        <Flame className="mt-0.5 size-4 shrink-0 text-[#f28c28]" />
        <span><b className="font-semibold text-[#c2410c] dark:text-[#f28c28]">Ember · next step:</b> <span className="text-text-2">{build ? `Create your account, log one result on it, and ask ${g.prove.by} to sign it.` : g.next}</span></span>
      </motion.p>
    </div>
  );
}

function Step({ state, icon: Icon, title, text, children, motionProps }: { state: "done" | "now" | "next"; icon: typeof Hammer; title: string; text: string; children?: React.ReactNode; motionProps: object }) {
  return (
    <motion.li {...motionProps} className={cn("flex gap-3 rounded-2xl border px-3 py-2.5", state === "now" ? "border-line-strong bg-surface" : "border-line bg-surface/60")}>
      <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", state === "done" ? "bg-text text-bg" : state === "now" ? "border border-text text-text" : "border border-line text-faint")}>
        {state === "done" ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-sm font-medium">{title}<span className="text-[11px] font-normal text-faint">{state === "done" ? "Done" : state === "now" ? "Now" : "Next"}</span></span>
        <span className="block truncate text-xs text-muted">{text}</span>
        {children}
      </span>
    </motion.li>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-12 shrink-0 place-items-center" aria-label={`${label} steps done`}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <motion.circle cx="22" cy="22" r={r} fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <span className="text-[11px] font-semibold tabular-nums">{label}</span>
    </span>
  );
}
