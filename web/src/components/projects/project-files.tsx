"use client";
import { Box, Download, FileArchive, FileCode2, FileImage, FileSpreadsheet, FileText, FileVideo, FolderOpen, GitBranch, Link2, Loader2, Paperclip, Presentation, Ruler, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModelViewer } from "@/components/projects/model-viewer";
import { cn, timeAgo } from "@/lib/forge";
import { ACCEPT_ATTR, PROJECT_FILE_MAX_BYTES, extOf, githubRepo, kindOfFile, sizeLabel, storedType, type FileKind } from "@/lib/project-file-types";
import { addProjectLink, projectFileLink, recordProjectFile, removeProjectFile } from "@/lib/project-files";
import { getBrowserClient } from "@/lib/supabase/client";

export type ProjectFileItem = { id: number; kind: "file" | "link"; name: string; size: number | null; url: string | null; added_by: string; created_at: string; src?: string | null };
type Job = { key: string; name: string; state: "uploading" | "error"; message?: string };

const ICONS: Record<FileKind, typeof FileText> = { image: FileImage, video: FileVideo, model: Box, pdf: FileText, doc: FileText, sheet: FileSpreadsheet, slides: Presentation, cad: Ruler, code: FileCode2, archive: FileArchive, text: FileText };
const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

