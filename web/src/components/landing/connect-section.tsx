"use client";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { BadgeCheck, Building2, Check, CircleCheck, Copy, GitMerge, Tag, Terminal, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { Orb } from "./orb";

// "Bring your own agent" on the landing page (Linear FIX-92). How Brazework connects it all: what you
// build on GitHub, what your own AI agent logs for you (Claude Code, Cursor, Codex, through
// Brazework's MCP server), what your club verifies, and who notices, all flowing into one build log.
// Wide screens: the stage stays put while you scroll through four chapters. Phones (the landing is a
// stack of one-screen pages there): one page whose chapters advance on their own; tap to jump.
// Example data throughout, labelled as such.

const CHAPTERS = [
  { title: "You build like you already do", body: "Connect a repo once. Merged pull requests, releases and CI land in your project's build log on their own.", sources: ["github"] },
  { title: "Your agent writes it up", body: "Claude Code, Cursor or Codex logs today's progress for you, through Brazework's MCP server. Every post says which tool wrote it.", sources: ["claude", "cursor", "codex"] },
  { title: "Your club signs it", body: "Anything can be posted. Only an officer of your club can verify it, by name. Agents never can.", sources: ["club"] },
  { title: "Someone notices", body: "Companies search verified work, not résumés, and you see who looked.", sources: ["companies"] },
] as const;

// Around the orb, as percentages of the stage: in its upper part, clear of the demo card below.
const SOURCES = [
  { id: "github", label: "GitHub", x: 13, y: 14 },
  { id: "claude", label: "Claude Code", x: 84, y: 10 },
  { id: "cursor", label: "Cursor", x: 93, y: 34 },
  { id: "codex", label: "Codex", x: 88, y: 58 },
  { id: "club", label: "Your club", x: 8, y: 40 },
  { id: "companies", label: "Companies", x: 12, y: 64 },
] as const;

const CMD = 'claude mcp add --transport http brazework https://brazework.com/api/mcp --header "Authorization: Bearer <your token>"';

export function ConnectSection() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [wide, setWide] = useState(false);
  const [fill, setFill] = useState(0); // how far through the current chapter (wide screens)
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  // Wide screens: scrolling through the (four-screen-tall) section picks the chapter.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (!wide) return;
    const at = Math.min(0.9999, Math.max(0, v)) * CHAPTERS.length;
    setStep(Math.floor(at));
    setFill(at - Math.floor(at));
  });
  // Phones: the chapters move on by themselves while the page is on screen.
  const inView = useInView(ref, { amount: 0.5 });
  useEffect(() => {
    if (wide || reduce || !inView) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % CHAPTERS.length), 5200);
    return () => clearTimeout(t);
  }, [wide, reduce, inView, step]);

  const go = (i: number) => {
    const el = ref.current;
    if (!wide || !el) return setStep(i);
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * ((i + 0.08) / CHAPTERS.length), behavior: reduce ? "auto" : "smooth" });
  };
  const active = new Set<string>(CHAPTERS[step].sources);

  return (
    <section ref={ref} id="agents" data-story="Bring your own agent" aria-label="Bring your own agent" className="story-sec relative overflow-x-clip bg-[#0b0b0c] text-[#f4f4f5] md:h-[400vh]">
      <div className="flex items-center max-md:min-h-full md:sticky md:top-0 md:h-screen md:pt-16">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-6 px-6 md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-[#c8c8cc]"><span className="size-1.5 rounded-full bg-[#f28c28]" /> Bring your own agent</p>
            <h2 className="mt-4 text-[2rem] leading-[1.05] font-semibold tracking-tight sm:text-[2.6rem] xl:text-5xl">Everything you build flows into one log.</h2>
            <p className="m-hide mt-4 max-w-lg text-base text-[#b4b4bb] xl:text-lg">GitHub, your AI agent, your club and the people hiring, connected in one place, so your progress is recorded as it happens and proven by people who saw it.</p>

            <ol role="tablist" aria-label="How it connects" className="mt-6 grid grid-cols-4 gap-2 md:mt-8 md:flex md:flex-col md:gap-1">
              {CHAPTERS.map((c, i) => (
                <li key={c.title} role="presentation">
                  <button type="button" role="tab" aria-selected={step === i} onClick={() => go(i)}
                    className={cn("group relative w-full overflow-hidden rounded-lg text-left transition md:px-4 md:py-3", step === i ? "md:bg-white/[0.06]" : "hover:bg-white/[0.04]")}>
                    <span className="flex items-baseline gap-3">
                      <span className={cn("hidden font-mono text-xs tabular-nums md:inline", step === i ? "text-[#f28c28]" : "text-[#8b8b93]")}>0{i + 1}</span>
                      <span className={cn("hidden text-[15px] font-medium md:inline", step === i ? "text-white" : "text-[#9d9da5]")}>{c.title}</span>
                    </span>
                    {step === i && <span className="mt-1 hidden pl-7 text-sm leading-relaxed text-[#b4b4bb] md:block">{c.body}</span>}
                    {/* Phones: four bars, the current one filling up. Wide screens: a thin line under the open chapter. */}
                    <span className="block h-1 overflow-hidden rounded-full bg-white/10 md:mt-3 md:h-px">
                      <span className="block h-full origin-left rounded-full bg-[#f28c28]"
                        style={wide ? { transform: `scaleX(${step === i ? fill : step > i ? 1 : 0})` } : { transform: `scaleX(${step > i ? 1 : 0})`, ...(step === i && !reduce ? { animation: "agent-fill 5.2s linear forwards" } : step === i ? { transform: "scaleX(1)" } : {}) }} />
                    </span>
                    <span className="sr-only">{c.title}: {c.body}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-[#b4b4bb] md:hidden" aria-live="polite"><span className="font-medium text-white">{CHAPTERS[step].title}.</span> {CHAPTERS[step].body}</p>

            <ConnectCommand />
          </div>

          {/* The stage: the orb, the sources around it, and what the current chapter looks like (over
              the stage's foot on wide screens; under it on phones, so it hides no source). */}
          <div className="relative mx-auto w-full max-w-[min(100%,34rem)]" aria-hidden="true">
          <div className="relative mx-auto aspect-square w-full max-md:max-h-[34dvh] max-md:max-w-[34dvh]">
            <Orb pulse={step} className="absolute inset-0 size-full" />
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" preserveAspectRatio="none">
              {SOURCES.map((s) => (
                <g key={s.id}>
                  <line x1={s.x} y1={s.y} x2="50" y2="50" stroke="white" strokeOpacity={active.has(s.id) ? 0.28 : 0.07} strokeWidth="0.25" strokeDasharray="0.8 1.2" vectorEffect="non-scaling-stroke" />
                  {active.has(s.id) && !reduce && (
                    <circle r="0.9" fill="#ffd479">
                      <animateMotion dur="1.4s" repeatCount="indefinite" path={`M${s.x} ${s.y} L50 50`} />
                    </circle>
                  )}
                </g>
              ))}
            </svg>
            {SOURCES.map((s) => (
              <span key={s.id} style={{ left: `${s.x}%`, top: `${s.y}%` }}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition duration-500 sm:text-xs",
                  active.has(s.id) ? "border-[#f28c28]/60 bg-[#1a1410] text-white" : "border-white/10 bg-[#141416] text-[#8b8b93]")}>
                {s.label}
              </span>
            ))}
          </div>
            <div className="mt-3 md:absolute md:inset-x-[8%] md:bottom-[2%] md:mt-0">
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
                  <Demo step={step} play={!reduce} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// The command a member runs once (the token comes from Settings → Your tools after signing up).
function ConnectCommand() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-8 hidden md:block">
      <p className="text-sm font-medium text-white">Connect your agent in one line</p>
      <div className="mt-2 flex items-start gap-2 rounded-lg border border-white/10 bg-[#141416] p-3">
        <Terminal className="mt-0.5 size-4 shrink-0 text-[#8b8b93]" />
        <code className="min-w-0 flex-1 font-mono text-xs leading-relaxed break-all text-[#d4d4d8]">{CMD}</code>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(CMD).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); }}
          aria-label={copied ? "Copied" : "Copy the command"} className="grid size-8 shrink-0 place-items-center rounded-md text-[#b4b4bb] transition hover:bg-white/10 hover:text-white">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#8b8b93]">Your token is in Settings → Your tools once you sign up. Works with Claude Code, Cursor, VS Code, Codex, Windsurf and Zed, or use Ember, built in. <Link href="/signup" className="text-[#d4d4d8] underline underline-offset-4 hover:text-white">Start free</Link></p>
    </div>
  );
}

