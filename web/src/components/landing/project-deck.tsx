"use client";
import { AnimatePresence, motion, useInView, useReducedMotion, type PanInfo } from "motion/react";
import { BadgeCheck, ChevronLeft, ChevronRight, Clock3, Eye, Play, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { usePinned } from "./use-pinned";
import { Schematic } from "./schematics";

// The landing page's project section (Linear FIX-92): one project page per kind of builder, stacked
// like a deck. The top card is the one you read; the next ones peek out behind it. Wide screens: the
// section is pinned and scrolling deals the deck, one project per step (use-pinned.ts); the arrows and
// field tabs scroll to theirs. Phones: every few seconds the top card slides away and the next rises
// into place; drag it, use the arrows, or pick a field. Holds still for reduced motion.
// Example data throughout.

type Project = {
  id: string; field: string; art: string; title: string; club: string; media: string;
  callouts: [string, string]; stats: [string, string][]; tools: string[];
  verified: { title: string; by: string }; pending: string; company: string; note: string;
  vouch?: boolean; // signed by someone the member asked (no club)
};

const PROJECTS: Project[] = [
  {
    id: "aero", field: "Aerospace", art: "aerospace", title: "Airfoil wind tunnel study", club: "Rocketry Club", media: "0:42 tunnel run",
    callouts: ["Pitot tube", "Load cell ±0.5%"], stats: [["Peak L/D", "14.2"], ["Angle of attack", "0–12°"], ["Load cell", "±0.5%"]], tools: ["SolidWorks", "ANSYS", "Python"],
    verified: { title: "Measured lift on 3 airfoils", by: "Maya Patel, President" }, pending: "Full sweep from 0° to 12°", company: "Acme Aerospace", note: "Saw your verified wind tunnel results. Want to talk about a summer internship?",
  },
  {
    id: "software", field: "Software", art: "cs", title: "Campus shuttle tracker", club: "ACM Chapter", media: "1:10 demo",
    callouts: ["Live map", "p95 180 ms"], stats: [["Weekly riders", "2.1k"], ["Merged PRs", "41"], ["p95 latency", "180 ms"]], tools: ["TypeScript", "React Native", "Postgres"],
    verified: { title: "v1.0 live on the App Store", by: "Dev Shah, Tech lead" }, pending: "Offline mode for the night routes", company: "Northwind Software", note: "Your shuttle tracker's commit history is great. Open to a new-grad chat?",
  },
  {
    id: "mech", field: "Mechanical", art: "mechanical", title: "Formula SAE gearbox", club: "Formula SAE", media: "0:58 dyno pull",
    callouts: ["Output shaft", "3.2 : 1"], stats: [["Ratio", "3.2 : 1"], ["Mass", "4.1 kg"], ["Proof load", "1.4 kN"]], tools: ["SolidWorks", "ANSYS", "CNC"],
    verified: { title: "Held 1.4 kN with no yield", by: "Luis Ortega, Chief engineer" }, pending: "Endurance run, 22 km", company: "Vector Motors", note: "We build drivetrains too. Your load test write-up stood out.",
  },
  {
    id: "elec", field: "Electrical", art: "electrical", title: "Battery management board", club: "IEEE Student Branch", media: "0:35 bring-up",
    callouts: ["Cell balancer", "0.4% ripple"], stats: [["Cells", "12S"], ["Ripple", "0.4%"], ["Layers", "4"]], tools: ["KiCad", "STM32", "C"],
    verified: { title: "PCB v2 brought up first try", by: "Aisha Bello, Hardware lead" }, pending: "Thermal soak at 45 °C", company: "Volt Systems", note: "Clean scope captures. Our power team would like to meet you.",
  },
  {
    id: "civil", field: "Civil", art: "civil", title: "Balsa truss bridge", club: "ASCE Chapter", media: "0:21 load test",
    callouts: ["Gusset plate", "500 N"], stats: [["Load", "500 N"], ["Deflection", "2.1 mm"], ["Mass", "38 g"]], tools: ["SAP2000", "AutoCAD", "Excel"],
    verified: { title: "Carried 500 N at 2.1 mm", by: "Grace Liu, Captain" }, pending: "Regional competition entry", company: "Span & Co.", note: "That strength-to-weight ratio is excellent. Interested in a site internship?",
  },
  {
    id: "bio", field: "Biomedical", art: "biomedical", title: "Wearable heart-rate patch", club: "BMES Chapter", media: "0:47 bench test",
    callouts: ["PPG sensor", "±2 bpm"], stats: [["Accuracy", "±2 bpm"], ["Validation runs", "12"], ["Battery", "30 h"]], tools: ["Arduino", "MATLAB", "Fusion 360"],
    verified: { title: "Matched the reference on 12 runs", by: "Noah Kim, President" }, pending: "Motion-artifact filter", company: "Pulse Medical", note: "Your validation protocol is exactly how we work. Let's talk.",
  },
  {
    id: "ai", field: "AI / ML", art: "ai", title: "Crop disease classifier", club: "Independent project", media: "0:30 field demo", vouch: true,
    callouts: ["On-device model", "94% top-1"], stats: [["Accuracy", "94%"], ["Images", "18k"], ["Model size", "9 MB"]], tools: ["PyTorch", "Python", "Core ML"],
    verified: { title: "Beat the baseline by 11 points", by: "Dr. Sara Haddad, Assistant Professor · uw.edu" }, pending: "Field trial with the ag school", company: "Fieldwise AI", note: "We'd love to hear how you labelled 18k images. Coffee?",
  },
];

const VISIBLE = 4; // cards drawn: the top one and three behind it
const EASE = [0.16, 1, 0.3, 1] as const;

export function ProjectDeck() {
  const [top, setTop] = useState(0);
  const [dir, setDir] = useState(1); // 1: the top card leaves to the left; -1: a card comes back from the left
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const n = PROJECTS.length;
  const go = (to: number, d: number) => { setDir(d); setTop(((to % n) + n) % n); };
  // Wide screens: the scroll deals the deck.
  const pin = usePinned(ref, n, (next, prev) => go(next, next > prev ? 1 : -1));
  // Buttons, tabs and drags: on wide screens they scroll to the step, which moves the deck.
  const pick = (to: number, d: number) => (pin.wide ? pin.goTo(((to % n) + n) % n) : go(to, d));

  useEffect(() => {
    if (pin.wide || reduce || paused || !inView) return;
    const t = setTimeout(() => go(top + 1, 1), 4200);
    return () => clearTimeout(t);
  }, [top, reduce, paused, inView, pin.wide]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -400) pick(top + 1, 1);
    else if (info.offset.x > 70 || info.velocity.x > 400) pick(top - 1, -1);
  };
  const stack = Array.from({ length: VISIBLE }, (_, k) => ({ p: PROJECTS[(top + k) % n], k }));
  const current = PROJECTS[top];

  return (
    <div ref={ref} data-noscene onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)} onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      {/* Field picker: every kind of builder, one tap away. */}
      <div role="tablist" aria-label="Example projects by field" className="no-scrollbar -mx-6 mb-5 flex gap-1.5 overflow-x-auto px-6 sm:mx-0 sm:flex-wrap sm:px-0">
        {PROJECTS.map((p, i) => (
          <button key={p.id} type="button" role="tab" aria-selected={i === top} onClick={() => pick(i, i >= top ? 1 : -1)}
            className={cn("shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition", i === top ? "border-text bg-text text-bg" : "border-line text-muted hover:border-line-strong hover:text-text")}>
            {p.field}
          </button>
        ))}
      </div>

      {/* The deck: every card in the same grid cell, so the deck is as tall as its tallest card. The
          ones behind are pushed up and shrunk so their tops show. */}
      <div className="relative grid pt-12 [&>*]:[grid-area:1/1]" aria-live="polite">
        <AnimatePresence initial={false} custom={dir}>
          {stack.slice().reverse().map(({ p, k }) => (
            <motion.article
              key={p.id}
              custom={dir}
              aria-hidden={k > 0}
              inert={k > 0}
              initial={reduce ? false : "enter"}
              animate={{ y: k * -22, scale: 1 - k * 0.05, opacity: k < VISIBLE - 1 ? 1 - k * 0.12 : 0, zIndex: VISIBLE - k, x: 0, rotate: 0, filter: `brightness(${1 - k * 0.08})` }}
              exit="leave"
              variants={{
                enter: (d: number) => (d > 0 ? { y: (VISIBLE - 1) * -22, scale: 1 - VISIBLE * 0.05, opacity: 0, zIndex: 0 } : { x: "-115%", rotate: -7, opacity: 0, zIndex: VISIBLE + 1 }),
                leave: (d: number) => (d > 0 ? { x: "-115%", rotate: -7, opacity: 0, zIndex: VISIBLE + 1, transition: { duration: 0.55, ease: EASE } } : { y: (VISIBLE - 1) * -22, scale: 1 - VISIBLE * 0.05, opacity: 0, zIndex: 0, transition: { duration: 0.4 } }),
              }}
              transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
              drag={k === 0 && !reduce ? "x" : false}
              dragSnapToOrigin
              dragElastic={0.6}
              onDragStart={() => setPaused(true)}
              onDragEnd={onDragEnd}
              style={{ transformOrigin: "50% 0%" }}
              className={cn("glass-card overflow-hidden rounded-[28px] shadow-[0_40px_100px_-40px_rgb(0_0_0/0.5)]", k === 0 && !reduce && "cursor-grab touch-pan-y active:cursor-grabbing")}
            >
              <Card p={p} />
            </motion.article>
          ))}
        </AnimatePresence>

        {/* The moment it pays off: a company writes in about this project. */}
        <div className="pointer-events-none relative z-20 hidden self-end sm:block">
          <AnimatePresence mode="wait">
            <motion.div key={current.id} initial={reduce ? false : { opacity: 0, y: 14, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -2 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.45, delay: reduce ? 0 : 0.5, ease: EASE }}
              className="absolute -bottom-24 -left-8 w-64 rounded-2xl border border-line bg-surface p-3.5 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)]">
              <div className="flex items-center gap-2 text-xs font-medium"><span className="grid size-6 place-items-center rounded-lg bg-text text-bg"><Sparkles className="size-3.5" /></span> {current.company}</div>
              <p className="mt-2 text-sm leading-snug">&ldquo;{current.note}&rdquo;</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 sm:mt-28 sm:pl-60">
        <p className="text-xs text-faint"><span className="font-medium text-text tabular-nums">{String(top + 1).padStart(2, "0")}</span> / {String(n).padStart(2, "0")} · Example data{!reduce && <span className="m-hide"> · drag to flip</span>}</p>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => pick(top - 1, -1)} aria-label="Previous project" className="grid size-9 place-items-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-text"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => pick(top + 1, 1)} aria-label="Next project" className="grid size-9 place-items-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-text"><ChevronRight className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

