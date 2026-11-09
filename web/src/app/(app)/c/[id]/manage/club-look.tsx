"use client";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { ACCENTS, accentTint } from "@/lib/club-look";
import { cn } from "@/lib/forge";
import { UploadError, removeUploaded, uploadMedia } from "@/lib/upload";
import { CommunityBadge } from "../../../communities/_components/badge";
import { saveCommunityLook, setCommunityLogo } from "../../../communities/actions";

// How the club presents itself: logo (its profile picture), tagline, website and accent colour,
// with a live preview of the club's header as members will see it.
export function ClubLook({ cid, name, logo: initialLogo = "", tagline: t0 = "", website: w0 = "", accent: a0 = "", userId }: { cid: string; name: string; logo?: string; tagline?: string; website?: string; accent?: string; userId: string }) {
  const [logo, setLogo] = useState(initialLogo);
  const [tagline, setTagline] = useState(t0);
  const [website, setWebsite] = useState(w0);
  const [accent, setAccent] = useState(a0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File) => {
    setMsg(null);
    setBusy(true);
    try {
      const item = await uploadMedia(file, userId, { maxSide: 512 });
      if (item.type !== "image") { await removeUploaded(item.path); throw new UploadError("Logos have to be images."); }
      const r = await setCommunityLogo(cid, item.path);
      if (r.ok) setLogo(item.path); else await removeUploaded(item.path);
      setMsg({ ok: r.ok, text: r.message });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof UploadError ? e.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  };
  const dirty = tagline !== t0 || website !== w0 || accent !== a0;

  return (
    <div className="flex flex-col gap-5">
      {/* Live preview of the club's header. */}
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="cover-empty relative h-20" style={{ backgroundImage: accentTint(accent) }} />
        <div className="flex items-end gap-3 px-4 pb-4">
          <CommunityBadge id={cid} name={name} size={64} logo={logo || undefined} accent={accent} className="relative z-10 -mt-8 border-4 border-surface" />
          <div className="min-w-0 pb-1"><div className="truncate font-semibold">{name}</div>{tagline && <div className="truncate text-sm text-muted">{tagline}</div>}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {logo ? "Change logo" : "Add a logo"}</Button>
        {logo && <Button type="button" variant="ghost" disabled={busy || pending} onClick={() => start(async () => { const r = await setCommunityLogo(cid, ""); if (r.ok) setLogo(""); setMsg({ ok: r.ok, text: r.message }); })}><Trash2 className="size-4" /> Remove</Button>}
        <span className="text-xs text-faint">Square images look best. It shows on the club page, cards and chats.</span>
      </div>

      <Field label="Tagline" optional count={tagline.length} max={120} hint="One line under the club's name, e.g. what you build and when you meet.">
        <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} placeholder="We design, build and fly student rockets" className={inputCls} />
      </Field>
      <Field label="Website" optional hint="Your club's site, GitHub or sign-up form.">
        <input value={website} onChange={(e) => setWebsite(e.target.value)} type="url" maxLength={300} placeholder="https://" aria-invalid={!!website && !/^https?:\/\/\S+$/i.test(website)} className={inputCls} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-2">Accent colour</legend>
        <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button key={a.id || "default"} type="button" role="radio" aria-checked={accent === a.id} aria-label={a.label} title={a.label} onClick={() => setAccent(a.id)} className={cn("grid size-9 place-items-center rounded-full border border-line ring-offset-2 ring-offset-surface transition", accent === a.id ? "ring-2 ring-text" : "hover:scale-110")} style={{ background: a.id ? a.swatch : "repeating-linear-gradient(45deg, var(--surface-2) 0 4px, var(--border-strong) 4px 6px)" }}>
              {accent === a.id && <Check className={cn("size-4", a.id ? "text-white" : "text-text")} />}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={pending || !dirty} onClick={() => start(async () => { const r = await saveCommunityLook(cid, { tagline, website, accent }); setMsg({ ok: r.ok, text: r.message }); })}>{pending && <Loader2 className="size-4 animate-spin" />} Save look</Button>
        {msg && <span role={msg.ok ? "status" : "alert"} className={cn("text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</span>}
      </div>
    </div>
  );
}
