"use client";
import { ExternalLink, QrCode as QrIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QrCode } from "@/components/qr-code";
import { linkedinAddUrl, verifyUrl } from "@/lib/verify-public";

// Résumé verify link (supabase/verify-links.sql): the public page for one signed milestone and its QR
// code, to put on a résumé, and LinkedIn's add-to-profile link for it (lib/verify-public.ts). The page is public while the milestone and its project are; it says so if
// the signature is ever revoked.
export function VerifyLinkButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 font-medium text-text-2 hover:text-text">
        <QrIcon className="size-3" /> Verify link
      </button>
      {open && <VerifyLinkDialog id={id} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function VerifyLinkDialog({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const url = verifyUrl(typeof window === "undefined" ? "" : window.location.origin, id);
  const btn = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3.5 text-sm font-medium transition hover:border-line-strong hover:bg-hover";
  const downloadQr = () => {
    const svg = document.querySelector<SVGSVGElement>("#verify-qr svg");
    if (!svg) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    a.download = `brazework-verify-${id}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <dialog ref={ref} aria-label="Verify link for your résumé" onCancel={(e) => { e.preventDefault(); onClose(); }} className="m-auto w-[min(440px,calc(100vw-24px))] rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-black/60">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">Verify link</h2>
            <p className="mt-1 truncate text-sm text-muted">{title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        <p className="text-sm leading-relaxed text-text-2">Put this on your résumé. Anyone can open it, signed in or not, to see what you built, the evidence, who signed it and when. If a signature is ever withdrawn, the page says so. It works while this milestone and its project are public.</p>
        <div id="verify-qr" className="self-center rounded-xl border border-line bg-white p-2"><QrCode value={url} size={168} label={`QR code for ${url}`} /></div>
        <div className="flex gap-2">
          <input readOnly value={url} aria-label="Verify link" onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm" />
          <button type="button" onClick={() => { navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => {}); }} className={btn}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={downloadQr} className={btn}>Download QR</button>
          <a href={`/v/${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer" className={btn}><ExternalLink className="size-4" />Open the page</a>
        </div>
        {/* LinkedIn's add-to-profile form opens filled in; you save it there yourself. */}
        <a href={linkedinAddUrl(typeof window === "undefined" ? "" : window.location.origin, id, title)} target="_blank" rel="noopener noreferrer" className={`${btn} bg-accent text-on-accent hover:bg-accent hover:opacity-90`}>Add to LinkedIn</a>
        <p className="-mt-2 text-xs text-faint">Opens LinkedIn with this milestone and its verify link filled in, under Licenses &amp; certifications. You save it there.</p>
      </div>
    </dialog>
  );
}
