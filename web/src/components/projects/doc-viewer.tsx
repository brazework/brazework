"use client";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PhotoViewer } from "@/components/media/photo-viewer";
import { TEXT_PREVIEW_CHARS, viewableKind, viewUrl, type FileSource } from "@/lib/file-view";

// A document on a project, read in the page (supabase/project-files-view-only.sql). A PDF is drawn page
// by page onto canvases with pdf.js, so the browser's own PDF viewer, with its download and print
// buttons, never appears; text and code show as text. The bytes come from the app's own route
// (/api/project-files/<id>), which streams them only to the page, never as a link to the original.
export function DocViewer({ file, onClose }: { file: { id: number; name: string; source?: FileSource } | null; onClose: () => void }) {
  return (
    <PhotoViewer count={1} index={file ? 0 : null} onIndex={() => {}} onClose={onClose} label="Document viewer" swipe={false}>
      {file && (
        <div data-doc-viewer className="mx-auto flex max-h-[86dvh] w-[min(92vw,900px)] flex-col overflow-hidden rounded-2xl bg-surface text-text" onContextMenu={(e) => e.preventDefault()}>
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-medium"><FileText className="size-4 text-muted" /> <span className="truncate">{file.name}</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-2 p-3 select-none">
            {viewableKind(file.name) === "pdf" ? <PdfPages url={viewUrl(file.id, file.source ?? "project")} name={file.name} /> : <TextPreview url={viewUrl(file.id, file.source ?? "project")} />}
          </div>
        </div>
      )}
    </PhotoViewer>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return <p className="grid min-h-48 place-items-center p-6 text-center text-sm text-muted">{children}</p>;
}

function PdfPages({ url, name }: { url: string; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // The worker runs pdf.js off the main thread; bundled with the app, nothing loads from elsewhere.
        if (!pdfjs.GlobalWorkerOptions.workerPort) pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(String(res.status));
        const data = new Uint8Array(await res.arrayBuffer());
        const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        destroy = () => void doc.destroy();
        if (cancelled) return;
        setPages(doc.numPages);
        const width = Math.min(host.current?.clientWidth ?? 800, 860);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        // Up to 60 pages, one after another, so the first shows straight away.
        for (let n = 1; n <= Math.min(doc.numPages, 60) && !cancelled; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          canvas.style.width = `${Math.floor(vp.width / ratio)}px`;
          canvas.className = "mx-auto mb-3 block max-w-full rounded-md bg-white shadow-sm";
          canvas.setAttribute("aria-label", `${name}, page ${n} of ${doc.numPages}`);
          canvas.setAttribute("role", "img");
          canvas.dataset.page = String(n);
          host.current?.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
          if (n === 1 && !cancelled) setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; destroy?.(); };
  }, [url, name]);
  return (
    <>
      {state === "loading" && <Status><Loader2 className="size-5 animate-spin" /></Status>}
      {state === "error" && <Status>This document couldn&apos;t be shown.</Status>}
      <div ref={host} data-pages={pages || undefined} />
      {pages > 60 && state === "ready" && <p className="pb-2 text-center text-xs text-muted">Showing the first 60 of {pages} pages.</p>}
    </>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(url, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => { if (!cancelled) setText(t.slice(0, TEXT_PREVIEW_CHARS)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);
  if (failed) return <Status>This file couldn&apos;t be shown.</Status>;
  if (text === null) return <Status><Loader2 className="size-5 animate-spin" /></Status>;
  return <pre className="overflow-x-auto rounded-md bg-surface p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-text-2">{text}</pre>;
}
