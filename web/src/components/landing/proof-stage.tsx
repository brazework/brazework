"use client";
import { BadgeCheck, Check, RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { stageTitle } from "@/lib/landing-demo";

// The hero's demo: the whole product in one card. "/shipped" is typed to the member's AI assistant, it
// drafts the milestone with its evidence (the visitor's own line, once they type one) and sends it to
// the club, a club officer signs it, and a company that searched signed work asks to talk. It plays
// once, and again whenever the build changes or Replay is pressed; every step is also a button, and
// the visitor can press Send, Verify and answer the request themselves. With reduced motion it simply
// shows the signed end. Example people and links; the page says so. No video, no library: a few timers.
export function ProofStage({ build }: { build: string }) {
  const [replays, setReplays] = useState(0);
  return (
    <div id="hero-preview" className="relative mx-auto w-full max-w-[30rem] min-w-0">
      {/* Keyed on the build, so each new line starts the sequence again from "logged". */}
      <Stage key={`${build}:${replays}`} build={build} onReplay={() => setReplays((n) => n + 1)} />
      <p className="mt-3 text-center text-xs text-faint">{build ? "Your build. The people and the company are examples." : "Example data"}</p>
    </div>
  );
}

const STEPS = ["Your AI drafts it", "Your club signs it", "A company finds it"];
const CMD = "/shipped";
const EVIDENCE = ["github.com/you/linebot/pull/42", "youtu.be/fall-expo-run"];
type Phase = "typing" | "reading" | "draft" | "sent";

function Stage({ build, onReplay }: { build: string; onReplay: () => void }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState(0);
  const [answer, setAnswer] = useState<"accepted" | "declined" | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const at = (ms: number, f: () => void) => setTimeout(f, reduce ? 0 : ms);

  // The loop: type the command, read the work, show the draft, send it, the officer signs, a company asks.
  useEffect(() => {
    timers.current = [
      ...Array.from(CMD, (_, i) => at(250 + i * 85, () => setTyped(i + 1))),
      at(1150, () => setPhase("reading")),
      at(1900, () => setPhase("draft")),
      at(3300, () => setPhase("sent")),
      at(3800, () => setStep((s) => Math.max(s, 2))),
      at(5600, () => setStep(3)),
    ];
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const after = (n: number) => { if (n >= 2) { setTyped(CMD.length); setPhase("sent"); } };
  const jump = (n: number) => { stop(); after(n); setStep(n); };
  const send = () => { stop(); setTyped(CMD.length); setPhase("sent"); timers.current = [at(500, () => setStep(2)), at(2300, () => setStep(3))]; };
  const verify = () => { stop(); after(2); setStep(2); timers.current = [at(1500, () => setStep(3))]; };
  const shown = reduce ? CMD.length : typed;

  return (
    <div className="rounded-[1.25rem] border border-line bg-surface shadow-[var(--shadow-float)]">
      <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 pr-2.5 pl-5">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold"><BadgeCheck className="size-4 shrink-0 text-ok" /> Proof <span className="truncate font-normal text-muted">signed by people who saw it</span></p>
        <button type="button" onClick={onReplay} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-text"><RotateCcw className="size-3.5" /> Replay</button>
      </div>

      <ol className="relative px-5 py-5">
        <Node n={1} at={step} label={STEPS[0]} onPick={jump}>
          {/* What the member types to their assistant, and what it reads. */}
          <div className="rounded-xl bg-[#1b1a18] px-3 py-2 font-mono text-[12.5px] leading-relaxed text-[#ecebe6]">
            <p className="flex items-center gap-2">
              <span aria-hidden="true" className="text-[#e08a62]">&gt;</span>
              <span aria-hidden="true">{CMD.slice(0, shown)}{phase === "typing" && !reduce && <span className="ml-px inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-[#ecebe6]" />}</span>
              <span className="sr-only">You type {CMD} to your AI assistant.</span>
            </p>
            {phase !== "typing" && <p className="text-[#a9a69c]">⎿ Read your merged PR and the expo video</p>}
          </div>
          {/* The draft it writes, with the proof, ready to send. */}
          <div className={cn("mt-2 rounded-xl border border-line p-3 transition duration-500", phase === "draft" || phase === "sent" ? "opacity-100" : "translate-y-1 opacity-0")} inert={phase === "typing" || phase === "reading"}>
            <p className="text-[11px] font-medium tracking-wide text-faint uppercase">Draft milestone</p>
            <p className="mt-0.5 text-[16px] leading-snug font-semibold tracking-tight break-words">{stageTitle(build)}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Evidence">
              {EVIDENCE.map((e) => <li key={e} className="max-w-full truncate rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-2">{e}</li>)}
            </ul>
            <div className="mt-2.5 flex min-h-8 items-center">
              {phase === "sent"
                ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ok"><Check className="size-3.5" /> Sent to Rocketry Club</span>
                : <button type="button" onClick={send} className="inline-flex h-8 items-center rounded-lg bg-accent px-3.5 text-xs font-medium text-on-accent transition hover:opacity-90">Send to club</button>}
            </div>
          </div>
        </Node>

        <Node n={2} at={step} label={STEPS[1]} onPick={jump}>
          <div className="flex items-center gap-3">
            <Av>BC</Av>
            <p className="min-w-0 flex-1 text-sm leading-snug"><span className="font-medium">Ben Cho</span><span className="block text-muted">Officer, Rocketry Club</span></p>
            {step >= 2
              ? <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--ok)_8%,var(--surface))] px-3 text-xs font-medium text-ok"><Check className="size-3.5" /> Verified</span>
              : <button type="button" onClick={verify} className="inline-flex h-8 shrink-0 items-center rounded-lg bg-accent px-3.5 text-xs font-medium text-on-accent transition hover:opacity-90">Verify</button>}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className={cn("text-xs text-muted transition-opacity duration-500", step >= 2 ? "opacity-100" : "opacity-0")}>On the record with his name and today&apos;s date.</p>
            <Signature drawn={step >= 2} still={!!reduce} />
          </div>
        </Node>

        <Node n={3} at={step} label={STEPS[2]} onPick={jump} last>
          <div className={cn("transition duration-500", step >= 3 ? "opacity-100" : "translate-y-1 opacity-0")} inert={step < 3}>
            <div className="flex gap-3">
              <Av>CD</Av>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug"><span className="font-medium">Cara Diaz</span> <span className="text-muted">Acme Aerospace</span></p>
                <p className="mt-1 text-sm leading-snug text-text-2">Saw your signed work on Brazework. Free to talk about our robotics internship?</p>
              </div>
            </div>
            <div className="mt-3 flex min-h-9 items-center gap-2 pl-11" aria-live="polite">
              {answer === null ? (
                <>
                  <button type="button" onClick={() => setAnswer("accepted")} className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition hover:opacity-90">Accept</button>
                  <button type="button" onClick={() => setAnswer("declined")} className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm font-medium transition hover:border-line-strong hover:bg-hover">Decline</button>
                </>
              ) : (
                <p className="text-sm text-text-2">{answer === "accepted" ? "You're talking. She only reached you because you said yes." : "Declined. She isn't told, and can't message you again."}</p>
              )}
            </div>
          </div>
        </Node>
      </ol>
    </div>
  );
}

