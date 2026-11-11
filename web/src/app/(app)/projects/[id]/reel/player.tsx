"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Pause, Play, RotateCcw, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { mediaUrl } from "@/lib/media";
import { sceneMs, type Scene } from "@/lib/reel";

// The project reel player (Linear FIX-68): full screen, stories-style. Tap the right side (or →)
// for the next scene, the left side (or ←) to go back, hold (or Space) to pause, Esc to close.
// Respects reduced motion: no drifting photos, scenes still advance.
export function ReelPlayer({ scenes, back }: { scenes: Scene[]; back: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const reduce = useReducedMotion();
  const scene = scenes[i];
  const total = sceneMs(scene);
  const last = i === scenes.length - 1;
  const closeRef = useRef<HTMLAnchorElement>(null);

  const go = useCallback((d: number) => { setElapsed(0); setI((n) => Math.min(scenes.length - 1, Math.max(0, n + d))); }, [scenes.length]);

  // The clock: advances the bar and moves on when a scene's time is up (the end card stays).
  useEffect(() => {
    if (paused || last) return;
    const t0 = performance.now() - elapsed;
    let raf = 0;
    const tick = (t: number) => {
      const e = t - t0;
      if (e >= total) { go(1); return; }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // elapsed is read once when (re)starting; including it would restart every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused, last, total, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key === "Escape") closeRef.current?.click();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [go]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Project reel" className="fixed inset-0 z-[90] flex items-center justify-center bg-black text-white">
      <div className="relative h-full w-full max-w-[min(100vw,calc(100dvh*0.62))] overflow-hidden sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-[28px] sm:shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)]">
        {/* The scene. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0, scale: reduce ? 1 : 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
            <SceneView scene={scene} reduce={!!reduce} paused={paused} onVideoEnd={() => go(1)} />
          </motion.div>
        </AnimatePresence>

        {/* Tap zones: back on the left third, next on the rest; hold anywhere to pause. */}
        {!last && (
          <div className="absolute inset-0 z-10 flex" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
            <button type="button" aria-label="Previous" className="h-full w-1/3 cursor-w-resize" onClick={() => go(-1)} />
            <button type="button" aria-label="Next" className="h-full flex-1 cursor-e-resize" onClick={() => go(1)} />
          </div>
        )}

        {/* Progress, and the controls. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/60 to-transparent px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-8">
          <div className="flex gap-1" aria-hidden="true">
            {scenes.map((_, n) => (
              <span key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                <span className="block h-full rounded-full bg-white" style={{ width: n < i ? "100%" : n === i ? `${last ? 100 : Math.min(100, (elapsed / total) * 100)}%` : "0%" }} />
              </span>
            ))}
          </div>
          <div className="pointer-events-auto mt-3 flex items-center justify-end gap-1">
            <span className="sr-only" aria-live="polite">Scene {i + 1} of {scenes.length}</span>
            {!last && (
              <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} className="grid size-9 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20">
                {paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
              </button>
            )}
            <Link ref={closeRef} href={back} aria-label="Close the reel" className="grid size-9 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"><X className="size-4" /></Link>
          </div>
        </div>

        {last && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center gap-2 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            <button type="button" onClick={() => { setElapsed(0); setI(0); }} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/12 px-5 text-sm font-semibold backdrop-blur transition hover:bg-white/20"><RotateCcw className="size-4" /> Replay</button>
            <Link href={back} className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90">See the project</Link>
          </div>
        )}
      </div>
    </div>
  );
}

const Kicker = ({ children }: { children: React.ReactNode }) => <div className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">{children}</div>;

function SceneView({ scene, reduce, paused, onVideoEnd }: { scene: Scene; reduce: boolean; paused: boolean; onVideoEnd: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { const v = video.current; if (!v) return; if (paused) v.pause(); else void v.play().catch(() => {}); }, [paused]);
  const drift = reduce ? {} : { initial: { scale: 1.08 }, animate: { scale: 1.0 }, transition: { duration: 7, ease: "linear" as const } };
  const stagger = (n: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.15 + n * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } });

  switch (scene.kind) {
    case "title":
      return (
        <div className="absolute inset-0">
          {scene.cover
            ? <motion.div className="absolute inset-0" {...drift}><Image src={mediaUrl(scene.cover.path)} alt={scene.cover.alt || ""} fill sizes="100vw" className="object-cover" priority /></motion.div>
            : <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_30%_0%,#1e2a4a,#05070d)] [background-size:auto] after:absolute after:inset-0 after:bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] after:bg-[size:26px_26px]" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-7 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
            <motion.span {...stagger(0)} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">{scene.status}</motion.span>
            <motion.h1 {...stagger(1)} className="mt-3 text-[2.4rem] leading-[1.02] font-semibold tracking-tight">{scene.title}</motion.h1>
            <motion.p {...stagger(2)} className="mt-3 text-base text-white/75">by {scene.by}{scene.club ? ` · ${scene.club}` : ""}</motion.p>
          </div>
        </div>
      );
    case "goal":
      return (
        <div className="absolute inset-0 flex flex-col justify-center bg-[radial-gradient(90%_60%_at_80%_10%,color-mix(in_oklab,var(--accent)_30%,#0b0f1a),#05070d)] px-8">
          <motion.div {...stagger(0)}><Kicker>The goal</Kicker></motion.div>
          <motion.p {...stagger(1)} className="mt-4 text-[1.7rem] leading-snug font-semibold tracking-tight">{scene.text}</motion.p>
        </div>
      );
    case "media":
      return (
        <div className="absolute inset-0 bg-black">
          {scene.item.type === "video"
            ? <video ref={video} src={mediaUrl(scene.item.path)} className="absolute inset-0 h-full w-full object-contain" autoPlay muted playsInline onEnded={onVideoEnd} />
            : <motion.div className="absolute inset-0" {...drift}><Image src={mediaUrl(scene.item.path)} alt={scene.item.alt || scene.caption} fill sizes="100vw" className="object-cover" /></motion.div>}
          {scene.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-7 pt-24 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
              <motion.p {...stagger(0)} className="text-lg leading-snug font-medium">{scene.caption}</motion.p>
            </div>
          )}
        </div>
      );
    case "specs":
      return (
        <div className="absolute inset-0 flex flex-col justify-center bg-[radial-gradient(90%_60%_at_20%_100%,#13233f,#05070d)] px-7">
          <motion.div {...stagger(0)}><Kicker>By the numbers</Kicker></motion.div>
          <div className="mt-6 grid grid-cols-1 gap-3">
            {scene.specs.map((s, n) => (
              <motion.div key={s.label} {...stagger(n + 1)} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
                <div className="text-xs text-white/60">{s.label}</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{s.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      );
    case "proof":
      return (
        <div className="absolute inset-0 flex flex-col justify-center bg-[radial-gradient(90%_70%_at_50%_0%,#0f3d2a,#03100a)] px-7">
          <motion.div {...stagger(0)}><Kicker>Proof · {scene.n} of {scene.of}</Kicker></motion.div>
          <motion.h2 {...stagger(1)} className="mt-4 text-[1.9rem] leading-tight font-semibold tracking-tight">{scene.title}</motion.h2>
          {scene.detail && <motion.p {...stagger(2)} className="mt-3 text-base text-white/75">{scene.detail}</motion.p>}
          {/* The stamp: who signed it, for which club, and when. */}
          <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6, rotate: -14 }} animate={{ opacity: 1, scale: 1, rotate: -4 }} transition={{ delay: 0.75, type: "spring", stiffness: 260, damping: 16 }}
            className="mt-8 inline-flex w-fit flex-col gap-1 rounded-2xl border-2 border-emerald-400/80 px-5 py-3 text-emerald-300 shadow-[0_0_40px_-10px_rgb(52_211_153/0.6)]">
            <span className="inline-flex items-center gap-2 text-sm font-bold tracking-[0.2em] uppercase"><BadgeCheck className="size-5" /> Verified</span>
            <span className="text-sm text-emerald-100/90">Signed by {scene.by} · {scene.club}</span>
            <span className="text-xs text-emerald-100/60">{new Date(`${scene.on}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </motion.div>
        </div>
      );
    case "tools":
      return (
        <div className="absolute inset-0 flex flex-col justify-center bg-[radial-gradient(90%_60%_at_80%_100%,#2a1a3f,#07050d)] px-7">
          <motion.div {...stagger(0)}><Kicker>Built with</Kicker></motion.div>
          <div className="mt-6 flex flex-wrap gap-2">
            {scene.tools.map((t, n) => <motion.span key={t} {...stagger(n + 1)} className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 font-mono text-sm">{t}</motion.span>)}
          </div>
        </div>
      );
    case "end":
      return (
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(90%_60%_at_50%_30%,#27272a,#050505)] px-7 text-center")}>
          <motion.div {...stagger(0)}><Kicker>Built by</Kicker></motion.div>
          <motion.p {...stagger(1)} className="mt-4 text-2xl leading-snug font-semibold">{scene.team.join(", ")}</motion.p>
          {scene.verified > 0 && (
            <motion.p {...stagger(2)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-medium text-emerald-300"><BadgeCheck className="size-4" /> {scene.verified} club-verified {scene.verified === 1 ? "milestone" : "milestones"}</motion.p>
          )}
          <motion.p {...stagger(3)} className="mt-8 text-sm text-white/50">{scene.title} · on Brazework</motion.p>
        </div>
      );
  }
}
