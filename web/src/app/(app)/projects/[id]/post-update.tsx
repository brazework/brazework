"use client";
import { Box, FileText, Link2, Loader2, Megaphone, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { ACCEPT_ATTR, MODEL_ACCEPT_ATTR, cleanUrl, githubRepo, kindOfFile, maxBytesFor, sizeLabel } from "@/lib/project-file-types";
import { uploadAttachments, type PendingFile } from "@/lib/attach-upload";
import { shareProject } from "@/lib/projects";

type Pending = PendingFile;

// Post progress on a project: what changed, plus the files that show it (documents, photos, video,
// CAD, 3D models you can rotate, code) and links (a GitHub repo, an Onshape doc), all as one update.
// Attach with the paperclip, by dropping onto the box, or by pasting a file. The update goes to the
// feed as a project post; its files show under it on the project page and in the project's Files.
// Posting keeps you where you are (the project page, or the Projects workbench).
// `compact`: one line with its buttons beside it, for a Build card: type what you did and press Log.
// (A long line stays on one line and scrolls sideways, like a text field, rather than wrapping out of sight.)
// `onPosted` runs once the update is up (the card then offers the next step).
export function PostUpdate({ projectId, title, className, autoFocus = false, attach = false, compact = false, onPosted }: { projectId: string; title: string; className?: string; autoFocus?: boolean; attach?: boolean; compact?: boolean; onPosted?: () => void }) {
  const router = useRouter();
  const pick = useRef<HTMLInputElement>(null);
  const pickModel = useRef<HTMLInputElement>(null);
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
      if (file.size > maxBytesFor(name)) { setMsg({ ok: false, text: `${name} is over ${kindOfFile(name) === "video" ? 250 : 50} MB.` }); continue; }
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
    // Attaching only attaches (FIX-247): the post holds what was typed, never the files' names.
    const text = body.trim();
    const attached = files.length > 0 || links.length > 0;
    if (!text && !attached) return;
    setStep("Posting…");
    const r = await shareProject(projectId, text, { attachments: attached });
    if (!r.ok) { setStep(""); setMsg({ ok: false, text: r.message }); return; }
    // The update is up; now its files and links, each tied to it (lib/attach-upload.ts).
    const failed = await uploadAttachments({ projectId, postId: r.postId, files, links, onStep: setStep });
    setStep("");
    setBody(""); setFiles([]); setLinks([]);
    setMsg(failed.length ? { ok: false, text: `Posted, but ${failed.length === 1 ? `${failed[0]} didn't upload` : `${failed.length} attachments didn't upload`}. Edit the update to add ${failed.length === 1 ? "it" : "them"} again.` } : { ok: true, text: r.message });
    router.refresh();
    onPosted?.();
  };

  const formProps = {
    onSubmit: (e: React.FormEvent) => { e.preventDefault(); void submit(); },
    onPaste: attach ? (e: React.ClipboardEvent) => { const pasted = [...e.clipboardData.files]; if (pasted.length) { e.preventDefault(); add(pasted); } } : undefined,
    onDragOver: attach ? (e: React.DragEvent) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDrag(true); } } : undefined,
    onDragLeave: attach ? (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); } : undefined,
    onDrop: attach ? (e: React.DragEvent) => { e.preventDefault(); setDrag(false); add([...e.dataTransfer.files]); } : undefined,
  };
  const round = "grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-hover hover:text-text";
  const attached = (
    <>
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

    </>
  );
  const linkRow = (
    <>
      {attach && linkOpen && (
        <div className="mt-2 flex gap-2">
          <label htmlFor={`${id}-link`} className="sr-only">Link</label>
          <input id={`${id}-link`} autoFocus value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } if (e.key === "Escape") setLinkOpen(false); }} placeholder="github.com/you/repo, an Onshape doc, a Drive folder…" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface/70 px-3.5 text-sm outline-none placeholder:text-faint focus:border-text" />
          <button type="button" onClick={addLink} disabled={!linkDraft.trim()} className="h-9 shrink-0 rounded-lg border border-line px-4 text-sm font-medium transition hover:bg-hover disabled:opacity-50">Add</button>
        </div>
      )}

    </>
  );
  const tools = attach && (
    <>
      <button type="button" disabled={busy} onClick={() => pick.current?.click()} aria-label="Attach files" title="Attach files: documents, photos, video, CAD, 3D models, code (up to 50 MB each)" className={round}><Paperclip className="size-4" /></button>
      <input ref={pick} type="file" multiple accept={ACCEPT_ATTR} className="hidden" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
      {/* A 3D model has its own button: it's the one attachment people don't expect to work. */}
      <button type="button" disabled={busy} onClick={() => pickModel.current?.click()} aria-label="Add a 3D model" title="Add a 3D model (STL, 3MF, OBJ or GLB): it opens in a viewer you can turn" className={round}><Box className="size-4" /></button>
      <input ref={pickModel} type="file" accept={MODEL_ACCEPT_ATTR} className="hidden" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
      <button type="button" disabled={busy} onClick={() => setLinkOpen(!linkOpen)} aria-expanded={linkOpen} aria-label="Add a link" title="Add a link (GitHub, Onshape, Drive…)" className={round}><Link2 className="size-4" /></button>
    </>
  );
  const note = msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-ok" : "text-xs text-danger"}>{msg.text}</span>;
  const send = (label: string) => <button type="submit" disabled={busy || (!body.trim() && !files.length && !links.length)} className="bg-accent-grad inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-on-accent disabled:opacity-50">{busy && <Loader2 className="size-4 animate-spin" />} {step || label}</button>;

  if (compact) {
    return (
      <form {...formProps} className={cn("rounded-xl", className, drag && "ring-2 ring-text")}>
        <label htmlFor={id} className="sr-only">Log an update on {title}</label>
        <div className="flex flex-wrap items-center gap-2">
          <textarea id={id} autoFocus={autoFocus} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={1} wrap="off" placeholder="What did you do on this today?"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }}
            style={{ outline: "none" }} className="no-scrollbar h-10 min-w-0 flex-1 basis-full resize-none overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-surface px-3 py-2 text-[15px] leading-6 placeholder:text-faint focus:border-text sm:basis-48" />
          {tools}
          <span className="ml-auto sm:ml-0">{send("Log")}</span>
        </div>
        {attached}
        {linkRow}
        {/* When it goes up, the card says so (and what's next); only a problem is reported here. */}
        {msg && !msg.ok && <p className="mt-1.5">{note}</p>}
      </form>
    );
  }

  return (
    <form {...formProps} className={cn(className ?? "glass-card rounded-3xl p-4", drag && "ring-2 ring-text")}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium"><Megaphone className="size-4" /> Post an update</label>
      <textarea id={id} autoFocus={autoFocus} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={2} placeholder={attach ? `What changed on ${title}? Attach the CAD, a 3D model, the write-up or the repo…` : `What changed on ${title}? A result, a photo-worthy moment, what's next…`} style={{ outline: "none" }} className="mt-2 w-full resize-y rounded-xl border border-line bg-surface/70 px-3.5 py-2.5 text-[15px] placeholder:text-faint focus:border-text" />
      {attached}
      {linkRow}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {tools}
        {send("Post update")}
        {note}
        <span className="ml-auto text-[11px] text-faint">{attach ? "Drop or paste files here · " : ""}Also shows in your followers&apos; feeds</span>
      </div>
    </form>
  );
}
