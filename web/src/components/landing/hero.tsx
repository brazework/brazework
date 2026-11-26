"use client";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { cleanBuild, signupHref } from "@/lib/front-door";
import { cn } from "@/lib/forge";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { EverywhereView, RecruiterView, SchoolView, StudentView, VerifyView } from "./journey";
import { EXAMPLES, type Example } from "./journey-data";

// The hero (landing journey; Brazework Courses since 2026-11-26, docs/strategy.md): the product
// window. One project followed through five views: the student submits the milestone to its
// assignment (or logs it under a club), the professor grades it against the rubric and verifies it in
// one step (a club officer verifies), the school's dashboard counts it, a recruiter finds it, and it
// goes everywhere the student does. What the visitor types is the milestone in all five, and the button carries it into
// sign-up (?build=, lib/front-door.ts).
//
// The views are tabs to click, and on a laptop the hero also pins and plays them as you scroll
// (globals.css .hero-run; RUN below is the same query). On a phone, a short screen or with reduced
// motion it doesn't pin: the views are just tabs, and nothing plays by itself.
// Examples throughout, and views 3 to 5 say they're illustrations of what's built with pilot schools.
// It follows the visitor's theme: drafting paper in light, the lab at night in dark (globals.css).

const RUN = "(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)";
const subscribe = (f: () => void) => { const m = matchMedia(RUN); m.addEventListener("change", f); return () => m.removeEventListener("change", f); };
const usePinned = () => useSyncExternalStore(subscribe, () => matchMedia(RUN).matches, () => false);

const VIEWS = [
  { id: "student", tab: "Student", say: "The student submits the milestone to its assignment, with the file that proves it.", note: "Example build · Courses with pilot schools" },
  { id: "verify", tab: "Professor", say: "The professor grades it against the rubric and verifies it in one step. The grade stays private.", note: "Example · grading with pilot schools; verifying works today" },
  { id: "school", tab: "School", say: "The school counts it the moment it's verified: accreditation evidence, grouped by outcome.", note: "Illustration · with pilot schools" },
  { id: "recruiter", tab: "Recruiter", say: "Recruiters search by verified work and see who vouched for it. The student sees who looked.", note: "Illustration · example data" },
  { id: "everywhere", tab: "Everywhere", say: "The work goes on LinkedIn, Handshake and the résumé; classes, clubs and deadlines stay in one place.", note: "Illustration · Add to LinkedIn, the verify link and résumé work today" },
] as const;