// One step of the sequence: its number (a tick once it has happened) is a button that jumps there.
function Node({ n, at, label, onPick, last, children }: { n: number; at: number; label: string; onPick: (n: number) => void; last?: boolean; children: React.ReactNode }) {
  const done = at >= n;
  return (
    <li className={cn("relative flex gap-4", !last && "pb-5")}>
      {/* The line down to the next step fills once that step has happened. */}
      {!last && <span aria-hidden="true" className="absolute top-[1.625rem] bottom-0 left-[0.8125rem] w-px -translate-x-1/2 bg-line"><span className={cn("block size-full origin-top bg-ok transition-transform duration-700 ease-out", at > n ? "scale-y-100" : "scale-y-0")} /></span>}
      <button type="button" onClick={() => onPick(n)} aria-label={`Step ${n}: ${label}`} aria-current={at === n ? "step" : undefined}
        className={cn("relative z-10 grid size-[1.625rem] shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors duration-300", done ? "border-ok bg-ok text-white dark:text-[#06240f]" : "border-line-strong bg-surface text-muted")}>
        {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
      </button>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 pt-0.5 text-xs font-medium text-muted">{label}</p>
        {children}
      </div>
    </li>
  );
}

function Av({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-2">{children}</span>;
}

// The officer's signature, drawn as it's given. One stroke, so it draws like a pen would.
function Signature({ drawn, still }: { drawn: boolean; still: boolean }) {
  return (
    <svg viewBox="0 0 132 44" aria-hidden="true" className="h-11 w-[8.25rem] shrink-0 text-text">
      <path pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        d="M8 30C10 14 15 6 20 7c5 1 2 12-6 15 9-3 15 1 13 7-2 5-12 5-15 1m24-8c-4-1-7 2-6 5s6 2 8-3c0 4 2 6 5 4 3-2 5-8 5-8s-1 8 3 8 4-8 9-8c-4 0-6 3-5 6s6 3 9-1m10-18c-6 0-10 6-9 13s8 9 14 4c3-3 6-12 6-17 0 8-2 16 2 19 3 2 6-2 8-7 0 4 1 7 4 7 4 0 6-4 9-9"
        style={{ strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: still ? "none" : "stroke-dashoffset 1.1s cubic-bezier(0.6, 0, 0.3, 1) 0.15s" }} />
    </svg>
  );
}
