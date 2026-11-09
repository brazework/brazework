"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, ChevronsLeftRight, Crosshair, Flag, Gauge, Maximize, Minimize, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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

// Sound is on by default and the choice is shared by every video (and remembered). Browsers only
// allow sound without a tap in some cases (Chrome after you've clicked on the site; iPhone after
// you've tapped that video), so a refused play falls back to muted with "Tap for sound".
const SOUND_KEY = "forge-video-sound";
const SOUND_EVENT = "forge-video-sound";
const PLAYING_EVENT = "forge-video-playing";
const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } };
const setSoundOn = (on: boolean) => { try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch {} window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: on })); };

// The video player: it shows its first frame (not a black box), plays muted when it's mostly on
// screen and pauses when you scroll past. Tap to pause or play. While playing only the scrubber
// shows; pausing brings up speed (slow-mo for test runs) and full screen. Keys while focused:
// space/k play, ←/→ 5 s, , and . one frame, f full screen.
function TestRunPlayer({ v }: { v: MediaItem }) {
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(true);
  const [blocked, setBlocked] = useState(false); // the browser refused sound; we're playing muted
  const id = useRef(useId());
  const [flash, setFlash] = useState<{ n: number; play: boolean } | null>(null);
  // Speed and full screen show when *you* paused it, not on a video that just hasn't played yet.
  const [held, setHeld] = useState(false);
  const [full, setFull] = useState(false);
  const portrait = !!(v.w && v.h && v.h > v.w);
  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  // Plays (muted, as browsers require for autoplay) when 60% is on screen; pauses when it leaves.
  // A video you paused yourself stays paused. (iOS Low Power Mode blocks autoplay; tap still plays.)
  // Try with sound (your setting); if the browser says no, play muted and offer "Tap for sound".
  const start = useCallback((node: HTMLVideoElement) => {
    node.muted = !soundOn();
    setMuted(node.muted);
    node.play().catch(() => {
      if (node.muted) return; // not even muted autoplay (iOS Low Power Mode): the tap still plays
      node.muted = true; setMuted(true); setBlocked(true);
      void node.play().catch(() => {});
    });
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(([en]) => {
      if (en.intersectionRatio >= 0.6) { if (!userPaused.current && node.paused) start(node); }
      else if (!node.paused) node.pause();
    }, { threshold: [0, 0.6] });
    io.observe(node);
    // One video at a time: another one starting pauses this one.
    const onOther = (e: Event) => { if ((e as CustomEvent<string>).detail !== id.current && !node.paused) node.pause(); };
    // Muting or unmuting any video applies to all of them.
    const onSound = (e: Event) => { const on = (e as CustomEvent<boolean>).detail; node.muted = !on; setMuted(!on); if (on) setBlocked(false); };
    window.addEventListener(PLAYING_EVENT, onOther);
    window.addEventListener(SOUND_EVENT, onSound);
    return () => { io.disconnect(); window.removeEventListener(PLAYING_EVENT, onOther); window.removeEventListener(SOUND_EVENT, onSound); };
  }, [start]);
  const toggleFull = () => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    const b = box.current, x = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (b?.requestFullscreen) void b.requestFullscreen().catch(() => x?.webkitEnterFullscreen?.());
    else x?.webkitEnterFullscreen?.(); // iPhone Safari: only the video itself can go full screen
  };
  // The video is server-rendered, so its metadata can load before React attaches onLoadedMetadata.
  const attach = useCallback((node: HTMLVideoElement | null) => {
    ref.current = node;
    if (node && node.readyState >= 1 && Number.isFinite(node.duration)) setDur(node.duration);
  }, []);
  const marks = (v.marks ?? []).filter((m) => !dur || m.s <= dur);
  const el = () => ref.current;
  const toggle = () => {
    const x = el(); if (!x) return;
    const play = x.paused;
    userPaused.current = !play;
    setHeld(!play);
    // A tap is a user gesture, so the browser allows sound now if you want it.
    if (play) { if (soundOn()) { x.muted = false; setMuted(false); setBlocked(false); } void x.play(); } else x.pause();
    setFlash((f) => ({ n: (f?.n ?? 0) + 1, play }));
  };
  const seek = (s: number) => { const x = el(); if (x) { x.currentTime = Math.max(0, Math.min(dur || s, s)); setT(x.currentTime); } };
  const step = (frames: number) => { const x = el(); if (x) { x.pause(); userPaused.current = true; setHeld(true); seek(x.currentTime + frames / 30); } };
  const nextSpeed = () => { const sp = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(sp); if (el()) el()!.playbackRate = sp; };
  const chip = "inline-flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3 text-xs font-medium text-white backdrop-blur transition active:scale-95";

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
          else if (e.key === "f") toggleFull();
        }}
        aria-label="Video. Tap to play or pause. Keys: space plays or pauses, arrows skip 5 seconds, comma and period step one frame, f for full screen."
        className={cn("relative overflow-hidden bg-black outline-none", full ? "flex h-dvh w-screen items-center justify-center" : "rounded-2xl border border-line focus-visible:ring-2 focus-visible:ring-accent")}
      >
        <video
          ref={attach}
          // #t=0.1: iPhone Safari shows that frame as the cover instead of a black box.
          src={`${mediaUrl(v.path)}#t=0.1`}
          playsInline
          muted
          loop
          preload="metadata"
          onClick={toggle}
          onPlay={() => { setPlaying(true); window.dispatchEvent(new CustomEvent(PLAYING_EVENT, { detail: id.current })); }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDur(e.currentTarget.duration); }}
          className={full ? "h-full w-full bg-black object-contain" : cn("mx-auto block bg-black", portrait ? "max-h-[70svh] w-auto max-w-full" : "max-h-[560px] w-full")}
          style={!full && v.w && v.h ? { aspectRatio: `${v.w} / ${v.h}` } : undefined}
        />
        {/* A quick play/pause pulse where you tapped. */}
        <AnimatePresence>
          {flash && (
            <motion.span key={flash.n} initial={{ opacity: 0.9, scale: 0.8 }} animate={{ opacity: 0, scale: 1.3 }} transition={{ duration: 0.6 }} className="pointer-events-none absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white" aria-hidden="true">
              {flash.play ? <Play className="ml-1 size-7 fill-current" /> : <Pause className="size-7 fill-current" />}
            </motion.span>
          )}
        </AnimatePresence>
        {!playing && !flash && <span className="pointer-events-none absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-2xl" aria-hidden="true"><Play className="ml-1 size-7 fill-current" /></span>}
        {/* Sound: always reachable, small. */}
        <button type="button" onClick={() => { const on = muted; const x = el(); if (x) { x.muted = !on; if (on && x.paused && !userPaused.current) void x.play(); } setMuted(!on); setBlocked(false); setSoundOn(on); }} aria-label={muted ? "Turn sound on" : "Mute"} className={cn("absolute right-3 bottom-4 z-10 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/55 text-white backdrop-blur transition active:scale-90", blocked && muted ? "px-3 text-xs font-medium" : "w-8 justify-center")}>
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}{blocked && muted && " Tap for sound"}
        </button>
        {/* Paused: speed and full screen. */}
        <AnimatePresence>
          {!playing && held && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-3 top-3 z-10 flex items-center gap-2">
              <button type="button" onClick={nextSpeed} aria-label={`Playback speed ${speed}×`} className={chip}><Gauge className="size-3.5" /> {speed}×{speed < 1 ? " slow-mo" : ""}</button>
              <span className="font-mono text-[11px] text-white/80 tabular-nums">{fmtTime(t)} / {fmtTime(dur)}</span>
              <button type="button" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"} className={cn(chip, "ml-auto px-2.5")}>{full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}</button>
            </motion.div>
          )}
        </AnimatePresence>
        {full && playing && <button type="button" onClick={toggleFull} aria-label="Close full screen" className="absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur"><X className="size-5" /></button>}
        {speed !== 1 && playing && <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur">{speed}×</span>}
        {/* The scrubber, with the poster's markers as ticks. */}
        <div className="absolute inset-x-0 bottom-0 h-3">
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25" />
          <div className="bg-accent-grad absolute bottom-0 left-0 h-[3px]" style={{ width: dur ? `${(t / dur) * 100}%` : 0 }} />
          {dur > 0 && marks.map((m) => <span key={`${m.s}${m.t}`} className="absolute bottom-0 h-2 w-1 -translate-x-1/2 rounded-full bg-white" style={{ left: `${(m.s / dur) * 100}%` }} title={`${fmtTime(m.s)} ${m.t}`} />)}
          <input type="range" min={0} max={dur || 0} step={0.01} value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="Seek" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </div>
      </div>
      {marks.length > 0 && (
        <ol className="no-scrollbar mt-3 flex flex-wrap gap-1.5">
          {marks.map((m) => {
            const here = t >= m.s && t < m.s + 1.5;
            return (
              <li key={`${m.s}${m.t}`} className="shrink-0">
                <button type="button" onClick={() => { seek(m.s); userPaused.current = false; setHeld(false); void el()?.play(); }} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition active:scale-95", here ? "border-transparent bg-accent-grad text-on-accent" : "border-line text-text-2 hover:bg-hover")}>
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
