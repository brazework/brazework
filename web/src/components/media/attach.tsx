"use client";
import { AnimatePresence, motion } from "motion/react";
import { Columns2, Crosshair, Flag, ImagePlus, Loader2, Play, Video, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { CalloutEditor, MarkerEditor } from "./annotate";
import { cn } from "@/lib/forge";
import { MAX_IMAGES, mediaUrl, type MediaItem } from "@/lib/media";
import { UploadError, kindOf, removeUploaded, uploadMedia } from "@/lib/upload";

type Slot = { id: string; status: "uploading" | "done"; item?: MediaItem; preview: string; kind: "image" | "video" };

// Photo/video attachments for a composer: up to 4 photos or 1 video, uploaded as soon as they're
// picked so posting is instant. `media` is what goes into the post; `busy` blocks posting meanwhile.
export function useAttachments(ownerId: string) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState("");
  const media = slots.filter((s) => s.status === "done" && s.item).map((s) => s.item!) as MediaItem[];
  const busy = slots.some((s) => s.status === "uploading");

  const add = async (files: FileList | File[]) => {
    setError("");
    const picked = [...files];
    const hasVideo = slots.some((s) => s.kind === "video") || picked.some((f) => kindOf(f) === "video");
    if (hasVideo && slots.length + picked.length > 1) return setError("A post can have one video, or up to 4 photos.");
    if (slots.length + picked.length > MAX_IMAGES) return setError(`Up to ${MAX_IMAGES} photos per post.`);
    for (const file of picked) {
      const kind = kindOf(file);
      if (!kind) { setError("Use a JPEG, PNG, WebP or GIF photo, or an MP4, WebM or MOV video."); continue; }
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setSlots((s) => [...s, { id, status: "uploading", preview, kind }]);
      try {
        const item = await uploadMedia(file, ownerId);
        setSlots((s) => s.map((x) => (x.id === id ? { ...x, status: "done", item } : x)));
      } catch (e) {
        setSlots((s) => s.filter((x) => x.id !== id));
        setError(e instanceof UploadError ? e.message : "Upload failed. Check your connection and try again.");
      }
    }
  };

  const remove = (id: string) => {
    setSlots((s) => {
      const slot = s.find((x) => x.id === id);
      if (slot?.item) void removeUploaded(slot.item.path);
      return s.filter((x) => x.id !== id);
    });
  };

  // Callouts, alt text and timeline markers live on the uploaded item.
  const edit = (id: string, patch: Partial<MediaItem>) => setSlots((s) => s.map((x) => (x.id === id && x.item ? { ...x, item: { ...x.item, ...patch } } : x)));
  // Before/after: both photos of a 2-photo post carry cmp.
  const compare = slots.length === 2 && slots.every((s) => s.kind === "image" && s.item?.cmp);
  const setCompare = (on: boolean) => setSlots((s) => s.map((x) => (x.item ? { ...x, item: { ...x.item, cmp: on || undefined } } : x)));
  const clear = () => setSlots([]);
  // If a before/after pair loses a photo, the one left drops the flag (the database needs both).
  return { slots, media: media.map((m) => (compare ? m : { ...m, cmp: undefined })), busy, error, add, remove, clear, edit, compare, setCompare, full: slots.length >= MAX_IMAGES || slots.some((s) => s.kind === "video") };
}

export function AttachButtons({ onPick, disabled }: { onPick: (files: FileList) => void; disabled?: boolean }) {
  const photo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const btn = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted transition hover:bg-hover hover:text-text disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
      <input ref={photo} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { if (e.target.files?.length) onPick(e.target.files); e.target.value = ""; }} />
      <input ref={video} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { if (e.target.files?.length) onPick(e.target.files); e.target.value = ""; }} />
      <button type="button" className={btn} disabled={disabled} onClick={() => photo.current?.click()}><ImagePlus className="size-4" /> Photo</button>
      <button type="button" className={btn} disabled={disabled} onClick={() => video.current?.click()}><Video className="size-4" /> Video</button>
    </div>
  );
}

