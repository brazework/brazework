"use client";
import { Camera, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UploadError, removeUploaded, uploadMedia } from "@/lib/upload";
import { setCommunityLogo } from "../actions";

// On the club page, for the officers who can edit the club (owners and admins): a camera button on the
// club's badge that uploads a new club picture right there. The same picture shows on cards and in the
// club's chats; Manage → Settings → Club look can change or remove it too.
export function ClubPictureButton({ cid, userId, has }: { cid: string; userId: string; has: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const item = await uploadMedia(file, userId, { maxSide: 512 });
      if (item.type !== "image") { await removeUploaded(item.path); throw new UploadError("The club picture has to be an image."); }
      const r = await setCommunityLogo(cid, item.path);
      if (!r.ok) { await removeUploaded(item.path); setError(r.message); } else router.refresh();
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };
  const label = has ? "Change club picture" : "Add a club picture";
  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={label} title={label}
        className="absolute -right-1.5 -bottom-1.5 z-20 grid size-8 place-items-center rounded-full border-2 border-surface bg-text text-surface shadow-[var(--shadow)] transition hover:scale-105 disabled:opacity-60">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
      </button>
      {error && <p role="alert" className="absolute top-full left-0 z-20 mt-2 w-56 rounded-lg bg-surface px-2 py-1 text-xs text-danger shadow-[var(--shadow)]">{error}</p>}
    </>
  );
}
