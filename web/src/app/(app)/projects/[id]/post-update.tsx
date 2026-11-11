"use client";
import { Box, FileText, Link2, Loader2, Megaphone, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { ACCEPT_ATTR, PROJECT_FILE_MAX_BYTES, cleanUrl, extOf, githubRepo, kindOfFile, sizeLabel, storedType } from "@/lib/project-file-types";
import { addProjectLink, recordProjectFile } from "@/lib/project-files";
import { shareProject } from "@/lib/projects";
import { getBrowserClient } from "@/lib/supabase/client";

type Pending = { key: string; file: File; name: string };

// Post progress on a project: what changed, plus the files that show it (documents, photos, video,
// CAD, 3D models you can rotate, code) and links (a GitHub repo, an Onshape doc), all as one update.
// Attach with the paperclip, by dropping onto the box, or by pasting a file. The update goes to the
// feed as a project post; its files show under it on the project page and in the project's Files.
// Posting keeps you where you are (the project page, or the Projects workbench).
export function PostUpdate({ projectId, title, className, autoFocus = false, attach = false }: { projectId: string; title: string; className?: string; autoFocus?: boolean; attach?: boolean }) {
  const router = useRouter();
  const pick = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [step, setStep] = useState("");
  const id = `pu-${projectId}`;
  const busy = step !== "";

  const add = (list: File[]) => {
    const ok: Pending[] = [];
    for (const file of list) {
      const name = file.name || `pasted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${file.type.split("/")[1] || "png"}`;
      if (!kindOfFile(name)) { setMsg({ ok: false, text: `${name}: that file type isn't supported. Try PDF, Office, images, video, STL/OBJ/GLB/3MF, STEP or ZIP.` }); continue; }
      if (file.size > PROJECT_FILE_MAX_BYTES) { setMsg({ ok: false, text: `${name} is over 50 MB.` }); continue; }
      ok.push({ key: crypto.randomUUID(), file, name });
    }
    if (ok.length) setFiles((f) => [...f, ...ok].slice(0, 10));
  };
  const addLink = () => {
    const url = cleanUrl(linkDraft);
    if (!url) { setMsg({ ok: false, text: "That doesn't look like a link. Paste a full address, like github.com/you/repo." }); return; }
    setLinks((l) => (l.includes(url) ? l : [...l, url].slice(0, 5)));
    setLinkDraft("");
    setLinkOpen(false);
    setMsg(null);
  };

  const submit = async () => {
    setMsg(null);
    const text = body.trim() || (files.length || links.length ? `Added ${[...files.map((f) => f.name), ...links.map((l) => githubRepo(l) ?? new URL(l).host)].slice(0, 3).join(", ")}${files.length + links.length > 3 ? " and more" : ""}` : "");
    if (!text) return;
    setStep("Posting…");
    const r = await shareProject(projectId, text);
    if (!r.ok) { setStep(""); setMsg({ ok: false, text: r.message }); return; }
    // The update is up; now its files and links, each tied to it.
    const failed: string[] = [];
    const sb = getBrowserClient();
    for (const [i, p] of files.entries()) {
      setStep(`Uploading ${i + 1} of ${files.length}…`);
      const path = `${projectId}/${p.key}.${extOf(p.name)}`;
      const { error } = await sb.storage.from("project-files").upload(path, p.file, { contentType: storedType(p.name), upsert: false });
      const rec = error ? { ok: false } : await recordProjectFile(projectId, path, p.name, p.file.size, r.postId);
      if (!rec.ok) failed.push(p.name);
    }
    for (const l of links) { const a = await addProjectLink(projectId, l, r.postId); if (!a.ok) failed.push(l); }
    setStep("");
    setBody(""); setFiles([]); setLinks([]);
    setMsg(failed.length ? { ok: false, text: `Posted, but ${failed.length === 1 ? `${failed[0]} didn't upload` : `${failed.length} attachments didn't upload`}. Try adding ${failed.length === 1 ? "it" : "them"} in a new update.` } : { ok: true, text: r.message });
    router.refresh();
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      onPaste={attach ? (e) => { const pasted = [...e.clipboardData.files]; if (pasted.length) { e.preventDefault(); add(pasted); } } : undefined}
      onDragOver={attach ? (e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDrag(true); } } : undefined}
      onDragLeave={attach ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); } : undefined}
      onDrop={attach ? (e) => { e.preventDefault(); setDrag(false); add([...e.dataTransfer.files]); } : undefined}
      className={cn(className ?? "glass-card rounded-3xl p-4", drag && "ring-2 ring-text")}
    >
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium"><Megaphone className="size-4" /> Post an update</label>
      <textarea id={id} autoFocus={autoFocus} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={2} placeholder={attach ? `What changed on ${title}? Attach the CAD, a 3D model, the write-up or the repo…` : `What changed on ${title}? A result, a photo-worthy moment, what's next…`} style={{ outline: "none" }} className="mt-2 w-full resize-y rounded-xl border border-line bg-surface/70 px-3.5 py-2.5 text-[15px] placeholder:text-faint focus:border-text" />

      {/* What's attached so far. */}
      {(files.length > 0 || links.length > 0) && (
        <ul aria-label="Attached" className="mt-2 flex flex-wrap gap-1.5">
          {files.map((p) => {
            const Icon = kindOfFile(p.name) === "model" ? Box : FileText;
            return (
              <li key={p.key} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface/70 py-1 pr-1 pl-2.5 text-xs">
                <Icon className="size-3.5 shrink-0 text-muted" /><span className="max-w-48 truncate">{p.name}</span><span className="text-faint">{sizeLabel(p.file.size)}</span>
                <button type="button" disabled={busy} onClick={() => setFiles((f) => f.filter((x) => x.key !== p.key))} aria-label={`Remove ${p.name}`} className="grid size-5 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-3" /></button>
              </li>
            );
          })}
          {links.map((l) => (
            <li key={l} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface/70 py-1 pr-1 pl-2.5 text-xs">
              <Link2 className="size-3.5 shrink-0 text-muted" /><span className="max-w-56 truncate">{githubRepo(l) ?? l.replace(/^https?:\/\//, "")}</span>
              <button type="button" disabled={busy} onClick={() => setLinks((x) => x.filter((y) => y !== l))} aria-label={`Remove ${l}`} className="grid size-5 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-3" /></button>
            </li>
          ))}
        </ul>
      )}

      {attach && linkOpen && (
        <div className="mt-2 flex gap-2">
          <label htmlFor={`${id}-link`} className="sr-only">Link</label>
          <input id={`${id}-link`} autoFocus value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } if (e.key === "Escape") setLinkOpen(false); }} placeholder="github.com/you/repo, an Onshape doc, a Drive folder…" className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface/70 px-3.5 text-sm outline-none placeholder:text-faint focus:border-text" />
          <button type="button" onClick={addLink} disabled={!linkDraft.trim()} className="h-9 shrink-0 rounded-full border border-line px-4 text-sm font-medium transition hover:bg-hover disabled:opacity-50">Add</button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {attach && (
          <>
            <button type="button" disabled={busy} onClick={() => pick.current?.click()} aria-label="Attach files" title="Attach files: documents, photos, video, CAD, 3D models, code (up to 50 MB each)" className="grid size-9 place-items-center rounded-full border border-line text-muted transition hover:bg-hover hover:text-text"><Paperclip className="size-4" /></button>
            <input ref={pick} type="file" multiple accept={ACCEPT_ATTR} className="hidden" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
            <button type="button" disabled={busy} onClick={() => setLinkOpen(!linkOpen)} aria-expanded={linkOpen} aria-label="Add a link" title="Add a link (GitHub, Onshape, Drive…)" className="grid size-9 place-items-center rounded-full border border-line text-muted transition hover:bg-hover hover:text-text"><Link2 className="size-4" /></button>
          </>
        )}
        <button type="submit" disabled={busy || (!body.trim() && !files.length && !links.length)} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" />} {step || "Post update"}</button>
        {msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-ok" : "text-xs text-danger"}>{msg.text}</span>}
        <span className="ml-auto text-[11px] text-faint">{attach ? "Drop or paste files here · " : ""}Also shows in your followers&apos; feeds</span>
      </div>
    </form>
  );
}
