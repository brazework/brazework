"use client";
import { Box, Download, FileArchive, FileCode2, FileImage, FileSpreadsheet, FileText, FileVideo, FolderOpen, GitBranch, Link2, Presentation, Ruler, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ModelViewer } from "@/components/projects/model-viewer";
import { DocViewer } from "@/components/projects/doc-viewer";
import { viewableKind, viewUrl } from "@/lib/file-view";
import { PhotoViewer } from "@/components/media/photo-viewer";
import { cn, timeAgo } from "@/lib/forge";
import { extOf, githubRepo, kindOfFile, sizeLabel, type FileKind } from "@/lib/project-file-types";
import { projectFileLink, removeProjectFile } from "@/lib/project-files";

export type ProjectFileItem = { id: number; kind: "file" | "link"; name: string; size: number | null; url: string | null; added_by: string; created_at: string; post_id?: string | null; src?: string | null };

const ICONS: Record<FileKind, typeof FileText> = { image: FileImage, video: FileVideo, model: Box, pdf: FileText, doc: FileText, sheet: FileSpreadsheet, slides: Presentation, cad: Ruler, code: FileCode2, archive: FileArchive, text: FileText };

// Files and links attached to a project's updates. Shown two ways: under each update (just that
// update's attachments), and as the project's Files (everything, newest first). Adding happens in
// "Post an update"; here you look, and the builders also download or remove.
//
// Someone else's work is for looking at, not taking (supabase/project-files-view-only.sql): a 3D model
// shows in the viewer you can turn, and a PDF or text file opens in a reader on the page. Only the
// project's builders (team: its owner, admins and teammates) or whoever added a file can download it.
export function ProjectFiles({ projectId, items, me, ownerId, team = false, variant = "folder" }: { projectId: string; items: ProjectFileItem[]; me: string; ownerId: string; team?: boolean; variant?: "folder" | "update" }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const models = items.filter((i) => i.kind === "file" && kindOfFile(i.name) === "model");
  // The first model is in the viewer straight away, like the landing page; the rest are a tap away. The
  // viewer only fetches the file once it's near the screen, so a long page doesn't load every model (FIX-75).
  const [shown, setShown] = useState<number | null>(models[0]?.id ?? null);
  const featured = models.find((m) => m.id === shown) ?? models[0];
  const [reading, setReading] = useState<{ id: number; name: string } | null>(null);
  const canDownload = (it: ProjectFileItem) => team || it.added_by === me;
  const media = items.filter((i) => i.kind === "file" && (kindOfFile(i.name) === "image" || kindOfFile(i.name) === "video"));
  const docs = items.filter((i) => i.kind === "file" && !["model", "image", "video"].includes(kindOfFile(i.name) ?? ""));
  const links = items.filter((i) => i.kind === "link");
  // Pictures open in the pop-up viewer (FIX-247), stepping through this list's pictures.
  const pictures = media.filter((m) => m.src && kindOfFile(m.name) === "image");
  const [viewing, setViewing] = useState<number | null>(null);
  if (!items.length) return null;

  // Builders only: a short-lived link to the original (the database refuses anyone else).
  const download = async (it: ProjectFileItem) => {
    const r = await projectFileLink(projectId, it.id, true);
    if (!r.ok || !r.url) { setNote(r.message ?? "That file couldn't be downloaded."); return; }
    const a = document.createElement("a"); a.href = r.url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
  };
  const DownloadBtn = ({ it, className }: { it: ProjectFileItem; className?: string }) => canDownload(it) ? (
    <button type="button" onClick={() => download(it)} aria-label={`Download ${it.name}`} title="Download" className={cn("grid shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text", className)}><Download className="size-3.5" /></button>
  ) : null;
  const remove = async (it: ProjectFileItem) => {
    if (!confirm(`Remove "${it.name}" from this project?`)) return;
    const r = await removeProjectFile(projectId, it.id);
    if (r.ok) router.refresh(); else setNote(r.message);
  };
  const canRemove = (it: ProjectFileItem) => it.added_by === me || ownerId === me;
  const RemoveBtn = ({ it, className }: { it: ProjectFileItem; className?: string }) => canRemove(it) ? (
    <button type="button" onClick={() => remove(it)} aria-label={`Remove ${it.name}`} title="Remove" className={cn("grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-danger", className)}><Trash2 className="size-4" /></button>
  ) : null;

  const body = (
    <>
      {/* 3D models: one in the viewer, the rest one click away. */}
      {models.length > 0 && (
        <div className={variant === "folder" ? "mt-5" : ""}>
          {featured && <div onContextMenu={(e) => e.preventDefault()}><ModelViewer key={featured.id} url={viewUrl(featured.id)} name={featured.name} className="aspect-[5/4] sm:aspect-[16/10]" /></div>}
          <div className={cn("flex flex-wrap items-center gap-1.5", featured && "mt-2")}>
            {models.map((m) => (
              <span key={m.id} className={cn("inline-flex items-center gap-1 rounded-full border pr-1 pl-3 text-xs", m.id === featured?.id ? "border-text bg-hover" : "border-line")}>
                <button type="button" onClick={() => setShown(m.id)} aria-pressed={m.id === featured?.id} title={m.id === featured?.id ? "In the 3D viewer" : "View in 3D"} className="inline-flex h-7 items-center gap-1.5"><Box className="size-3.5" /> <span className="max-w-48 truncate">{m.name}</span></button>
                <DownloadBtn it={m} className="size-6" />
                <RemoveBtn it={m} className="size-6" />
              </span>
            ))}
          </div>
        </div>
      )}

      {media.length > 0 && (
        <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", (variant === "folder" || models.length > 0) && "mt-4")}>
          {media.map((m) => (
            <li key={m.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-2">
              {m.src && kindOfFile(m.name) === "image" ? (
                // A small resized copy through the image optimizer, not the full original (FIX-75).
                <button type="button" onClick={() => setViewing(pictures.findIndex((p) => p.id === m.id))} aria-label={`Open picture ${pictures.findIndex((p) => p.id === m.id) + 1} of ${pictures.length}`} className="relative size-full"><Image src={m.src} alt={m.name} fill sizes="(min-width: 640px) 160px, 33vw" className="object-cover" /></button>
              ) : m.src ? (
                <video src={m.src} controls preload="none" className="size-full bg-black object-cover" aria-label={m.name} />
              ) : (
                <span className="grid size-full place-items-center p-2 text-center text-xs text-muted">{m.name}</span>
              )}
              <RemoveBtn it={m} className="absolute top-1 right-1 bg-black/50 text-white opacity-0 group-hover:opacity-100 focus:opacity-100" />
            </li>
          ))}
        </ul>
      )}

      {(docs.length > 0 || links.length > 0) && (
        <ul className={cn("divide-y divide-line rounded-2xl border border-line", (variant === "folder" || models.length > 0 || media.length > 0) && "mt-4")}>
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
            const readable = !!viewableKind(d.name);
            const meta = [extOf(d.name).toUpperCase(), sizeLabel(d.size), variant === "folder" ? timeAgo(d.created_at) : ""].filter(Boolean).join(" · ");
            const label = (
              <>
                <span className={cn("block truncate text-sm font-medium", (readable || canDownload(d)) && "hover:underline")}>{d.name}</span>
                <span suppressHydrationWarning className="block truncate text-xs text-muted">{readable || canDownload(d) ? meta : `${meta} · No preview for this file type`}</span>
              </>
            );
            return (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2"><Icon className="size-4 text-muted" /></span>
                {/* Read it on the page when it can be shown; a builder downloads the rest. */}
                {readable ? (
                  <button type="button" onClick={() => setReading({ id: d.id, name: d.name })} aria-label={`Read ${d.name}`} className="min-w-0 flex-1 text-left">{label}</button>
                ) : canDownload(d) ? (
                  <button type="button" onClick={() => download(d)} className="min-w-0 flex-1 text-left">{label}</button>
                ) : (
                  <span className="min-w-0 flex-1">{label}</span>
                )}
                <DownloadBtn it={d} className="size-8" />
                <RemoveBtn it={d} />
              </li>
            );
          })}
        </ul>
      )}
      {note && <p role="alert" className="mt-2 text-xs text-danger">{note}</p>}
      <DocViewer file={reading} onClose={() => setReading(null)} />
      <PhotoViewer count={pictures.length} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)}>
        {viewing !== null && pictures[viewing]?.src && (
          <div className="relative mx-auto h-[min(80dvh,900px)] w-full">
            <Image src={pictures[viewing].src!} alt={pictures[viewing].name} fill sizes="92vw" className="object-contain" />
          </div>
        )}
      </PhotoViewer>
    </>
  );

  if (variant === "update") return <div aria-label="Attachments" className="-mt-2 rounded-3xl border border-line bg-surface/50 p-3">{body}</div>;
  return (
    <section aria-labelledby="files-title" className="glass-card rounded-3xl p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="files-title" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><FolderOpen className="size-5 text-muted" /> Files</h2>
        <span className="text-xs text-muted">{items.length} item{items.length === 1 ? "" : "s"}, from the project&apos;s updates</span>
      </div>
      {body}
    </section>
  );
}
