"use client";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { UPDATES, WELCOME, freshUpdates, onRoute, updateDate, welcomeSteps, whatsNewSteps, type TourStep } from "@/lib/tours";
import { loadTourState, markToursSeen } from "./actions";

type Run = { steps: TourStep[]; keys: string[] };
type Box = { top: number; left: number; width: number; height: number };

// The guided tour (public/js/tour.js): runs once for new members, then "What's new" walkthroughs
// for updates shipped since. A card follows each step to its page and spotlights [data-tour] targets.
export function TourMount() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [run, setRun] = useState<Run | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [name, setName] = useState("");

  // Decide what to show once per session.
  useEffect(() => {
    let alive = true;
    loadTourState().then((s) => {
      if (!alive || !s) return;
      setName(s.firstName);
      const seen = new Set(s.seen);
      if (!seen.has(WELCOME)) setTimeout(() => setRun({ steps: welcomeSteps(s.firstName), keys: [WELCOME, ...UPDATES.map((u) => u.id)] }), 700);
      else {
        const fresh = freshUpdates(seen, s.joinedAt);
        if (fresh.length) setTimeout(() => setRun({ steps: whatsNewSteps(fresh), keys: fresh.map((u) => u.id) }), 700);
      }
    });
    const replay = () => { setI(0); setRun({ steps: welcomeSteps(name), keys: [WELCOME] }); };
    window.addEventListener("forge:tour", replay);
    return () => { alive = false; window.removeEventListener("forge:tour", replay); };
  }, [name]);

  const step = run?.steps[i];

  // Go to the step's page, then find and spotlight its target.
  useEffect(() => {
    if (!step) return;
    if (step.route && !onRoute(step.route, pathname, search)) {
      router.push(step.route === "/u/" ? "/profile" : step.route);
      return;
    }
    let tries = 0;
    let raf = 0;
    const find = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      if (el && el.offsetParent !== null) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        const r = el.getBoundingClientRect();
        setBox({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
        return;
      }
      if (step.target && tries++ < 40) raf = requestAnimationFrame(find);
      else setBox(null);
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [step, pathname, search, router]);

  const close = useCallback(() => {
    if (run) void markToursSeen(run.keys);
    setRun(null);
    setI(0);
    setBox(null);
  }, [run]);

  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, run.steps.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, close]);

  if (!run || !step) return null;
  const last = i === run.steps.length - 1;
  return (
    <AnimatePresence>
      {box && (
        <motion.div
          key="spot"
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] rounded-2xl ring-2 ring-text shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, top: box.top, left: box.left, width: box.width, height: box.height }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
        />
      )}
      <motion.div
        key="card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-x-4 bottom-4 z-[61] mx-auto max-w-md rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)] sm:right-6 sm:bottom-6 sm:left-auto sm:mx-0 sm:w-[400px]"
      >
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="tour-title" className="font-semibold">{step.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-text-2">{step.body}</p>
            {step.list && (
              <ul className="mt-3 space-y-2 text-sm">
                {step.list.map(([t, d]) => <li key={t}><span className="font-medium">{t}</span><span className="block text-muted">{d}</span></li>)}
              </ul>
            )}
          </div>
          <button onClick={close} aria-label="Close tour" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="font-mono text-[11px] text-faint">{i + 1} / {run.steps.length}</span>
          {i > 0 && <Button variant="ghost" className="ml-auto" onClick={() => setI(i - 1)}>Back</Button>}
          <Button className={i > 0 ? "" : "ml-auto"} onClick={() => (last ? close() : setI(i + 1))}>{last ? "Done" : "Next"}</Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// "Forge updates": every shipped (and upcoming) change, readable any time.
export function UpdatesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button data-tour="updates" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-hover hover:text-text">
        <Sparkles className="size-[18px]" /> What&apos;s new
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="updates-title" className="fixed inset-0 z-[70] grid place-items-center bg-bg/70 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
            <div className="flex items-start justify-between">
              <h2 id="updates-title" className="text-xl font-semibold tracking-tight">Forge updates</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
            </div>
            <ol className="mt-5 space-y-6">
              {UPDATES.map((u) => (
                <li key={u.id}>
                  <div className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-faint uppercase"><span className="rounded-full border border-line px-2 py-0.5">{u.kind}</span>{updateDate(u)}</div>
                  <h3 className="mt-2 font-semibold">{u.title}</h3>
                  <p className="mt-1 text-sm text-text-2">{u.summary}</p>
                  {u.points && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{u.points.map((p) => <li key={p}>{p}</li>)}</ul>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
