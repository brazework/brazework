"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, CalendarDays, Pause, Play, RotateCcw, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { mediaUrl } from "@/lib/media";
import { positions, sceneMs, type Reel, type Scene } from "@/lib/reel";

// The project reel player (Linear FIX-68): the build as a timeline, full screen. The timeline along
// the bottom runs from the start to now: a dot for each update, a seal for each verified milestone,
// and a playhead that moves through time as the reel plays. Tap a point to jump there; tap the right
// side (or →) for the next moment, the left (or ←) to go back, hold (or Space) to pause, Esc to close.
// Respects reduced motion: no drifting photos or travelling playhead; scenes still advance.
const fmt = (t: number, year = false) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year && { year: "numeric" }), timeZone: "UTC" });

export function ReelPlayer({ reel, back }: { reel: Reel; back: string }) {
  const { scenes } = reel;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const reduce = useReducedMotion();
  const scene = scenes[i];
  const total = sceneMs(scene);
  const last = i === scenes.length - 1;
  const closeRef = useRef<HTMLAnchorElement>(null);
  const pos = useMemo(() => positions(reel), [reel]);

  const jump = useCallback((n: number) => { setElapsed(0); setI(Math.min(scenes.length - 1, Math.max(0, n))); }, [scenes.length]);
  const go = useCallback((d: number) => { setElapsed(0); setI((n) => Math.min(scenes.length - 1, Math.max(0, n + d))); }, [scenes.length]);

  // The clock: advances the playhead and moves on when a scene's time is up (the end card stays).
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

  // The playhead travels from this moment toward the next one while the scene plays.
  const here = pos[i];
  const next = pos[Math.min(i + 1, pos.length - 1)];
  const head = last ? 1 : reduce ? here : here + (next - here) * Math.min(1, elapsed / total);
  const dated = scene.kind === "step" || scene.kind === "proof" ? scene : null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Project reel" className="fixed inset-0 z-[90] flex items-center justify-center bg-black text-white">
      <div className="relative h-full w-full max-w-[min(100vw,calc(100dvh*0.62))] overflow-hidden sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-[28px] sm:shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9)]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0, scale: reduce ? 1 : 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
            <SceneView scene={scene} reel={reel} reduce={!!reduce} paused={paused} onVideoEnd={() => go(1)} />
          </motion.div>
        </AnimatePresence>

        {/* Tap zones: back on the left third, next on the rest; hold anywhere to pause. */}
        {!last && (
          <div className="absolute inset-0 z-10 flex" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
            <button type="button" aria-label="Previous" className="h-full w-1/3 cursor-w-resize" onClick={() => go(-1)} />
            <button type="button" aria-label="Next" className="h-full flex-1 cursor-e-resize" onClick={() => go(1)} />
          </div>
        )}

        {/* Top: where we are in time, and the controls. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 pt-[calc(env(safe-area-inset-top)+0.9rem)] pb-10">
          <span className="sr-only" aria-live="polite">Scene {i + 1} of {scenes.length}</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={dated ? `w${dated.week}-${dated.at}` : scene.kind} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.25 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <CalendarDays className="size-3.5" /> {dated ? <>Week {dated.week} · {fmt(dated.at)}</> : i === 0 ? <>{fmt(reel.start, true)}</> : <>{reel.live ? "Now" : fmt(reel.end, true)}</>}
            </motion.span>
          </AnimatePresence>
          <div className="pointer-events-auto ml-auto flex items-center gap-1">
            {!last && (
              <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} className="grid size-9 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20">
                {paused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
              </button>
            )}
            <Link ref={closeRef} href={back} aria-label="Close the reel" className="grid size-9 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"><X className="size-4" /></Link>
          </div>
        </div>

        {/* Bottom: the timeline (and, at the end, replay). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-5 pt-12 pb-[calc(env(safe-area-inset-bottom)+1.1rem)]">
          {last && (
            <div className="pointer-events-auto mb-5 flex justify-center gap-2">
              <button type="button" onClick={() => jump(0)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/12 px-5 text-sm font-semibold backdrop-blur transition hover:bg-white/20"><RotateCcw className="size-4" /> Replay</button>
              <Link href={back} className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90">See the project</Link>
            </div>
          )}
          <Timeline reel={reel} pos={pos} at={i} head={head} onJump={jump} />
        </div>
      </div>
    </div>
  );
}

// The build's timeline: start → now, every update a dot, every verified milestone a seal. Points behind
// the playhead are lit; the seal you're on glows.
function Timeline({ reel, pos, at, head, onJump }: { reel: Reel; pos: number[]; at: number; head: number; onJump: (n: number) => void }) {
  // The track runs 4%–96% of the width, so a point on the first or last day isn't cut by the edge.
  const px = (x: number) => `${(0.04 + x * 0.92) * 100}%`;
  const marks = reel.scenes.flatMap((s, n) => (s.kind === "step" || s.kind === "proof" ? [{ s, n, x: pos[n] }] : []));
  return (
    <nav aria-label="Build timeline" className="pointer-events-auto">
      <div className="relative mx-2 h-9">
        <span aria-hidden className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/18" style={{ left: px(0), right: "4%" }} />
        <span aria-hidden className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-white/70 to-white" style={{ left: px(0), width: `${head * 92}%` }} />
        {marks.map(({ s, n, x }) => {
          const passed = pos[n] <= head + 1e-6 && n <= at;
          const current = n === at;
          const label = s.kind === "proof" ? `Verified: ${s.title}, ${fmt(s.at)}` : `Update ${s.n} of ${s.of}, ${fmt(s.at)}`;
          return (
            <button key={n} type="button" onClick={() => onJump(n)} aria-label={label} aria-current={current ? "step" : undefined} title={label}
              className="absolute top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center" style={{ left: px(x) }}>
              {s.kind === "proof" ? (
                <span className={cn("relative grid size-6 place-items-center rounded-full transition duration-300", passed ? "bg-emerald-400 text-black shadow-[0_0_18px_2px_rgb(52_211_153/0.65)]" : "bg-white/15 text-white/50 ring-1 ring-white/25", current && "scale-125")}>
                  {current && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />}
                  <BadgeCheck className="relative size-4" />
                </span>
              ) : (
                <span className={cn("block rounded-full transition duration-300", current ? "size-3.5 bg-white ring-4 ring-white/25" : passed ? "size-2.5 bg-white" : "size-2.5 bg-white/30")} />
              )}
            </button>
          );
        })}
        {/* The playhead. */}
        <span aria-hidden className="pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_3px_rgb(255_255_255/0.6)]" style={{ left: px(head) }} />
      </div>
      <div className="mt-1 flex justify-between px-1 text-[11px] font-medium text-white/55">
        <span>{fmt(reel.start, true)}</span>
        <span>{reel.live ? "Now" : fmt(reel.end, true)}</span>
      </div>
    </nav>
  );
}