export function Hero() {
  const [typed, setTyped] = useState("");
  const [pick, setPick] = useState<Example["id"]>("arm");
  const [view, setView] = useState(0);
  const [verified, setVerified] = useState(false);
  const still = useReducedMotion();
  const pinned = usePinned();
  const run = useRef<HTMLElement>(null);
  const quietUntil = useRef(0);
  const ex = EXAMPLES.find((e) => e.id === pick)!;
  const build = cleanBuild(typed);
  const title = build || ex.milestone;
  const tabs = VIEWS.map((v) => (v.id === "verify" && ex.kind === "club" ? { ...v, tab: "Club officer" } : v));

  // Pinned: where the page is in the hero's scroll run picks the view, five equal stretches.
  useEffect(() => {
    if (!pinned) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const el = run.current;
      if (!el || performance.now() < quietUntil.current) return;
      const length = el.offsetHeight - innerHeight;
      const p = length > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / length)) : 0;
      setView(Math.min(VIEWS.length - 1, Math.floor(p * VIEWS.length)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    read();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(frame); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
  }, [pinned]);

  // Clicking a view: show it, and when pinned, scroll to its stretch so the page and the view agree.
  const go = useCallback((k: number) => {
    setView(k);
    const el = run.current;
    if (!pinned || !el) return;
    const length = el.offsetHeight - innerHeight;
    const top = el.getBoundingClientRect().top + scrollY;
    quietUntil.current = performance.now() + 900;
    scrollTo({ top: top + (length * (k + 0.5)) / VIEWS.length, behavior: "smooth" });
  }, [pinned]);
  const choose = (id: Example["id"]) => { setPick(id); setVerified(false); };
  const verify = useCallback(() => setVerified(true), []);
  const onKeyTabs = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const k = (view + d + VIEWS.length) % VIEWS.length;
    go(k);
    document.getElementById(`hero-tab-${VIEWS[k].id}`)?.focus();
  };

  const props = (k: number) => ({ ex, title, on: view === k, still, next: () => go(k + 1) });

  return (
    <section id="top" ref={run} aria-labelledby="hero-h" className="hero-run relative isolate overflow-clip bg-bg text-text">
      <div className="hero-pin relative isolate flex flex-col justify-center pt-24 pb-12 sm:pt-28 lg:pt-20 lg:pb-6">
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-text-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-brand" /> Brazework Courses · with pilot schools</p>
            <h1 id="hero-h" className="mt-5 text-[clamp(2.75rem,6.2vw,4.75rem)] leading-[0.95] font-semibold tracking-[-0.05em]">Teach it.<br />Grade it.<br />Prove it.</h1>
            <p className="mt-5 max-w-[31rem] text-lg leading-relaxed text-muted">The course platform built around what students build. Grading a milestone verifies it, the grade stays private, and the student keeps the proof for good. Students and clubs never pay.</p>

            <div className="mt-8 max-w-[30rem]">
              <label htmlFor="hero-build" className="text-sm font-medium text-text-2">A student? What did you build?</label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input id="hero-build" value={typed} maxLength={300} autoComplete="off" enterKeyHint="go"
                  onChange={(e) => { setTyped(e.target.value); setVerified(false); if (view !== 0) go(0); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && build) window.location.assign(signupHref("", build)); }}
                  placeholder={ex.milestone} aria-describedby="hero-build-hint" aria-controls="hero-card"
                  className="h-12 w-full min-w-0 rounded-xl border border-line-strong bg-surface px-4 text-[16px] transition outline-none placeholder:text-faint focus:border-text focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--text)_12%,transparent)]" />
                <Button href={signupHref("", typed)} size="lg" className="h-12 shrink-0 rounded-xl px-5">Get it verified <ArrowRight className="size-4" /></Button>
              </div>
              <p id="hero-build-hint" className="mt-2.5 text-sm text-faint">Type it and follow it through all five views. Free with your school email.</p>
            </div>
            <p aria-hidden="true" className="hero-scroll-hint mt-10 hidden items-center gap-2 font-mono text-xs text-faint"><ArrowDown className="size-3.5" /> Scroll to follow it from log to LinkedIn</p>
          </div>

          {/* The product window: five views of one project, the same size, so nothing moves. */}
          <div className="min-w-0">
            <div className="hero-window overflow-hidden rounded-2xl border border-line bg-surface">
              <div role="tablist" aria-label="Follow one project" onKeyDown={onKeyTabs} className="relative grid grid-cols-5 border-b border-line">
                {tabs.map((v, k) => (
                  <button key={v.id} id={`hero-tab-${v.id}`} type="button" role="tab" aria-selected={view === k} aria-controls={`hero-view-${v.id}`} tabIndex={view === k ? 0 : -1} onClick={() => go(k)}
                    className={cn("relative flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 text-[11px] leading-tight transition-colors max-[380px]:text-[10px] max-[380px]:tracking-tight sm:flex-row sm:justify-center sm:gap-1.5 sm:text-[13px]", view === k ? "font-medium text-text" : "text-muted hover:text-text")}>
                    <span aria-hidden="true" className={cn("grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] transition-colors", view === k ? "border-brand bg-brand text-bg" : k < view ? "border-text-2 text-text-2" : "border-line-strong")}>{k + 1}</span>
                    <span className="max-w-full truncate">{v.tab}</span>
                  </button>
                ))}
                <span aria-hidden="true" className="absolute bottom-[-1px] left-0 h-0.5 bg-brand transition-[width] duration-500" style={{ width: `${((view + 1) / VIEWS.length) * 100}%` }} />
              </div>
              <div className="hero-body relative">
                {tabs.map((v, k) => (
                  <div key={v.id} id={`hero-view-${v.id}`} role="tabpanel" aria-labelledby={`hero-tab-${v.id}`} inert={view !== k}
                    className={cn("absolute inset-0 transition-opacity duration-300", view === k ? "visible opacity-100" : "invisible opacity-0")}>
                    {k === 0 && <StudentView {...props(0)} pick={pick} choose={choose} />}
                    {k === 1 && <VerifyView key={ex.id} {...props(1)} verified={verified} verify={verify} />}
                    {k === 2 && <SchoolView key={ex.id} {...props(2)} />}
                    {k === 3 && <RecruiterView key={ex.id} {...props(3)} />}
                    {k === 4 && <EverywhereView key={ex.id} {...props(4)} />}
                  </div>
                ))}
              </div>
              <div className="flex h-24 items-center gap-3 border-t border-line px-4 sm:h-[4.25rem] sm:px-5">
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-text-2"><span className="line-clamp-3 sm:line-clamp-2">{VIEWS[view].say}</span><span className="mt-0.5 block truncate font-mono text-[10px] text-faint">{VIEWS[view].note}</span></p>
                {view < VIEWS.length - 1 ? (
                  <button type="button" onClick={() => go(view + 1)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-xs font-medium transition hover:bg-hover">Next <ArrowRight className="size-3.5" aria-hidden="true" /></button>
                ) : (
                  <Button href={signupHref("", typed)} size="md" className="h-8 shrink-0 rounded-lg px-3 text-xs">Start yours</Button>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-faint">Example projects and people. Courses, grading, the school&apos;s dashboard and recruiter search are shown as they&apos;re being built with pilot schools.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