// A project's folder: documents, photos, videos, CAD, 3D models and links. The owner and teammates
// add by picking, dropping or pasting (Ctrl/⌘+V anywhere on the page); 3D models open in a viewer
// you can rotate. Files are private to whoever can see the project (supabase/project-files.sql).
export function ProjectFiles({ projectId, items, canAdd, me, ownerId }: { projectId: string; items: ProjectFileItem[]; canAdd: boolean; me: string; ownerId: string }) {
  const router = useRouter();
  const pick = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);
  const [link, setLink] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const models = items.filter((i) => i.kind === "file" && kindOfFile(i.name) === "model");
  const [shown, setShown] = useState<number | null>(models[0]?.id ?? null);
  const featured = models.find((m) => m.id === shown) ?? models[0];
  const media = items.filter((i) => i.kind === "file" && (kindOfFile(i.name) === "image" || kindOfFile(i.name) === "video"));
  const docs = items.filter((i) => i.kind === "file" && !["model", "image", "video"].includes(kindOfFile(i.name) ?? ""));
  const links = items.filter((i) => i.kind === "link");

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setNote(null);
    const sb = getBrowserClient();
    for (const file of files) {
      const key = crypto.randomUUID();
      const name = file.name || `pasted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${file.type.split("/")[1] || "png"}`;
      const fail = (message: string) => setJobs((j) => j.map((x) => (x.key === key ? { ...x, state: "error", message } : x)));
      setJobs((j) => [...j, { key, name, state: "uploading" }]);
      if (!kindOfFile(name)) { fail("That file type isn't supported. Try PDF, Office, images, video, STL/OBJ/GLB/3MF, STEP or ZIP."); continue; }
      if (file.size > PROJECT_FILE_MAX_BYTES) { fail("Files can be up to 50 MB."); continue; }
      const path = `${projectId}/${key}.${extOf(name)}`;
      const { error } = await sb.storage.from("project-files").upload(path, file, { contentType: storedType(name), upsert: false });
      if (error) { fail(error.message || "Upload failed. Try again."); continue; }
      const r = await recordProjectFile(projectId, path, name, file.size);
      if (!r.ok) { fail(r.message); continue; }
      setJobs((j) => j.filter((x) => x.key !== key));
    }
    router.refresh();
  }, [projectId, router]);

  const addLink = useCallback(async (raw: string) => {
    setBusy(true);
    const r = await addProjectLink(projectId, raw);
    setBusy(false);
    setNote({ ok: r.ok, text: r.message });
    if (r.ok) { setLink(""); router.refresh(); }
  }, [projectId, router]);

  // Paste anywhere on the page: files are uploaded; a link (outside a text box) is added.
  useEffect(() => {
    if (!canAdd) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) { e.preventDefault(); void upload(files); return; }
      const text = e.clipboardData?.getData("text/plain")?.trim() ?? "";
      if (!isEditable(e.target) && /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+\/?\S*$/i.test(text)) { e.preventDefault(); void addLink(text); }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [canAdd, upload, addLink]);

  const open = async (it: ProjectFileItem, download = false) => {
    if (it.src && !download) { window.open(it.src, "_blank", "noopener,noreferrer"); return; }
    const r = await projectFileLink(projectId, it.id, download);
    if (r.ok && r.url) {
      if (download) { const a = document.createElement("a"); a.href = r.url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
      else window.open(r.url, "_blank", "noopener,noreferrer");
    }
    else setNote({ ok: false, text: r.message ?? "That file couldn't be opened." });
  };
  const remove = async (it: ProjectFileItem) => {
    if (!confirm(`Remove "${it.name}" from this project?`)) return;
    const r = await removeProjectFile(projectId, it.id);
    setNote({ ok: r.ok, text: r.message });
    if (r.ok) router.refresh();
  };
  const canRemove = (it: ProjectFileItem) => it.added_by === me || ownerId === me;
  const RemoveBtn = ({ it, className }: { it: ProjectFileItem; className?: string }) => canRemove(it) ? (
    <button type="button" onClick={() => remove(it)} aria-label={`Remove ${it.name}`} title="Remove" className={cn("grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-danger", className)}><Trash2 className="size-4" /></button>
  ) : null;

  if (!items.length && !canAdd) return null;
  return (
    <section
      aria-labelledby="files-title"
      className={cn("glass-card rounded-3xl p-6 transition", drag && "ring-2 ring-text")}
      onDragOver={canAdd ? (e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDrag(true); } } : undefined}
      onDragLeave={canAdd ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); } : undefined}
      onDrop={canAdd ? (e) => { e.preventDefault(); setDrag(false); void upload([...e.dataTransfer.files]); } : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="files-title" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><FolderOpen className="size-5 text-muted" /> Files</h2>
        <span className="text-xs text-muted">{items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Docs, CAD, 3D models, code and links"}</span>
      </div>

      {canAdd && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-line-strong p-4 sm:flex-row sm:items-center">
            <Upload className="hidden size-5 shrink-0 text-faint sm:block" />
            <p className="min-w-0 flex-1 text-sm text-muted">Drop files here, paste them (Ctrl/⌘+V), or pick them. Up to 50 MB each. STL, OBJ, GLB and 3MF open in 3D.</p>
            <button type="button" onClick={() => pick.current?.click()} className="bg-accent-grad inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent"><Paperclip className="size-4" /> Add files</button>
            <input ref={pick} type="file" multiple accept={ACCEPT_ATTR} className="hidden" onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (link.trim()) void addLink(link); }} className="flex gap-2">
            <label htmlFor={`link-${projectId}`} className="sr-only">Add a link</label>
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input id={`link-${projectId}`} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link a GitHub repo, Onshape doc, Drive folder…" className="h-9 w-full rounded-full border border-line bg-surface/70 pr-3 pl-9 text-sm outline-none placeholder:text-faint focus:border-text" />
            </div>
            <button type="submit" disabled={busy || !link.trim()} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition hover:bg-hover disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" />} Add link</button>
          </form>
          {jobs.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {jobs.map((j) => (
                <li key={j.key} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                  {j.state === "uploading" ? <Loader2 className="size-4 shrink-0 animate-spin text-muted" /> : <X className="size-4 shrink-0 text-danger" />}
                  <span className="min-w-0 flex-1 truncate">{j.name}</span>
                  {j.state === "error" && <span role="alert" className="text-xs text-danger">{j.message}</span>}
                  {j.state === "error" && <button type="button" onClick={() => setJobs((x) => x.filter((y) => y.key !== j.key))} aria-label="Dismiss" className="text-faint hover:text-text"><X className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
          )}
          {note && <p role={note.ok ? "status" : "alert"} className={cn("text-xs", note.ok ? "text-ok" : "text-danger")}>{note.text}</p>}
        </div>
      )}

      {/* 3D models: one in the viewer, the rest one click away. */}
      {featured?.src && (
        <div className="mt-5">
          <ModelViewer key={featured.id} url={featured.src} name={featured.name} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {models.map((m) => (
              <span key={m.id} className={cn("inline-flex items-center gap-1 rounded-full border pr-1 pl-3 text-xs", m.id === featured.id ? "border-text bg-hover" : "border-line")}>
                <button type="button" onClick={() => setShown(m.id)} aria-pressed={m.id === featured.id} className="inline-flex h-7 items-center gap-1.5"><Box className="size-3.5" /> <span className="max-w-48 truncate">{m.name}</span></button>
                <button type="button" onClick={() => open(m, true)} aria-label={`Download ${m.name}`} title="Download" className="grid size-6 place-items-center rounded-full text-faint hover:text-text"><Download className="size-3.5" /></button>
                <RemoveBtn it={m} className="size-6" />
              </span>
            ))}
          </div>
        </div>
      )}

      {media.length > 0 && (
        <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m) => (
            <li key={m.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-2">
              {m.src && kindOfFile(m.name) === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link from a private bucket
                <button type="button" onClick={() => open(m)} className="size-full"><img src={m.src} alt={m.name} loading="lazy" className="size-full object-cover" /></button>
              ) : m.src ? (
                <video src={m.src} controls preload="none" className="size-full bg-black object-cover" aria-label={m.name} />
              ) : (
                <span className="grid size-full place-items-center text-xs text-muted">{m.name}</span>
              )}
              <RemoveBtn it={m} className="absolute top-1 right-1 bg-black/50 text-white opacity-0 group-hover:opacity-100 focus:opacity-100" />
            </li>
          ))}
        </ul>
      )}

      {(docs.length > 0 || links.length > 0) && (
        <ul className="mt-5 divide-y divide-line rounded-2xl border border-line">
          {links.map((l) => {
            const repo = l.url ? githubRepo(l.url) : null;
            return (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2">{repo ? <GitBranch className="size-4" /> : <Link2 className="size-4 text-muted" />}</span>
                <a href={l.url ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium hover:underline">{l.name}</span>
                  <span className="block truncate text-xs text-muted">{repo ? "GitHub repository" : l.url?.replace(/^https?:\/\//, "")}</span>
                </a>
                <RemoveBtn it={l} />
              </li>
            );
          })}
          {docs.map((d) => {
            const Icon = ICONS[kindOfFile(d.name) ?? "text"];
            return (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2"><Icon className="size-4 text-muted" /></span>
                <button type="button" onClick={() => open(d, !["pdf", "text"].includes(kindOfFile(d.name) ?? ""))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium hover:underline">{d.name}</span>
                  <span className="block truncate text-xs text-muted">{[extOf(d.name).toUpperCase(), sizeLabel(d.size), timeAgo(d.created_at)].filter(Boolean).join(" · ")}</span>
                </button>
                <button type="button" onClick={() => open(d, true)} aria-label={`Download ${d.name}`} title="Download" className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text"><Download className="size-4" /></button>
                <RemoveBtn it={d} />
              </li>
            );
          })}
        </ul>
      )}

      {!items.length && canAdd && <p className="mt-4 text-xs text-faint">Nothing here yet. Add the write-up PDF, the CAD, the code, or link the repo.</p>}
    </section>
  );
}