// What each chapter looks like, in miniature. Example data.
function Demo({ step, play }: { step: number; play: boolean }) {
  const card = "rounded-xl border border-white/10 bg-[#121214]/95 p-3.5 text-[13px] shadow-[0_20px_40px_-20px_rgb(0_0_0/0.8)]";
  const row = (i: number) => ({ initial: play ? { opacity: 0, x: -6 } : false, animate: { opacity: 1, x: 0 }, transition: { delay: play ? 0.25 + i * 0.45 : 0 } }) as const;
  if (step === 0) return (
    <div className={card}>
      <p className="mb-2 flex justify-between text-[11px] text-[#8b8b93]"><span>Build log · Liquid engine test stand</span><span>Example</span></p>
      {[[GitMerge, "Merged #42: Add igniter sequencing"], [CircleCheck, "CI passed on main"], [Tag, "Released v1.0 · First hot fire"]].map(([Icon, t], i) => {
        const I = Icon as typeof GitMerge;
        return <motion.p key={t as string} {...row(i)} className="flex items-center gap-2 py-1 text-[#e4e4e7]"><I className={cn("size-3.5", i === 1 ? "text-[#4ade80]" : "text-[#f28c28]")} /> {t as string}<span className="ml-auto text-[11px] text-[#8b8b93]">GitHub</span></motion.p>;
      })}
    </div>
  );
  if (step === 1) return (
    <div className={cn(card, "font-mono text-[12px]")}>
      <p className="text-[#e4e4e7]"><span className="text-[#8b8b93]">$</span> claude &quot;log today&apos;s cold-flow test&quot;</p>
      <motion.p {...row(0)} className="mt-1.5 text-[#8b8b93]">● brazework · my_projects</motion.p>
      <motion.p {...row(1)} className="text-[#8b8b93]">● brazework · post_update</motion.p>
      <motion.p {...row(2)} className="mt-1.5 text-[#4ade80]">✓ Posted to Liquid engine test stand · via Claude Code</motion.p>
    </div>
  );
  if (step === 2) return (
    <div className={card}>
      <p className="mb-1 text-[11px] text-[#8b8b93]">Milestone · Rocketry Club · Example</p>
      <p className="font-medium text-white">Static fire at 1.2 kN</p>
      <motion.p {...row(1)} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#4ade80]/12 px-2 py-1 text-[12px] font-medium text-[#4ade80]"><BadgeCheck className="size-3.5" /> Verified by Maya Patel, Rocketry Club</motion.p>
    </div>
  );
  return (
    <div className={card}>
      <motion.p {...row(0)} className="flex items-center gap-2 text-[#e4e4e7]"><Building2 className="size-4 text-[#f28c28]" /> <span><b className="font-medium text-white">Acme Aerospace</b> looked at your profile</span></motion.p>
      <motion.p {...row(1)} className="mt-2 flex items-center gap-2 text-[12px] text-[#b4b4bb]"><Users className="size-3.5" /> 2 milestones verified · active 7 of 12 weeks</motion.p>
    </div>
  );
}
