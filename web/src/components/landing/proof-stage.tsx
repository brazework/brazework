"use client";
import { Check, Plug, RotateCcw, Sparkles } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Seal } from "@/components/app/verified-seal";
import { cn } from "@/lib/forge";
import { HERO_STORIES, type HeroPhase, type HeroStory, heroRecord, shortName, stageTitle } from "@/lib/landing-demo";
import { REF_KEY, firstStoryFor, refFrom } from "@/lib/launch";

// The hero's demo: the whole product in one card (rebuilt around the record, Linear FIX-222). The
// member says what they finished in a sentence; their AI does the write-up (what it read, the draft,
// its proof); and the entry itself is the biggest thing on the card, with a title block that fills
// in as the story goes: status, who signed, when, who found it. Whoever saw the work signs it, and
// someone who searched signed work asks to talk. The person leads each step; the AI is the help. The chips
// above the card name seven ways of working (HERO_STORIES: a student, software, mechanical, electrical
// and civil engineers, a researcher and a designer, each with what their AI reads and who signs), because
// the same record works for anyone who builds, with any tool. It plays them in turn until the visitor
// does anything (picks a chip, presses a step, types their own line), then stays where they are.
// Every step is also a button, and the visitor can press Send, the signer's button and answer the
// request themselves. With reduced motion it shows the signed end and doesn't advance. Example people
// and links; the page says so.
// Drawn like the app (docs/design/app.md): a plain sheet in ink, the draft dashed until it's signed.
// Green only once a person has signed.
// Where this visitor came from (?ref=…, or remembered for the tab): read in the browser only, so the
// landing page stays static.
const noStore = () => () => {};
const readRef = () => { try { return refFrom(window.location.search) || sessionStorage.getItem(REF_KEY) || ""; } catch { return ""; } };

