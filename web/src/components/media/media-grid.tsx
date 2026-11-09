"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, ChevronsLeftRight, Crosshair, Flag, Maximize, Pause, Play, Repeat, StepBack, StepForward, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { mediaUrl, type MediaItem } from "@/lib/media";
import { Pin, fmtTime } from "./annotate";

// Photos or a video on a post:
// - one photo keeps its shape; with callouts it's never cropped, so the pins land where they were put
// - 2–4 photos tile, and tapping one opens a full-screen viewer (arrow keys, Escape) with its callouts
// - a before/after pair becomes a slider
// - a video gets the test-run player: speed, loop, frame steps and timeline markers
export function MediaGrid({ media, alt }: { media: MediaItem[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;
  if (media[0].type === "video") return <TestRunPlayer v={media[0]} />;
  if (media.length === 2 && media.every((m) => m.cmp)) return <CompareSlider before={media[0]} after={media[1]} alt={alt} />;

  const images = media.filter((m) => m.type === "image");
  const n = images.length;
  if (n === 1 && images[0].notes?.length) return <NotedPhoto m={images[0]} alt={images[0].alt || alt} />;
  // One photo: its own aspect ratio, clamped between 4:5 (tall) and 2:1 (wide).
  const ratio = (m: MediaItem) => (m.w && m.h ? Math.min(2, Math.max(0.8, m.w / m.h)) : 4 / 3);

  return (
    <>
      <div className={cn("mt-4 grid gap-1 overflow-hidden rounded-2xl border border-line", n === 1 ? "grid-cols-1" : "grid-cols-2", n === 3 && "grid-rows-2")}>
        {images.map((m, i) => (
          <button
            key={m.path}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo ${i + 1} of ${n}${m.notes?.length ? `, ${m.notes.length} callouts` : ""}`}
            className={cn("group relative block overflow-hidden bg-raised", n === 3 && i === 0 && "row-span-2")}
            style={{ aspectRatio: n === 1 ? ratio(m) : n === 3 && i === 0 ? undefined : "1 / 1" }}
          >
            <Image
              src={mediaUrl(m.path)}
              alt={m.alt || (n === 1 ? alt : `${alt} (photo ${i + 1} of ${n})`)}
              fill
              sizes={n === 1 ? "(min-width: 768px) 640px, 100vw" : "(min-width: 768px) 320px, 50vw"}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            {!!m.notes?.length && (
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white backdrop-blur"><Crosshair className="size-3.5" /> {m.notes.length}</span>
            )}
          </button>
        ))}
      </div>
      <Lightbox images={images} index={open} onClose={() => setOpen(null)} onIndex={setOpen} alt={alt} />
    </>
  );
}

// A box with the photo's exact shape (never cropped), so callout positions match the editor.
function PhotoBox({ m, alt, sizes, maxH, active, onPin, className }: { m: MediaItem; alt: string; sizes: string; maxH: string; active?: number | null; onPin?: (i: number) => void; className?: string }) {
  const r = m.w && m.h ? m.w / m.h : 4 / 3;
  return (
    <div className={cn("relative mx-auto overflow-hidden bg-raised", className)} style={{ aspectRatio: r, width: `min(100%, calc(${maxH} * ${r}))` }}>
      <Image src={mediaUrl(m.path)} alt={alt} fill sizes={sizes} className="object-cover" />
      {m.notes?.map((c, i) => <Pin key={i} n={i + 1} x={c.x} y={c.y} label={c.t} active={active === i} onClick={onPin ? () => onPin(i) : undefined} />)}
    </div>
  );
}

function Legend({ m, active, onActive, dark }: { m: MediaItem; active: number | null; onActive: (i: number | null) => void; dark?: boolean }) {
  if (!m.notes?.length) return null;
  return (
    <ol className="mt-3 flex flex-wrap gap-1.5">
      {m.notes.map((c, i) => (
        <li key={i}>
          <button
            type="button"
            onMouseEnter={() => onActive(i)}
            onMouseLeave={() => onActive(null)}
            onFocus={() => onActive(i)}
            onBlur={() => onActive(null)}
            onClick={() => onActive(active === i ? null : i)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-xs transition", active === i ? "border-transparent bg-accent-grad text-on-accent" : dark ? "border-white/20 text-white/85 hover:bg-white/10" : "border-line text-text-2 hover:bg-hover")}
          >
            <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-bold", active === i ? "bg-black/20" : dark ? "bg-white/15" : "bg-raised")}>{i + 1}</span>
            {c.t}
          </button>
        </li>
      ))}
    </ol>
  );
}

function NotedPhoto({ m, alt }: { m: MediaItem; alt: string }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="mt-4">
      <PhotoBox m={m} alt={alt} sizes="(min-width: 768px) 640px, 100vw" maxH="560px" active={active} onPin={(i) => setActive(active === i ? null : i)} className="rounded-2xl border border-line" />
      <Legend m={m} active={active} onActive={setActive} />
    </div>
  );
}

// Drag (or arrow-key) between two photos. The range input is the real control, stretched invisibly
// over the photos, so it works with mouse, touch, keyboard and screen readers.
function CompareSlider({ before, after, alt }: { before: MediaItem; after: MediaItem; alt: string }) {
  const [pos, setPos] = useState(50);
  const r = before.w && before.h ? Math.min(2, Math.max(0.8, before.w / before.h)) : 4 / 3;
  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-line bg-raised select-none" style={{ aspectRatio: r }}>
      <Image src={mediaUrl(after.path)} alt={after.alt || `${alt}: after`} fill sizes="(min-width: 768px) 640px, 100vw" className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Image src={mediaUrl(before.path)} alt={before.alt || `${alt}: before`} fill sizes="(min-width: 768px) 640px, 100vw" className="object-cover" />
      </div>
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur">Before</span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur">After</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,0.5)]" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/60 text-white shadow-xl backdrop-blur"><ChevronsLeftRight className="size-5" /></span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

const SPEEDS = [1, 0.5, 0.25, 2];

// The test-run player: speed for slow-mo, loop, frame-by-frame, and the poster's timeline markers.
// Keys while it's focused: space/k play, ←/→ 5 s, , and . one frame.
function TestRunPlayer({ v }: { v: MediaItem }) {
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  // The video is server-rendered, so its metadata can load before React attaches onLoadedMetadata;
  // read the duration as soon as the element is attached too, or the scrubber and markers stay empty.
  const attach = useCallback((node: HTMLVideoElement | null) => {
    ref.current = node;
    if (node && node.readyState >= 1 && Number.isFinite(node.duration)) setDur(node.duration);
  }, []);
  const marks = (v.marks ?? []).filter((m) => !dur || m.s <= dur);
  const el = () => ref.current;
  const toggle = () => { const x = el(); if (!x) return; if (x.paused) void x.play(); else x.pause(); };
  const seek = (s: number) => { const x = el(); if (x) { x.currentTime = Math.max(0, Math.min(dur || s, s)); setT(x.currentTime); } };
  const step = (frames: number) => { const x = el(); if (x) { x.pause(); seek(x.currentTime + frames / 30); } };
  const nextSpeed = () => { const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(s); if (el()) el()!.playbackRate = s; };
  const ctl = "grid size-9 place-items-center rounded-full text-white transition hover:bg-white/15 active:scale-90";

  return (
    <div className="mt-4">
      <div
        ref={box}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
          else if (e.key === "ArrowRight") seek(t + 5);
          else if (e.key === "ArrowLeft") seek(t - 5);
          else if (e.key === ".") step(1);
          else if (e.key === ",") step(-1);
        }}
        aria-label="Video player. Space plays or pauses, arrows skip 5 seconds, comma and period step one frame."
        className="group relative overflow-hidden rounded-2xl border border-line bg-black outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <video
          ref={attach}
          src={mediaUrl(v.path)}
          playsInline
          preload="metadata"
          loop={loop}
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDur(e.currentTarget.duration); }}
          className="max-h-[560px] w-full bg-black"
          style={v.w && v.h ? { aspectRatio: `${v.w} / ${v.h}` } : undefined}
        />
        <AnimatePresence>
          {!playing && (
            <motion.button type="button" onClick={toggle} aria-label="Play" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-2xl transition hover:scale-105">
              <Play className="ml-1 size-7 fill-current" />
            </motion.button>
          )}
        </AnimatePresence>
        {speed !== 1 && <span className="absolute top-3 left-3 rounded-full bg-black/65 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur">{speed}× slow-mo</span>}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pt-8 pb-2 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 sm:opacity-0" style={playing ? undefined : { opacity: 1 }}>
          {/* Scrubber with the poster's markers as ticks. */}
          <div className="relative h-5">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25" />
            <div className="bg-accent-grad absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full" style={{ width: dur ? `${(t / dur) * 100}%` : 0 }} />
            {dur > 0 && marks.map((m) => (
              <span key={`${m.s}${m.t}`} className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: `${(m.s / dur) * 100}%` }} title={`${fmtTime(m.s)} ${m.t}`} />
            ))}
            <input type="range" min={0} max={dur || 0} step={0.01} value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="Seek" className="absolute inset-0 w-full cursor-pointer opacity-0" />
          </div>
          <div className="mt-1 flex items-center gap-1">
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className={ctl}>{playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}</button>
            <button type="button" onClick={() => step(-1)} aria-label="Back one frame" title="Back one frame (,)" className={ctl}><StepBack className="size-4" /></button>
            <button type="button" onClick={() => step(1)} aria-label="Forward one frame" title="Forward one frame (.)" className={ctl}><StepForward className="size-4" /></button>
            <span className="ml-1 font-mono text-[11px] text-white/80 tabular-nums">{fmtTime(t)} / {fmtTime(dur)}</span>
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={nextSpeed} aria-label={`Playback speed ${speed}×`} className="h-8 rounded-full px-2.5 font-mono text-xs text-white transition hover:bg-white/15">{speed}×</button>
              <button type="button" onClick={() => setLoop((l) => !l)} aria-pressed={loop} aria-label="Loop" className={cn(ctl, loop && "bg-white/20")}><Repeat className="size-4" /></button>
              <button type="button" onClick={() => void box.current?.requestFullscreen?.()} aria-label="Full screen" className={ctl}><Maximize className="size-4" /></button>
            </span>
          </div>
        </div>
      </div>
      {marks.length > 0 && (
        <ol className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {marks.map((m) => {
            const here = t >= m.s && t < m.s + 1.5;
            return (
              <li key={`${m.s}${m.t}`} className="shrink-0">
                <button type="button" onClick={() => { seek(m.s); void el()?.play(); }} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition active:scale-95", here ? "border-transparent bg-accent-grad text-on-accent" : "border-line text-text-2 hover:bg-hover")}>
                  <Flag className="size-3.5" /> <span className="font-mono">{fmtTime(m.s)}</span> {m.t}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function Lightbox({ images, index, onClose, onIndex, alt }: { images: MediaItem[]; index: number | null; onClose: () => void; onIndex: (i: number) => void; alt: string }) {
  const [active, setActive] = useState<number | null>(null);
  const go = useCallback((d: number) => { if (index !== null) { setActive(null); onIndex((index + d + images.length) % images.length); } }, [index, images.length, onIndex]);
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [index, go, onClose]);

  const m = index !== null ? images[index] : null;
  return (
    <AnimatePresence>
      {m && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div key={m.path} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-[min(92vw,1200px)]" onClick={(e) => e.stopPropagation()}>
            <PhotoBox m={m} alt={m.alt || alt} sizes="92vw" maxH="78dvh" active={active} onPin={(i) => setActive(active === i ? null : i)} className="rounded-xl" />
            <div className="mx-auto flex max-w-3xl justify-center"><Legend m={m} active={active} onActive={setActive} dark /></div>
          </motion.div>
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="size-5" /></button>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo" className="absolute top-1/2 left-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="size-5" /></button>
              <button onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo" className="absolute top-1/2 right-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="size-5" /></button>
              <span className="absolute bottom-5 font-mono text-xs text-white/70">{(index ?? 0) + 1} / {images.length}</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
