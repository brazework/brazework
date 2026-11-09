"use client";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { mediaUrl } from "@/lib/media";
import { UploadError, removeUploaded, uploadMedia } from "@/lib/upload";
import { setCommunityCover } from "../../../communities/actions";

export function ClubCoverUpload({ cid, path, userId }: { cid: string; path?: string; userId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File) => {
    setMsg("");
    setBusy(true);
    try {
      const item = await uploadMedia(file, userId, { maxSide: 2400 });
      if (item.type !== "image") { await removeUploaded(item.path); throw new UploadError("Covers have to be photos."); }
      start(async () => { const r = await setCommunityCover(cid, item.path); setMsg(r.message); if (!r.ok) await removeUploaded(item.path); setBusy(false); });
    } catch (e) {
      setMsg(e instanceof UploadError ? e.message : "Upload failed.");
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-text-2">Cover photo</div>
      <div className="relative h-32 overflow-hidden rounded-2xl border border-line">
        {path ? <Image src={mediaUrl(path)} alt="" fill sizes="640px" className="object-cover" /> : <div className="bg-accent-grad absolute inset-0 opacity-80" />}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {path ? "Change cover" : "Add a cover"}</Button>
        {path && <Button type="button" variant="ghost" disabled={busy} onClick={() => start(async () => setMsg((await setCommunityCover(cid, "")).message))}><Trash2 className="size-4" /> Remove</Button>}
        {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
      </div>
      <p className="text-xs text-faint">A wide photo works best: your club at work, a build, a team shot.</p>
    </div>
  );
}
