"use client";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";
import { NavTile } from "@/components/app/nav-tile";
import { UPDATES, WELCOME, freshUpdates, onRoute, updateDate, welcomeSteps, whatsNewSteps, type TourStep } from "@/lib/tours";
import { loadTourState, markToursSeen } from "./actions";
import { FeedbackForm } from "./feedback-form";

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
  // A tour that starts on its own waits until you're on its first page (never pulls you off a
  // link you opened), and it only changes pages when you press Next or Back.
  const [pending, setPending] = useState<Run | null>(null);
  const navFor = useRef<number | null>(null);
  // Which way you're going (Next +1, Back -1), so a step with nothing to point at is skipped that way.
  const dir = useRef(1);
  const nameRef = useRef("");
  if (pending && !run && (!pending.steps[0]?.route || onRoute(pending.steps[0].route, pathname, search))) {
    setRun(pending);
    setPending(null);
  }

  // Decide what to show once per session.
  useEffect(() => {
    let alive = true;
    loadTourState().then((s) => {
      if (!alive || !s) return;
      nameRef.current = s.firstName;
      const seen = new Set(s.seen);
      if (!seen.has(WELCOME)) setTimeout(() => setPending({ steps: welcomeSteps(s.firstName), keys: [WELCOME, ...UPDATES.map((u) => u.id)] }), 700);
      else {
        const fresh = freshUpdates(seen, s.joinedAt);
        if (fresh.length) setTimeout(() => setPending({ steps: whatsNewSteps(fresh), keys: fresh.map((u) => u.id) }), 700);
      }
    });
    const replay = () => { navFor.current = null; dir.current = 1; setI(0); setRun({ steps: welcomeSteps(nameRef.current), keys: [WELCOME] }); };
    window.addEventListener("forge:tour", replay);
    return () => { alive = false; window.removeEventListener("forge:tour", replay); };
  }, []);

  const step = run?.steps[i];
  const go = useCallback((to: number) => { setI((v) => { dir.current = to < v ? -1 : 1; return to; }); }, []);
  const target = useRef<HTMLElement | null>(null);
  // While the card is on screen the page is locked: it can't scroll or be clicked underneath until you
  // finish or close the tour (FIX-236), so the spotlight stays on what it's explaining. The tour still
  // scrolls each target into view itself. Corner widgets (the feed's message dock) step aside too.
  const showing = !!step;
  useEffect(() => {
    if (!showing) return;
    const html = document.documentElement;
    const gap = window.innerWidth - html.clientWidth;
    const was = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
    html.dataset.tour = "on";
    html.style.overflow = "hidden";
    if (gap > 0) html.style.paddingRight = `${gap}px`;
    return () => {
      delete html.dataset.tour;
      html.style.overflow = was.overflow;
      html.style.paddingRight = was.paddingRight;
    };
  }, [showing]);

  // Go to the step's page, then find and spotlight its target.
  useEffect(() => {
    if (!step || !run) return;
    if (step.route && !onRoute(step.route, pathname, search)) {
      if (navFor.current !== i) {
        navFor.current = i;
        router.push(step.route === "/u/" ? "/profile" : step.route);
        return;
      }
      // You went somewhere else mid-tour: step aside (not marked seen, so it comes back next visit).
      navFor.current = null;
      const t = setTimeout(() => { setRun(null); setI(0); setBox(null); }, 0);
      return () => clearTimeout(t);
    }
    navFor.current = i;
    target.current = null;

    // Pages stream in, so give the target a few seconds to arrive. The first one that's on screen wins
    // (the sidebar and the phone's tab bar both carry "menu"; only one is showing).
    const until = Date.now() + 4000;
    let raf = 0;
    const find = () => {
      if (!step.target) { setBox(null); return; }
      const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`)].find((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden");
      if (el) {
        target.current = el;
        el.scrollIntoView({ block: "center", behavior: "instant" });
        setBox(measure(el));
        return;
      }
      if (Date.now() < until) { raf = requestAnimationFrame(find); return; }
      // Not on this page (switched off, or not on this screen size): skip it, the way you were going.
      const next = i + dir.current;
      if (next >= 0 && next < run.steps.length) setI(next);
      else setBox(null);
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [step, run, i, pathname, search, router]);

  // The page can't scroll, but the window can change size (a phone turning): follow the target.
  useEffect(() => {
    if (!showing) return;
    const onResize = () => { if (target.current?.isConnected) { target.current.scrollIntoView({ block: "center", behavior: "instant" }); setBox(measure(target.current)); } };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [showing]);

  const close = useCallback(() => {
    if (run) void markToursSeen(run.keys);
    navFor.current = null;
    setRun(null);
    setI(0);
    setBox(null);
  }, [run]);

  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") { dir.current = 1; setI((v) => Math.min(v + 1, run.steps.length - 1)); }
      if (e.key === "ArrowLeft") { dir.current = -1; setI((v) => Math.max(v - 1, 0)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, close]);

  if (!run || !step) return null;
  const last = i === run.steps.length - 1;
  // A target low on the screen (the phone's tab bar) would sit under the card: the card moves up.
  const high = !!box && typeof window !== "undefined" && box.top + box.height > window.innerHeight - 280;
  return (
    <AnimatePresence>
      {/* Catches every click, tap, wheel and touch meant for the page underneath while the tour runs.
          It dims the page itself when there's no spotlight (which does its own dimming). The page under it
          can't scroll either: the root is overflow hidden while the tour runs. */}
      <div key="lock" data-tour-lock aria-hidden="true" className={cn("fixed inset-0 z-[59] touch-none overscroll-none", !box && "bg-black/45")} />
      {box && (
        <motion.div
          key="spot"
          data-tour-spot
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
        aria-modal="true"
        aria-labelledby="tour-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("fixed inset-x-4 z-[61] mx-auto max-h-[70dvh] max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)] sm:right-6 sm:left-auto sm:mx-0 sm:w-[400px]", high ? "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-6" : "bottom-4 sm:bottom-6")}
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
          {i > 0 && <Button variant="ghost" className="ml-auto" onClick={() => go(i - 1)}>Back</Button>}
          <Button className={i > 0 ? "" : "ml-auto"} onClick={() => (last ? close() : go(i + 1))}>{last ? "Done" : "Next"}</Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// The spotlight's box around a target, a little larger than it, kept inside the screen.
function measure(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const top = Math.max(r.top - 6, 4), left = Math.max(r.left - 6, 4);
  return { top, left, width: Math.min(r.right + 6, window.innerWidth - 4) - left, height: Math.min(r.bottom + 6, window.innerHeight - 4) - top };
}

// "Take the tour": the welcome tour again, from the start (the menu on your photo, Settings → Help).
export function startTour() {
  window.dispatchEvent(new CustomEvent("forge:tour", { detail: "welcome" }));
}

// "Brazework updates": every shipped (and upcoming) change, readable any time. In the sidebar it's a
// button; collapsed, it's just the icon.
export function UpdatesButton({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        data-tour="updates"
        onClick={() => setOpen(true)}
        aria-label={collapsed ? "What's new" : undefined}
        title={collapsed ? "What's new" : undefined}
        className={cn("group flex w-full items-center gap-3 rounded-2xl py-1.5 text-sm text-text-2 transition hover:bg-hover/60 hover:text-text", collapsed ? "justify-center" : "px-2")}
      >
        <NavTile icon={Sparkles} /> {!collapsed && <>What&apos;s new</>}
      </button>
      <UpdatesDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// The full list of updates. focusId scrolls to (and highlights) one of them.
export function UpdatesDialog({ open, onClose, focusId }: { open: boolean; onClose: () => void; focusId?: string }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const el = focusId ? document.getElementById(`update-${focusId}`) : null;
      if (el) { el.scrollIntoView({ block: "start" }); el.focus({ preventScroll: true }); }
      else closeBtn.current?.focus();
    }, 30);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open, focusId, onClose]);
  if (!open || typeof document === "undefined") return null;
  const released = UPDATES.filter((u) => u.kind !== "Next");
  const upcoming = UPDATES.filter((u) => u.kind === "Next");
  const item = (u: (typeof UPDATES)[number]) => (
    <li key={u.id} id={`update-${u.id}`} tabIndex={-1} className={cn("scroll-mt-4 rounded-2xl p-3 -mx-3 outline-none", u.id === focusId && "bg-surface-2 ring-1 ring-line-strong")}>
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-faint uppercase"><span className="rounded-full border border-line px-2 py-0.5">{u.kind === "Next" ? "Coming soon" : u.kind}</span>{u.date && updateDate(u)}</div>
      <h3 className="mt-2 font-semibold">{u.title}</h3>
      <p className="mt-1 text-sm text-text-2">{u.summary}</p>
      {u.points && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{u.points.map((p) => <li key={p}>{p}</li>)}</ul>}
    </li>
  );
  // Portalled to <body>: the cards that open it use backdrop-filter, which would otherwise trap this
  // fixed overlay inside the card and let sticky bars (the feed tabs) draw over it.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="updates-title" className="fixed inset-0 z-[70] grid place-items-center bg-bg/70 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <div className="flex items-start justify-between">
          <h2 id="updates-title" className="text-xl font-semibold tracking-tight">Brazework updates</h2>
          <button ref={closeBtn} onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        <h3 className="mt-5 font-mono text-[11px] tracking-wide text-faint uppercase">Recent changes</h3>
        <ol className="mt-2 space-y-3">{released.map(item)}</ol>
        {upcoming.length > 0 && (
          <>
            <h3 className="mt-6 font-mono text-[11px] tracking-wide text-faint uppercase">Coming next</h3>
            <ol className="mt-2 space-y-3">{upcoming.map(item)}</ol>
          </>
        )}
        <section aria-labelledby="updates-feedback" className="mt-6 border-t border-line pt-5">
          <h3 id="updates-feedback" className="font-semibold">Tell us what to build</h3>
          <div className="mt-2"><FeedbackForm /></div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
