"use client";
import { BadgeCheck, Check, RotateCcw } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { stageTitle } from "@/lib/landing-demo";

// The hero's demo: the whole product in one card. The member asks their AI assistant in plain words,
// it drafts the result with its proof (the visitor's own line, once they type one) and sends it to
// whoever saw the work, they sign it, and someone who searched signed work asks to talk. Each Replay
// tells it for someone else (STORIES): a student's club, an analyst's manager, a teacher's department
// head, because the same record works for anyone who builds, with any tool. Every step is also a
// button, and the visitor can press Send, the signer's button and answer the request themselves. With
// reduced motion it simply shows the signed end. Example people and links; the page says so.
export function ProofStage({ build }: { build: string }) {
  const [replays, setReplays] = useState(0);
  return (
    <div id="hero-preview" className="relative mx-auto w-full max-w-[30rem] min-w-0">
      {/* Keyed on the build, so each new line starts the sequence again from "logged"; each Replay is the next story. */}
      <Stage key={`${build}:${replays}`} build={build} story={STORIES[replays % STORIES.length]} onReplay={() => setReplays((n) => n + 1)} />
      <p className="mt-3 text-center text-xs text-faint">{build ? "Your build. The people and the company are examples." : "Example data"}</p>
    </div>
  );
}

const STEPS = ["Your AI drafts it", "Someone who saw it signs", "Someone finds it"];
type Person = { initials: string; name: string; role: string };
type Story = { title?: string; cmd: string; read: string; proof: string[]; send: string; sent: string; signer: Person & { act: string; done: string }; finder: Person & { ask: string } };
// The first is the one the page opens on (and the visitor's own line uses); Replay moves through the rest.
const STORIES: Story[] = [
  { cmd: "add the line robot to my record", read: "Read your merged PR and the expo video", proof: ["github.com/you/linebot/pull/42", "youtu.be/fall-expo-run"],
    send: "Send to club", sent: "Sent to Rocketry Club", signer: { initials: "BC", name: "Ben Cho", role: "Officer, Rocketry Club", act: "Verify", done: "Verified" },
    finder: { initials: "CD", name: "Cara Diaz", role: "Acme Aerospace", ask: "Saw your signed work on Brazework. Free to talk about our robotics internship?" } },
  { title: "New pricing tiers cut churn 9%", cmd: "put my pricing analysis on my record", read: "Read the analysis you built in Claude and the pilot results", proof: ["claude.ai/share/q3-pricing", "pilot-results.xlsx"],
    send: "Ask Dana to sign", sent: "Sent to Dana Ruiz", signer: { initials: "DR", name: "Dana Ruiz", role: "Director of Product, your manager", act: "Sign", done: "Signed" },
    finder: { initials: "LP", name: "Leo Park", role: "Brightline Consulting", ask: "Saw your signed pricing work. Free to talk about our associate role?" } },
  { title: "Fractions unit lifted quiz scores 18%", cmd: "add my fractions unit to my record", read: "Read the unit plan you made with Claude and the class quiz scores", proof: ["docs.google.com/fractions-unit", "quiz-scores.csv"],
    send: "Ask Tom to sign", sent: "Sent to Tom Owens", signer: { initials: "TO", name: "Tom Owens", role: "Head of Math, your department", act: "Sign", done: "Signed" },
    finder: { initials: "MG", name: "Maria Gómez", role: "Riverside School District", ask: "Saw your signed unit. Would you walk our curriculum team through it?" } },
];
type Phase = "typing" | "reading" | "draft" | "sent";