const Kicker = ({ children }: { children: React.ReactNode }) => <div className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">{children}</div>;
// The reel's own dark backdrop: a faint engineering grid under soft light (neutral, like the app).
const backdrop = "absolute inset-0 bg-[radial-gradient(110%_70%_at_30%_0%,#27272a,#050505)] after:absolute after:inset-0 after:bg-[linear-gradient(rgb(255_255_255/0.045)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.045)_1px,transparent_1px)] after:bg-[size:26px_26px] after:[mask-image:linear-gradient(to_bottom,black,transparent_85%)]";

function SceneView({ scene, reel, reduce, paused, onVideoEnd }: { scene: Scene; reel: Reel; reduce: boolean; paused: boolean; onVideoEnd: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { const v = video.current; if (!v) return; if (paused) v.pause(); else void v.play().catch(() => {}); }, [paused]);
  const drift = reduce ? {} : { initial: { scale: 1.08 }, animate: { scale: 1.0 }, transition: { duration: 7, ease: "linear" as const } };
  const stagger = (n: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.15 + n * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } });
  const bottom = "absolute inset-x-0 bottom-0 px-7 pb-[calc(env(safe-area-inset-bottom)+7.5rem)]";

  switch (scene.kind) {
    case "title":
      return (
        <div className="absolute inset-0">
          {scene.cover
            ? <motion.div className="absolute inset-0" {...drift}><Image src={mediaUrl(scene.cover.path)} alt={scene.cover.alt || ""} fill sizes="100vw" className="object-cover" priority /></motion.div>
            : <div className={backdrop} />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
          <div className={bottom}>
            <motion.span {...stagger(0)} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">{scene.status}</motion.span>
            <motion.h1 {...stagger(1)} className="mt-3 text-[2.4rem] leading-[1.02] font-semibold tracking-tight">{scene.title}</motion.h1>
            <motion.p {...stagger(2)} className="mt-3 text-base text-white/75">by {scene.by}{scene.club ? ` · ${scene.club}` : ""}</motion.p>
            {/* The build in three numbers. */}
            <motion.div {...stagger(3)} className="mt-5 flex gap-2 text-sm">
              {[[scene.weeks, scene.weeks === 1 ? "week" : "weeks"], [scene.updates, scene.updates === 1 ? "update" : "updates"]].map(([n, l]) => (
                <span key={String(l)} className="rounded-2xl bg-white/10 px-3 py-2 backdrop-blur"><b className="text-lg tabular-nums">{n}</b> <span className="text-white/70">{l}</span></span>
              ))}
              {scene.verified > 0 && <span className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-400/15 px-3 py-2 text-emerald-200 ring-1 ring-emerald-300/30"><BadgeCheck className="size-4" /><b className="text-lg tabular-nums">{scene.verified}</b> verified</span>}
            </motion.div>
          </div>
        </div>
      );
    case "goal":
      return (
        <div className="absolute inset-0 flex flex-col justify-center px-8">
          <div className={backdrop} />
          <motion.div {...stagger(0)} className="relative"><Kicker>The goal</Kicker></motion.div>
          <motion.p {...stagger(1)} className="relative mt-4 text-[1.7rem] leading-snug font-semibold tracking-tight">{scene.text}</motion.p>
        </div>
      );
    case "step":
      return scene.item ? (
        <div className="absolute inset-0 bg-black">
          {scene.item.type === "video"
            ? <video ref={video} src={mediaUrl(scene.item.path)} className="absolute inset-0 h-full w-full object-contain" autoPlay muted playsInline onEnded={onVideoEnd} />
            : <motion.div className="absolute inset-0" {...drift}><Image src={mediaUrl(scene.item.path)} alt={scene.item.alt || scene.text} fill sizes="100vw" className="object-cover" /></motion.div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
          <div className={bottom}>
            <motion.div {...stagger(0)}><Kicker>Update {scene.n} of {scene.of}</Kicker></motion.div>
            {scene.text && <motion.p {...stagger(1)} className="mt-2 text-lg leading-snug font-medium">{scene.text}</motion.p>}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col justify-center px-8">
          <div className={backdrop} />
          <motion.div {...stagger(0)} className="relative"><Kicker>Update {scene.n} of {scene.of}</Kicker></motion.div>
          <motion.p {...stagger(1)} className="relative mt-4 text-[1.6rem] leading-snug font-semibold tracking-tight">&ldquo;{scene.text}&rdquo;</motion.p>
        </div>
      );
    case "proof":
      return (
        <div className="absolute inset-0 flex flex-col justify-center overflow-hidden px-7">
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_15%,#0f3d2a,#020806)]" />
          {/* The moment: a burst of light behind the stamp. */}
          <motion.div aria-hidden className="absolute top-[38%] left-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(52_211_153/0.35),transparent)]"
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
          <motion.div {...stagger(0)} className="relative"><Kicker>Week {scene.week} · Club-verified</Kicker></motion.div>
          <motion.h2 {...stagger(1)} className="relative mt-4 text-[1.9rem] leading-tight font-semibold tracking-tight">{scene.title}</motion.h2>
          {scene.detail && <motion.p {...stagger(2)} className="relative mt-3 text-base text-white/75">{scene.detail}</motion.p>}
          {/* The stamp: who signed it, for which club, when, and what they checked. */}
          <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.7, rotate: -16 }} animate={{ opacity: 1, scale: 1, rotate: -4 }} transition={{ delay: 0.75, type: "spring", stiffness: 260, damping: 15 }}
            className="relative mt-8 inline-flex w-fit max-w-full flex-col gap-1 rounded-2xl border-2 border-emerald-400/85 bg-emerald-950/40 px-5 py-3.5 text-emerald-300 shadow-[0_0_50px_-8px_rgb(52_211_153/0.7)] backdrop-blur">
            <span className="inline-flex items-center gap-2 text-sm font-bold tracking-[0.2em] uppercase"><BadgeCheck className="size-5" /> Verified</span>
            <span className="text-sm text-emerald-100/90">Signed by {scene.by} · {scene.club}</span>
            <span className="text-xs text-emerald-100/60">{fmt(scene.at, true)}</span>
            {scene.note && <span className="mt-1 max-w-xs text-xs leading-relaxed text-emerald-50/80">&ldquo;{scene.note}&rdquo;</span>}
          </motion.div>
        </div>
      );
    case "specs":
      return (
        <div className="absolute inset-0 flex flex-col justify-center px-7">
          <div className={backdrop} />
          <motion.div {...stagger(0)} className="relative"><Kicker>Where it stands</Kicker></motion.div>
          <div className="relative mt-6 grid grid-cols-1 gap-3">
            {scene.specs.map((s, n) => (
              <motion.div key={s.label} {...stagger(n + 1)} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
                <div className="text-xs text-white/60">{s.label}</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{s.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      );
    case "tools":
      return (
        <div className="absolute inset-0 flex flex-col justify-center px-7">
          <div className={backdrop} />
          <motion.div {...stagger(0)} className="relative"><Kicker>Built with</Kicker></motion.div>
          <div className="relative mt-6 flex flex-wrap gap-2">
            {scene.tools.map((t, n) => <motion.span key={t} {...stagger(n + 1)} className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 font-mono text-sm">{t}</motion.span>)}
          </div>
        </div>
      );
    case "end":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-7 pb-24 text-center">
          <div className={backdrop} />
          <motion.div {...stagger(0)} className="relative"><Kicker>{fmt(scene.from, true)} → {reel.live ? "now" : fmt(scene.to, true)}</Kicker></motion.div>
          <motion.p {...stagger(1)} className="relative mt-4 text-[1.7rem] leading-tight font-semibold tracking-tight">{scene.weeks} {scene.weeks === 1 ? "week" : "weeks"}. {scene.updates} {scene.updates === 1 ? "update" : "updates"}.</motion.p>
          {scene.verified > 0 && (
            <motion.p {...stagger(2)} className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-medium text-emerald-300 ring-1 ring-emerald-300/25"><BadgeCheck className="size-4" /> {scene.verified} club-verified {scene.verified === 1 ? "milestone" : "milestones"}</motion.p>
          )}
          <motion.p {...stagger(3)} className="relative mt-6 text-base text-white/80">Built by {scene.team.join(", ")}</motion.p>
          <motion.p {...stagger(4)} className="relative mt-2 text-sm text-white/45">{scene.title} · on Brazework</motion.p>
        </div>
      );
  }
}
