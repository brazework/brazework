"use client";
import { AnimatePresence, motion } from "motion/react";
import { Crosshair, Flag, Play, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { MAX_CALLOUTS, MAX_MARKERS, type Callout, type MediaItem, type Marker } from "@/lib/media";

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="m-auto max-h-[94dvh] w-[min(760px,calc(100vw-24px))] overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

// Numbered pin, shared by the editor and the post view.
export function Pin({ n, x, y, active, onClick, label }: { n: number; x: number; y: number; active?: boolean; onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      aria-label={label ? `Callout ${n}: ${label}` : `Callout ${n}`}
      className={cn("group/pin absolute z-10 -translate-x-1/2 -translate-y-1/2", !onClick && "cursor-default")}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      <span className={cn("absolute inset-0 rounded-full bg-white/70", active ? "animate-ping" : "opacity-0")} />
      <span className={cn("relative grid size-7 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg ring-1 ring-black/30 transition", active ? "scale-125 bg-accent-grad" : "bg-black/70 group-hover/pin:scale-110")}>{n}</span>
      {label && (
        <span className={cn("pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 rounded-lg bg-black/80 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg backdrop-blur transition", active ? "opacity-100" : "opacity-0 group-hover/pin:opacity-100 group-focus-visible/pin:opacity-100")}>{label}</span>
      )}
    </button>
  );
}

// Tap the photo to drop numbered callouts, label each one, and describe the photo.
export function CalloutEditor({ src, item, onSave, onClose }: { src: string; item: MediaItem; onSave: (patch: Pick<MediaItem, "notes" | "alt">) => void; onClose: () => void }) {
  const [notes, setNotes] = useState<Callout[]>(item.notes ?? []);
  const [alt, setAlt] = useState(item.alt ?? "");
  const [focus, setFocus] = useState<number | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const full = notes.length >= MAX_CALLOUTS;
  const ratio = item.w && item.h ? item.w / item.h : 4 / 3;

  const add = (e: React.MouseEvent<HTMLDivElement>) => {
    if (full) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setNotes((cur) => [...cur, { x, y, t: "" }]);
    const i = notes.length;
    setFocus(i);
    requestAnimationFrame(() => inputs.current[i]?.focus());
  };

  return (
    <Sheet title="Callouts" onClose={onClose}>
      <p className="mb-3 flex items-center gap-2 text-sm text-muted"><Crosshair className="size-4" /> Tap the photo to pin a callout ({notes.length}/{MAX_CALLOUTS}), then name what it points at.</p>
      {/* The box has the photo's exact shape, so pin positions match what everyone else sees. */}
      <div
        onClick={add}
        className={cn("relative mx-auto overflow-hidden rounded-2xl bg-raised select-none", full ? "cursor-not-allowed" : "cursor-crosshair")}
        style={{ aspectRatio: ratio, width: `min(100%, ${Math.round(56 * ratio)}vh)` }}
      >
        {/* A local preview or an uploaded file; either way it's shown as-is. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="pointer-events-none size-full object-cover" draggable={false} />
        <AnimatePresence>
          {notes.map((n, i) => (
            <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Pin n={i + 1} x={n.x} y={n.y} active={focus === i} onClick={() => { setFocus(i); inputs.current[i]?.focus(); }} />
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      {notes.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2">
          {notes.map((n, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", focus === i ? "bg-accent-grad text-on-accent" : "bg-raised")}>{i + 1}</span>
              <input
                ref={(el) => { inputs.current[i] = el; }}
                value={n.t}
                maxLength={80}
                onFocus={() => setFocus(i)}
                onChange={(e) => setNotes((cur) => cur.map((c, j) => (j === i ? { ...c, t: e.target.value } : c)))}
                placeholder="What is this? e.g. Strain gauge"
                aria-label={`Callout ${i + 1} label`}
                className={cn(inputCls, "h-10 flex-1")}
              />
              <button type="button" onClick={() => { setNotes((cur) => cur.filter((_, j) => j !== i)); setFocus(null); }} aria-label={`Remove callout ${i + 1}`} className="grid size-9 place-items-center rounded-full text-faint hover:bg-hover hover:text-danger"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ol>
      )}
      <label className="mt-5 block text-sm font-medium" htmlFor="alt-text">Describe the photo <span className="font-normal text-faint">(for screen readers)</span></label>
      <input id="alt-text" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Carbon upright clamped in the load-test rig" className={cn(inputCls, "mt-1.5")} />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={() => { onSave({ notes: notes.filter((n) => n.t.trim()).map((n) => ({ ...n, t: n.t.trim() })), alt: alt.trim() }); onClose(); }}>Save</Button>
      </div>
    </Sheet>
  );
}

// Scrub to a moment, add a marker, name it: "0:03.2 Ignition".
export function MarkerEditor({ src, item, onSave, onClose }: { src: string; item: MediaItem; onSave: (patch: Pick<MediaItem, "marks">) => void; onClose: () => void }) {
  const [marks, setMarks] = useState<Marker[]>(item.marks ?? []);
  const [now, setNow] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const full = marks.length >= MAX_MARKERS;
  const add = () => {
    if (full) return;
    const s = Math.round((video.current?.currentTime ?? 0) * 10) / 10;
    video.current?.pause();
    const next = [...marks, { s, t: "" }].sort((a, b) => a.s - b.s);
    setMarks(next);
    const i = next.findIndex((m) => m.s === s && m.t === "");
    requestAnimationFrame(() => inputs.current[i]?.focus());
  };
  return (
    <Sheet title="Timeline markers" onClose={onClose}>
      <p className="mb-3 flex items-center gap-2 text-sm text-muted"><Flag className="size-4" /> Scrub to a moment and add a marker ({marks.length}/{MAX_MARKERS}). Viewers can jump straight to it.</p>
      <video ref={video} src={src} controls playsInline onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} className="max-h-[48vh] w-full rounded-2xl bg-black" />
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" onClick={add} disabled={full}><Flag className="size-4" /> Add marker at {fmtTime(now)}</Button>
      </div>
      {marks.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2">
          {marks.map((m, i) => (
            <li key={`${m.s}-${i}`} className="flex items-center gap-2">
              <button type="button" onClick={() => { if (video.current) { video.current.currentTime = m.s; void video.current.play(); } }} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 font-mono text-xs transition hover:bg-hover" aria-label={`Play from ${fmtTime(m.s)}`}>
                <Play className="size-3" /> {fmtTime(m.s)}
              </button>
              <input
                ref={(el) => { inputs.current[i] = el; }}
                value={m.t}
                maxLength={60}
                onChange={(e) => setMarks((cur) => cur.map((c, j) => (j === i ? { ...c, t: e.target.value } : c)))}
                placeholder="What happens here? e.g. Ignition"
                aria-label={`Marker at ${fmtTime(m.s)} label`}
                className={cn(inputCls, "h-10 flex-1")}
              />
              <button type="button" onClick={() => setMarks((cur) => cur.filter((_, j) => j !== i))} aria-label={`Remove marker at ${fmtTime(m.s)}`} className="grid size-9 place-items-center rounded-full text-faint hover:bg-hover hover:text-danger"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={() => { onSave({ marks: marks.filter((m) => m.t.trim()).map((m) => ({ ...m, t: m.t.trim() })) }); onClose(); }}>Save</Button>
      </div>
    </Sheet>
  );
}