function Card({ p }: { p: Project }) {
  return (
    <>
      <div className="relative aspect-[16/8] overflow-hidden bg-[linear-gradient(135deg,#09090b,#1f1f22_55%,#09090b)] text-white/80 sm:aspect-[16/7] md:aspect-[16/6]">
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:22px_22px]" />
        <Schematic id={p.art} className="absolute top-1/2 left-1/2 w-[58%] -translate-x-1/2 -translate-y-1/2 text-white/70" />
        <span className="absolute top-[20%] left-[12%] flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-black shadow-lg"><span className="grid size-4 place-items-center rounded-full bg-black text-[9px] text-white">1</span> {p.callouts[0]}</span>
        <span className="absolute right-[10%] bottom-[20%] flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-black shadow-lg"><span className="grid size-4 place-items-center rounded-full bg-black text-[9px] text-white">2</span> {p.callouts[1]}</span>
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur"><Play className="size-3 fill-current" /> {p.media}</span>
        <span className="absolute top-3 right-3 rounded-md border border-white/15 bg-black/40 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white/85 backdrop-blur">{p.field}</span>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight">{p.title}</h3>
            <p className="mt-0.5 text-xs text-faint">In progress · updated today · {p.club}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-2.5 py-1 text-xs font-medium text-ok"><BadgeCheck className="size-3.5" /> {p.vouch ? "Vouched for" : "Club-verified"}</span>
        </div>
        <div className="m-hide mt-4 grid grid-cols-3 gap-2">
          {p.stats.map(([l, v]) => (
            <div key={l} className="min-w-0 rounded-xl bg-surface-2/70 px-3 py-2"><div className="truncate text-[11px] text-faint">{l}</div><div className="text-sm font-semibold">{v}</div></div>
          ))}
        </div>
        <div className="m-hide mt-4 flex flex-wrap gap-1.5 [@media(min-width:768px)_and_(max-height:1000px)]:hidden">
          {p.tools.map((t) => <span key={t} className="rounded-lg border border-line px-2 py-1 font-mono text-[11px] text-muted">{t}</span>)}
        </div>
        <ol className="mt-4 space-y-2">
          <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface/80 px-3.5 py-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ok text-white"><BadgeCheck className="size-3.5" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.verified.title}</p>
              <p className="truncate text-[11px] font-medium text-ok">{p.vouch ? `Vouched for by ${p.verified.by}` : `Verified by ${p.verified.by} · ${p.club}`}</p>
            </div>
          </li>
          <li className="m-hide [@media(min-width:768px)_and_(max-height:1000px)]:hidden flex items-center gap-3 rounded-2xl border border-dashed border-line px-3.5 py-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-muted"><Clock3 className="size-3.5" /></span>
            <p className="min-w-0 flex-1 truncate text-sm text-muted">{p.pending}</p>
            <span className="shrink-0 text-[11px] text-faint">Waiting on 1 officer</span>
          </li>
        </ol>
        <p className="m-hide mt-4 inline-flex items-center gap-1.5 text-xs font-medium [@media(min-width:768px)_and_(max-height:1000px)]:hidden"><Eye className="size-3.5" /> 24 profile views this week</p>
      </div>
    </>
  );
}
