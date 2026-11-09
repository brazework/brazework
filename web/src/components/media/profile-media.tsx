"use client";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/forge";
import { mediaUrl } from "@/lib/media";
import { setProfileMedia } from "@/lib/projects";
import { UploadError, removeUploaded, uploadMedia } from "@/lib/upload";

// A cover banner, editable on your own profile.
export function CoverBanner({ path, editable, userId }: { path?: string; editable: boolean; userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const item = await uploadMedia(file, userId, { maxSide: 2400 });
      if (item.type !== "image") { await removeUploaded(item.path); throw new UploadError("Covers have to be photos."); }
      start(async () => { const r = await setProfileMedia("cover", item.path); if (!r.ok) { setError(r.message); await removeUploaded(item.path); } setBusy(false); });
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "Upload failed.");
      setBusy(false);
    }
  };
  return (
    <div className="group relative h-40 overflow-hidden border-b border-line sm:h-56">
      {path ? <Image src={mediaUrl(path)} alt="" fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" priority /> : <div className="bg-accent-grad absolute inset-0 opacity-80" />}
      {editable && (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
          <div className="absolute right-3 bottom-3 flex gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-bg/80 px-3 text-xs font-medium text-text backdrop-blur hover:bg-bg">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {path ? "Change cover" : "Add a cover"}
            </button>
            {path && !busy && (
              <button type="button" aria-label="Remove cover" onClick={() => start(async () => { await setProfileMedia("cover", ""); })} className="grid size-9 place-items-center rounded-full bg-bg/80 text-text backdrop-blur hover:bg-bg"><Trash2 className="size-4" /></button>
            )}
          </div>
          {error && <p role="alert" className="absolute bottom-3 left-3 rounded-full bg-bg/90 px-3 py-1 text-xs text-danger">{error}</p>}
        </>
      )}
    </div>
  );
}

// The profile photo, with a camera button on your own profile.
export function ProfilePhoto({ path, first, last, editable, userId, size = 84 }: { path?: string; first: string; last: string; editable: boolean; userId: string; size?: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const item = await uploadMedia(file, userId, { maxSide: 640 });
      if (item.type !== "image") { await removeUploaded(item.path); throw new UploadError("Profile photos have to be photos."); }
      start(async () => { const r = await setProfileMedia("avatar", item.path); if (!r.ok) { setError(r.message); await removeUploaded(item.path); } setBusy(false); });
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "Upload failed.");
      setBusy(false);
    }
  };
  return (
    <div className="relative">
      <Avatar first={first} last={last} size={size} src={path ? mediaUrl(path) : null} className="border-4 border-surface text-3xl" />
      {editable && (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
          <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={path ? "Change profile photo" : "Add a profile photo"} className={cn("absolute right-0 bottom-0 grid size-9 place-items-center rounded-full border-2 border-surface bg-accent-grad text-on-accent shadow-lg transition hover:scale-110 active:scale-95")}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </button>
          {error && <p role="alert" className="absolute top-full left-0 mt-2 w-56 text-xs text-danger">{error}</p>}
        </>
      )}
    </div>
  );
}