export function ProofStage({ build }: { build: string }) {
  const reduce = useReducedMotion();
  // The story showing: the one picked or played to, else the first for this visitor (a Product Hunt
  // visitor starts on the engineer's, lib/launch.ts).
  const ref = useSyncExternalStore(noStore, readRef, () => "");
  const [chosen, setAt] = useState<number | null>(null);
  const at = chosen ?? firstStoryFor(ref, HERO_STORIES);
  const [replays, setReplays] = useState(0);
  const [auto, setAuto] = useState(true);
  const story = HERO_STORIES[at];
  // Plays on by itself only while nobody has touched it, and never over a line the visitor typed.
  const playing = auto && !build && !reduce;
  const pick = (n: number) => { setAuto(false); setAt(n); setReplays((r) => r + 1); };
  return (
    <div id="hero-preview" className="relative mx-auto w-full max-w-[30rem] min-w-0">
      <div role="group" aria-label="Ways people use Brazework" className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {HERO_STORIES.map((s, n) => (
          <button key={s.who} type="button" onClick={() => pick(n)} aria-pressed={n === at}
            className={cn("relative inline-flex h-9 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg border px-3 text-xs font-medium transition",
              n === at ? "border-text bg-text text-surface" : "border-line bg-surface text-text-2 hover:border-line-strong hover:text-text")}>
            {s.who}<span className={cn("font-normal", n === at ? "text-surface/70" : "text-faint")}>{s.tool}</span>
            {/* While it plays by itself: how long until the next story, as a hairline filling under the chip. */}
            {n === at && playing && <span key={`${at}:${replays}`} aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-surface/60" style={{ animation: `progress-fill ${storyMs(s)}ms linear forwards` }} />}
          </button>
        ))}
      </div>
      {/* One height for every story, from the first paint: each story's finished card sits unseen in
          the same grid cell and sizes it, and the one playing fills that cell. So nothing below the
          hero moves while a story plays or when the next one starts (no layout shift on a phone). */}
      <div className="grid">
        {HERO_STORIES.map((s) => (
          <div key={s.who} aria-hidden="true" inert className="pointer-events-none invisible col-start-1 row-start-1 min-w-0 select-none">
            <Stage ghost build="" story={s} onTouch={noop} />
          </div>
        ))}
        {/* Keyed on the build and the story, so each starts again from the typed ask; Replay replays this one. */}
        <div id="hero-live" className="col-start-1 row-start-1 min-w-0">
          <Stage key={`${build}:${at}:${replays}`} build={build} story={story} onDone={playing ? () => setAt((at + 1) % HERO_STORIES.length) : undefined} onTouch={() => setAuto(false)} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 pl-1">
        <p className="min-w-0 text-xs text-faint">{build ? "Your build. The people and the company are examples." : "Example people and links"}</p>
        <button type="button" onClick={() => { setAuto(false); setReplays((n) => n + 1); }} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition hover:bg-hover hover:text-text"><RotateCcw className="size-3.5" /> Replay</button>
      </div>
    </div>
  );
}

// The person leads each step. The AI is in the first one as the help it is: it writes up what you
// say and finds the proof, and nothing is saved until you send it.
const STEPS = ["You log what you finished", "Someone who saw it signs", "Someone finds it"];
type Story = HeroStory;
type Phase = HeroPhase;
// How long a story plays before the next one: typed at a person's pace, then the three steps, then a
// few seconds to read who reached out.
const typedMs = (s: Story) => 250 + s.cmd.length * 42;
const storyMs = (s: Story) => typedMs(s) + 8600;

const noop = () => {};

// `ghost`: the finished story, still and unseen, used only to size the stage (ProofStage above).
function Stage({ build, story, onDone, onTouch, ghost = false }: { build: string; story: Story; onDone?: () => void; onTouch: () => void; ghost?: boolean }) {
  const CMD = story.cmd;
  const typedBy = typedMs(story);
  const reduce = useReducedMotion();
  const [step, setStep] = useState(ghost ? 3 : 1);
  const [phase, setPhase] = useState<Phase>(ghost ? "sent" : "typing");
  const [typed, setTyped] = useState(ghost ? CMD.length : 0);
  const [answer, setAnswer] = useState<"accepted" | "declined" | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const at = (ms: number, f: () => void) => setTimeout(f, reduce ? 0 : ms);

  // The loop: type the command, read the work, show the draft, send it, the officer signs, a company asks.
  useEffect(() => {
    if (ghost) return;
    timers.current = [
      // Typed at a person's pace; everything after waits for the last letter.
      ...Array.from(CMD, (_, i) => at(250 + i * 42, () => setTyped(i + 1))),
      at(typedBy + 150, () => setPhase("reading")),
      at(typedBy + 900, () => setPhase("draft")),
      at(typedBy + 2300, () => setPhase("sent")),
      // A full second as "Waiting for …" (dashed amber) before the signature lands, so the state is seen.
      at(typedBy + 3300, () => setStep((s) => Math.max(s, 2))),
      at(typedBy + 4600, () => setStep(3)),
      // Then the next story, while nobody has touched it (ProofStage passes onDone only then).
      ...(onDone && !reduce ? [setTimeout(onDone, storyMs(story))] : []),
    ];
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const after = (n: number) => { if (n >= 2) { setTyped(CMD.length); setPhase("sent"); } };
  const jump = (n: number) => { stop(); onTouch(); after(n); setStep(n); };
  const send = () => { stop(); onTouch(); setTyped(CMD.length); setPhase("sent"); timers.current = [at(1100, () => setStep(2)), at(2900, () => setStep(3))]; };
  const verify = () => { stop(); onTouch(); after(2); setStep(2); timers.current = [at(1500, () => setStep(3))]; };
  const shown = reduce ? CMD.length : typed;

  const signed = step >= 2;
  const drafted = phase === "draft" || phase === "sent";
  // Where the entry stands, as a drawing's title block: it fills in as the story goes (lib/landing-demo.ts).
  const cells = heroRecord({ phase, step, signer: story.signer.name, finder: shortName(story.finder.name), today: "Today" });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface">
      <Flow at={step} onPick={jump} />
      <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
        {/* 1. You say it, in a sentence. Your AI does the write-up: what it read, and what it says back. */}
        <div>
          <StepHead n={1} at={step} label={STEPS[0]} onPick={jump} />
          <p className="flex justify-end">
            {/* The whole ask, unseen, holds the lines it will take; the typed part is drawn over it. */}
            <span aria-hidden="true" className="grid max-w-[92%] min-w-0 rounded-2xl rounded-br-md bg-text px-3 py-1.5 text-[13px] leading-snug text-surface">
              <span className="invisible col-start-1 row-start-1">{CMD}</span>
              <span className="col-start-1 row-start-1">{CMD.slice(0, shown)}{phase === "typing" && !reduce && <span className="ml-px inline-block h-3 w-1 translate-y-0.5 animate-pulse bg-surface" />}</span>
            </span>
            <span className="sr-only">You say: “{CMD}”.</span>
          </p>
          <div className="mt-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            <p className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5 font-medium text-text-2"><Sparkles className="size-3.5" aria-hidden="true" /> Your AI does the write-up</span>
              <span className="inline-flex shrink-0 items-center gap-1"><Plug className="size-3" aria-hidden="true" /> Connected</span>
            </p>
            <ul aria-label="What your AI read" className={cn("mt-1.5 space-y-0.5 transition-opacity duration-300", phase === "typing" ? "invisible opacity-0" : "opacity-100")}>
              {story.reads.map((r) => <li key={r} className="flex items-center gap-1.5 text-xs text-muted"><Check className="size-3 shrink-0" aria-hidden="true" />{r}</li>)}
            </ul>
            <p className={cn("mt-1.5 text-[13px] leading-snug text-text-2 transition-opacity duration-300", drafted ? "opacity-100" : "invisible opacity-0")}>{story.reply}</p>
          </div>
        </div>

        {/* The entry: the thing all of this makes, and the biggest thing on the card. Dashed while it's
            a draft, dashed amber while it waits, green once a person has signed it. */}
        <div className={cn("rounded-xl border bg-surface p-3.5 transition duration-500", signed ? "border-ok" : phase === "sent" ? "border-dashed border-wait" : "border-dashed border-line-strong", drafted ? "opacity-100" : "translate-y-1 opacity-0")} inert={!drafted}>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            {signed ? <Seal size={14} /> : phase === "sent" ? <span aria-hidden="true" className="block size-3 shrink-0 rounded-full border-[1.5px] border-dashed border-wait" /> : null}
            {signed ? "On your Brazework record" : phase === "sent" ? `Waiting for ${story.signer.name}` : "Brazework · draft"}
          </p>
          <p className="mt-1 text-lg leading-snug font-semibold tracking-tight break-words">{build ? stageTitle(build) : story.title ?? stageTitle(build)}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Evidence">
            {story.proof.map((e) => <li key={e} className="max-w-full truncate rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-text-2">{e}</li>)}
          </ul>
          <div className="mt-2.5 flex min-h-11 items-center justify-between gap-3">
            {phase === "sent"
              ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-2"><Check className="size-3.5" /> {story.sent}</span>
              : <button type="button" onClick={send} className="inline-flex h-8 items-center rounded-lg bg-accent px-3.5 text-xs font-medium text-on-accent transition hover:opacity-90">{story.send}</button>}
            <Signature drawn={signed} still={!!reduce} />
          </div>
          <dl className="mt-2.5 grid grid-cols-2 overflow-hidden rounded-lg border border-line sm:grid-cols-4">
            {cells.map((c, i) => (
              <div key={c.label} className={cn("min-w-0 px-2.5 py-1.5", i % 2 === 1 && "border-l border-line", i > 1 && "border-t border-line sm:border-t-0", i > 0 && "sm:border-l")}>
                <dt className="truncate text-xs text-muted">{c.label}</dt>
                <dd className={cn("truncate text-xs font-semibold transition-colors duration-300", c.tone === "ok" ? "text-ok" : c.tone === "waiting" ? "text-wait" : c.tone === "empty" ? "font-normal text-muted" : "text-text")}>{c.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 2. The person who saw it signs. */}
        <div>
          <StepHead n={2} at={step} label={STEPS[1]} onPick={jump} />
          <div className="flex items-center gap-3">
            <Av>{story.signer.initials}</Av>
            <p className="min-w-0 flex-1 text-sm leading-snug"><span className="font-medium">{story.signer.name}</span><span className="block text-muted">{story.signer.role}</span></p>
            {signed
              ? <span className="inline-flex h-8 shrink-0 items-center gap-1.5 text-xs font-semibold text-ok"><Seal size={18} /> {story.signer.done}</span>
              : <button type="button" onClick={verify} className="inline-flex h-8 shrink-0 items-center rounded-lg bg-accent px-3.5 text-xs font-medium text-on-accent transition hover:opacity-90">{story.signer.act}</button>}
          </div>
        </div>

        {/* 3. Someone who searched signed work asks to talk; you decide. */}
        <div>
          <StepHead n={3} at={step} label={STEPS[2]} onPick={jump} />
          <div className={cn("transition duration-500", step >= 3 ? "opacity-100" : "translate-y-1 opacity-0")} inert={step < 3}>
            <div className="flex gap-3">
              <Av>{story.finder.initials}</Av>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug"><span className="font-medium">{story.finder.name}</span> <span className="text-muted">{story.finder.role}</span></p>
                <p className="mt-1 text-sm leading-snug text-text-2">{story.finder.ask}</p>
              </div>
            </div>
            <div className="mt-2.5 flex min-h-9 items-center gap-2 pl-11" aria-live="polite">
              {answer === null ? (
                <>
                  <button type="button" onClick={() => { stop(); onTouch(); setAnswer("accepted"); }} className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition hover:opacity-90">Accept</button>
                  <button type="button" onClick={() => { stop(); onTouch(); setAnswer("declined"); }} className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm font-medium transition hover:border-line-strong hover:bg-hover">Decline</button>
                </>
              ) : (
                <p className="text-sm text-text-2">{answer === "accepted" ? "You're talking. They only reached you because you said yes." : "Declined. They aren't told, and can't message you again."}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A step's heading: its number is a button that jumps there (a tick once the story has passed it),
// and its name is in ink once the story has reached it.
function StepHead({ n, at, label, onPick }: { n: number; at: number; label: string; onPick: (n: number) => void }) {
  const done = at >= n;
  return (
    <p className="mb-2 flex items-center gap-2">
      <button type="button" onClick={() => onPick(n)} aria-label={`Step ${n}: ${label}`} aria-current={at === n ? "step" : undefined}
        className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors duration-300", done ? "border-text bg-text text-surface" : "border-dashed border-line-strong bg-surface text-muted")}>
        {at > n ? <Check className="size-3.5" strokeWidth={3} /> : n}
      </button>
      <span className={cn("text-[13px] font-semibold transition-colors duration-300", done ? "text-text" : "text-muted")}>{label}</span>
    </p>
  );
}

// The flow, named along the top of the card so it reads before anything plays: three stages, the
// one the story has reached in ink, a bar under each that fills as it's reached. It says the same
// three things as the section under the hero ("Log it. Get it signed. Keep it."), and what happens
// next once it's on the record. A pointer can press a stage to jump there; a keyboard or a screen
// reader uses the numbered step buttons below, which do the same, so this row is hidden from them
// rather than announcing every step twice.
const FLOW = ["Log it", "Get it signed", "Get found"];
function Flow({ at, onPick }: { at: number; onPick: (n: number) => void }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-3 gap-1.5 border-b border-line bg-surface-2/60 px-3 pt-2.5 pb-3">
      {FLOW.map((f, i) => {
        const n = i + 1;
        return (
          <button key={f} type="button" tabIndex={-1} onClick={() => onPick(n)} className="group min-w-0 text-left">
            <span className={cn("flex items-center gap-1.5 text-xs transition-colors duration-300", at === n ? "font-semibold text-text" : at > n ? "font-medium text-text-2" : "font-medium text-muted group-hover:text-text-2")}>
              <span className="tabular-nums">{n}</span>
              <span className="truncate">{f}</span>
              {at > n && <Check className="size-3 shrink-0" strokeWidth={3} />}
            </span>
            <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-line">
              <span className={cn("block size-full origin-left rounded-full bg-text transition-transform duration-500 ease-out", at >= n ? "scale-x-100" : "scale-x-0")} />
            </span>
          </button>
        );
      })}
    </div>
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