export function AttachmentTray({ slots, onRemove, onEdit, compare, onCompare }: { slots: Slot[]; onRemove: (id: string) => void; onEdit?: (id: string, patch: Partial<MediaItem>) => void; compare?: boolean; onCompare?: (on: boolean) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  if (!slots.length) return null;
  const open = slots.find((s) => s.id === editing && s.item);
  const pair = slots.length === 2 && slots.every((s) => s.kind === "image");
  return (
    <>
    {pair && onCompare && (
      <button type="button" role="switch" aria-checked={!!compare} disabled={slots.some((s) => s.status !== "done")} onClick={() => onCompare(!compare)} className={cn("mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 disabled:opacity-50", compare ? "border-transparent bg-accent-grad text-on-accent" : "border-line text-muted hover:text-text")}>
        <Columns2 className="size-4" /> Before / after {compare ? "on" : "off"}
      </button>
    )}
    <div className={cn("mt-4 grid gap-2", slots.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4")}>
      <AnimatePresence initial={false}>
      {slots.map((s) => (
        <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className={cn("group relative overflow-hidden rounded-2xl border border-line bg-raised", slots.length === 1 ? "aspect-video max-h-80" : "aspect-square")}>
          {s.kind === "image" ? (
            s.item ? (
              <Image src={mediaUrl(s.item.path)} alt="" fill sizes="(min-width: 640px) 600px, 100vw" className="object-cover" />
            ) : (
              // A local blob: preview while uploading; next/image can't optimise those.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.preview} alt="" className="size-full object-cover" />
            )
          ) : (
            <>
              <video src={s.preview} muted playsInline className="size-full object-cover" />
              <span className="absolute inset-0 grid place-items-center"><span className="grid size-12 place-items-center rounded-full bg-black/50 text-white backdrop-blur"><Play className="ml-0.5 size-5" /></span></span>
            </>
          )}
          {s.status === "uploading" && <span className="absolute inset-0 grid place-items-center bg-bg/50 backdrop-blur-[2px]"><span className="flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium shadow"><Loader2 className="size-4 animate-spin" /> Uploading</span></span>}
          <button type="button" onClick={() => onRemove(s.id)} aria-label="Remove attachment" className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:scale-110 hover:bg-black/80">
            <X className="size-3.5" />
          </button>
          {compare && <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur">{slots.indexOf(s) === 0 ? "Before" : "After"}</span>}
          {s.kind === "image" && s.item?.notes?.map((n, i) => (
            <span key={i} className="absolute grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-black/70 text-[10px] font-bold text-white" style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}>{i + 1}</span>
          ))}
          {onEdit && s.status === "done" && (
            <button type="button" onClick={() => setEditing(s.id)} className="absolute right-2 bottom-2 inline-flex h-7 items-center gap-1 rounded-full bg-black/65 px-2.5 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black/85 active:scale-95">
              {s.kind === "image" ? <><Crosshair className="size-3.5" /> {s.item?.notes?.length ? `${s.item.notes.length} callout${s.item.notes.length > 1 ? "s" : ""}` : "Callouts"}{s.item?.alt ? " · alt" : ""}</> : <><Flag className="size-3.5" /> {s.item?.marks?.length ? `${s.item.marks.length} marker${s.item.marks.length > 1 ? "s" : ""}` : "Markers"}</>}
            </button>
          )}
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
    {open && onEdit && (open.kind === "image"
      ? <CalloutEditor src={open.preview} item={open.item!} onSave={(patch) => onEdit(open.id, patch)} onClose={() => setEditing(null)} />
      : <MarkerEditor src={open.preview} item={open.item!} onSave={(patch) => onEdit(open.id, patch)} onClose={() => setEditing(null)} />)}
    </>
  );
}
