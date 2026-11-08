"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/forge";
import { mediaUrl, type MediaItem } from "@/lib/media";

// Photos or a video on a post. One photo keeps its shape (within limits); 2–4 photos tile.
// Tapping a photo opens it full screen, with arrow keys and Escape.
export function MediaGrid({ media, alt }: { media: MediaItem[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;

  if (media[0].type === "video") {
    const v = media[0];
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-bg">
        <video
          src={mediaUrl(v.path)}
          controls
          playsInline
          preload="metadata"
          className="max-h-[560px] w-full bg-black"
          style={v.w && v.h ? { aspectRatio: `${v.w} / ${v.h}` } : undefined}
        />
      </div>
    );
  }

  const images = media.filter((m) => m.type === "image");
  const n = images.length;
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
            aria-label={`Open photo ${i + 1} of ${n}`}
            className={cn("group relative block overflow-hidden bg-raised", n === 3 && i === 0 && "row-span-2")}
            style={{ aspectRatio: n === 1 ? ratio(m) : n === 3 && i === 0 ? undefined : "1 / 1" }}
          >
            <Image
              src={mediaUrl(m.path)}
              alt={n === 1 ? alt : `${alt} (photo ${i + 1} of ${n})`}
              fill
              sizes={n === 1 ? "(min-width: 768px) 640px, 100vw" : "(min-width: 768px) 320px, 50vw"}
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>
      <Lightbox images={images} index={open} onClose={() => setOpen(null)} onIndex={setOpen} alt={alt} />
    </>
  );
}

function Lightbox({ images, index, onClose, onIndex, alt }: { images: MediaItem[]; index: number | null; onClose: () => void; onIndex: (i: number) => void; alt: string }) {
  const go = useCallback((d: number) => { if (index !== null) onIndex((index + d + images.length) % images.length); }, [index, images.length, onIndex]);
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
          className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div key={m.path} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative h-[85dvh] w-[92vw]" onClick={(e) => e.stopPropagation()}>
            <Image src={mediaUrl(m.path)} alt={alt} fill sizes="92vw" className="object-contain" priority />
          </motion.div>
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="size-5" /></button>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo" className="absolute left-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="size-5" /></button>
              <button onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo" className="absolute right-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="size-5" /></button>
              <span className="absolute bottom-5 font-mono text-xs text-white/70">{(index ?? 0) + 1} / {images.length}</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