function Stage({ build, story, onReplay }: { build: string; story: Story; onReplay: () => void }) {
  const CMD = story.cmd;
  const typedBy = 250 + CMD.length * 42;
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
      // Typed at a person's pace; everything after waits for the last letter.
      ...Array.from(CMD, (_, i) => at(250 + i * 42, () => setTyped(i + 1))),
      at(typedBy + 150, () => setPhase("reading")),
      at(typedBy + 900, () => setPhase("draft")),
      at(typedBy + 2300, () => setPhase("sent")),
      at(typedBy + 2800, () => setStep((s) => Math.max(s, 2))),
      at(typedBy + 4600, () => setStep(3)),
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
              <span className="sr-only">You ask your AI assistant: “{CMD}”.</span>
            </p>
            {phase !== "typing" && <p className="text-[#a9a69c]">⎿ {story.read}</p>}
          </div>
          {/* The draft it writes, with the proof, ready to send. */}
          <div className={cn("mt-2 rounded-xl border border-line p-3 transition duration-500", phase === "draft" || phase === "sent" ? "opacity-100" : "translate-y-1 opacity-0")} inert={phase === "typing" || phase === "reading"}>
            <p className="text-[11px] font-medium tracking-wide text-faint uppercase">Draft result</p>
            <p className="mt-0.5 text-[16px] leading-snug font-semibold tracking-tight break-words">{build ? stageTitle(build) : story.title ?? stageTitle(build)}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Evidence">
              {story.proof.map((e) => <li key={e} className="max-w-full truncate rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-2">{e}</li>)}
            </ul>
            <div className="mt-2.5 flex min-h-8 items-center">
              {phase === "sent"
                ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ok"><Check className="size-3.5" /> {story.sent}</span>
                : <button type="button" onClick={send} className="inline-flex h-8 items-center rounded-lg bg-accent px-3.5 text-xs font-medium text-on-accent transition hover:opacity-90">{story.send}</button>}
            </div>
          </div>
        </Node>

        <Node n={2} at={step} label={STEPS[1]} onPick={jump}>
          <div className="flex items-center gap-3">
            <Av>{story.signer.initials}</Av>
            <p className="min-w-0 flex-1 text-sm leading-snug"><span className="font-medium">{story.signer.name}</span><span className="block text-muted">{story.signer.role}</span></p>
            {step >= 2
              ? <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--ok)_8%,var(--surface))] px-3 text-xs font-medium text-ok"><Check className="size-3.5" /> {story.signer.done}</span>
              : <button type="button" onClick={verify} className="inline-flex h-8 shrink-0 items-center rounded-lg bg-accent px-3.5 text-xs font-medium text-on-accent transition hover:opacity-90">{story.signer.act}</button>}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className={cn("text-xs text-muted transition-opacity duration-500", step >= 2 ? "opacity-100" : "opacity-0")}>On the record with their name and today&apos;s date.</p>
            <Signature drawn={step >= 2} still={!!reduce} />
          </div>
        </Node>

        <Node n={3} at={step} label={STEPS[2]} onPick={jump} last>
          <div className={cn("transition duration-500", step >= 3 ? "opacity-100" : "translate-y-1 opacity-0")} inert={step < 3}>
            <div className="flex gap-3">
              <Av>{story.finder.initials}</Av>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug"><span className="font-medium">{story.finder.name}</span> <span className="text-muted">{story.finder.role}</span></p>
                <p className="mt-1 text-sm leading-snug text-text-2">{story.finder.ask}</p>
              </div>
            </div>
            <div className="mt-3 flex min-h-9 items-center gap-2 pl-11" aria-live="polite">
              {answer === null ? (
                <>
                  <button type="button" onClick={() => setAnswer("accepted")} className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition hover:opacity-90">Accept</button>
                  <button type="button" onClick={() => setAnswer("declined")} className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm font-medium transition hover:border-line-strong hover:bg-hover">Decline</button>
                </>
              ) : (
                <p className="text-sm text-text-2">{answer === "accepted" ? "You're talking. They only reached you because you said yes." : "Declined. They aren't told, and can't message you again."}</p>
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
        // A signer's flourish, not anyone's letters: every story's signer can have written it, then the underline.
        d="M6 30c6-1 9-15 15-17s3 13-2 17c5-6 10-11 14-10s-2 11 2 11 7-12 11-12-2 12 3 12 7-11 11-11-1 11 4 11 8-9 12-10-1 10 4 10 9-7 13-11M14 38c28-3 66-5 110-7"
        style={{ strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: still ? "none" : "stroke-dashoffset 1.1s cubic-bezier(0.6, 0, 0.3, 1) 0.15s" }} />
    </svg>
  );
}
