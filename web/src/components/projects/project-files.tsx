"use client";
import { Box, Download, FileArchive, FileCode2, FileImage, FileSpreadsheet, FileText, FileVideo, FolderOpen, GitBranch, Link2, Presentation, Ruler, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ModelViewer } from "@/components/projects/model-viewer";
import { cn, timeAgo } from "@/lib/forge";
import { extOf, githubRepo, kindOfFile, sizeLabel, type FileKind } from "@/lib/project-file-types";
import { projectFileLink, removeProjectFile } from "@/lib/project-files";

export type ProjectFileItem = { id: number; kind: "file" | "link"; name: string; size: number | null; url: string | null; added_by: string; created_at: string; post_id?: string | null; src?: string | null };

const ICONS: Record<FileKind, typeof FileText> = { image: FileImage, video: FileVideo, model: Box, pdf: FileText, doc: FileText, sheet: FileSpreadsheet, slides: Presentation, cad: Ruler, code: FileCode2, archive: FileArchive, text: FileText };

// Files and links attached to a project's updates. Shown two ways: under each update (just that
// update's attachments), and as the project's Files (everything, newest first). 3D models open in
// a viewer you can rotate. Adding happens in "Post an update"; here you open, download or remove.
export function ProjectFiles({ projectId, items, me, ownerId, variant = "folder" }: { projectId: string; items: ProjectFileItem[]; me: string; ownerId: string; variant?: "folder" | "update" }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const models = items.filter((i) => i.kind === "file" && kindOfFile(i.name) === "model");
  // Under an update its model opens straight away; in Files you pick one (one viewer at a time).
  const [shown, setShown] = useState<number | null>(variant === "update" ? models[0]?.id ?? null : null);
  const featured = models.find((m) => m.id === shown);
  const media = items.filter((i) => i.kind === "file" && (kindOfFile(i.name) === "image" || kindOfFile(i.name) === "video"));
  const docs = items.filter((i) => i.kind === "file" && !["model", "image", "video"].includes(kindOfFile(i.name) ?? ""));
  const links = items.filter((i) => i.kind === "link");
  if (!items.length) return null;

  const open = async (it: ProjectFileItem, download = false) => {
    if (it.src && !download) { window.open(it.src, "_blank", "noopener,noreferrer"); return; }
    const r = await projectFileLink(projectId, it.id, download);
    if (!r.ok || !r.url) { setNote(r.message ?? "That file couldn't be opened."); return; }
    if (download) { const a = document.createElement("a"); a.href = r.url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
    else window.open(r.url, "_blank", "noopener,noreferrer");
  };
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
          {featured?.src && <ModelViewer key={featured.id} url={featured.src} name={featured.name} />}
          <div className={cn("flex flex-wrap items-center gap-1.5", featured && "mt-2")}>
            {models.map((m) => (
              <span key={m.id} className={cn("inline-flex items-center gap-1 rounded-full border pr-1 pl-3 text-xs", m.id === featured?.id ? "border-text bg-hover" : "border-line")}>
                <button type="button" onClick={() => setShown(m.id === shown ? null : m.id)} aria-pressed={m.id === featured?.id} title={m.id === shown ? "Close the 3D view" : "View in 3D"} className="inline-flex h-7 items-center gap-1.5"><Box className="size-3.5" /> <span className="max-w-48 truncate">{m.name}</span></button>
                <button type="button" onClick={() => open(m, true)} aria-label={`Download ${m.name}`} title="Download" className="grid size-6 place-items-center rounded-full text-faint hover:text-text"><Download className="size-3.5" /></button>
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
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link from a private bucket
                <button type="button" onClick={() => open(m)} className="size-full"><img src={m.src} alt={m.name} loading="lazy" className="size-full object-cover" /></button>
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
            return (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2"><Icon className="size-4 text-muted" /></span>
                <button type="button" onClick={() => open(d, !["pdf", "text"].includes(kindOfFile(d.name) ?? ""))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium hover:underline">{d.name}</span>
                  <span className="block truncate text-xs text-muted">{[extOf(d.name).toUpperCase(), sizeLabel(d.size), variant === "folder" ? timeAgo(d.created_at) : ""].filter(Boolean).join(" · ")}</span>
                </button>
                <button type="button" onClick={() => open(d, true)} aria-label={`Download ${d.name}`} title="Download" className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text"><Download className="size-4" /></button>
                <RemoveBtn it={d} />
              </li>
            );
          })}
        </ul>
      )}
      {note && <p role="alert" className="mt-2 text-xs text-danger">{note}</p>}
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
