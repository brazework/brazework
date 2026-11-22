"use client";
import { Box, FileText, Link2, Loader2, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button, selectPillCls } from "@/components/ui";
import { cn, TOPICS } from "@/lib/forge";
import { MAX_TAGS, hashtagsIn } from "@/lib/hashtags";
import { editPost } from "@/lib/posts";
import { ACCEPT_ATTR, MODEL_ACCEPT_ATTR, cleanUrl, githubRepo, kindOfFile, maxBytesFor, sizeLabel } from "@/lib/project-file-types";
import { uploadAttachments, type PendingFile } from "@/lib/attach-upload";

const MAX = 3000;

// Edit your own post in place: its text and up to 3 topics. Escape cancels, Ctrl/⌘+Enter saves.
// An update on a project (`projectId`) can also gain files, 3D models and links (FIX-238): they're
// tied to this update, so they show under it as if posted with it, and in the project's Files.
// Removing one is on the file itself, under the update (components/projects/project-files.tsx).
export function EditPost({ postId, body, tags, projectId = null, onCancel, onSaved }: { postId: string; body: string; tags: string[]; projectId?: string | null; onCancel: () => void; onSaved: (next: { body: string; tags: string[] }) => void }) {
  const router = useRouter();
  const [text, setText] = useState(body);
  const [picked, setPicked] = useState<string[]>(tags);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [step, setStep] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const pickModel = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const attach = !!projectId;
  const busy = pending || step !== "";

  const add = (list: File[]) => {
    const ok: PendingFile[] = [];
    for (const file of list) {
      const name = file.name || `pasted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${file.type.split("/")[1] || "png"}`;
      if (!kindOfFile(name)) { setError(`${name}: that file type isn't supported. Try PDF, Office, images, video, STL/OBJ/GLB/3MF, STEP or ZIP.`); continue; }
      if (file.size > maxBytesFor(name)) { setError(`${name} is over ${kindOfFile(name) === "video" ? 250 : 50} MB.`); continue; }
      ok.push({ key: crypto.randomUUID(), file, name });
    }
    if (ok.length) setFiles((f) => [...f, ...ok].slice(0, 10));
  };
  const addLink = () => {
    const url = cleanUrl(linkDraft);
    if (!url) { setError("That doesn't look like a link. Paste a full address, like github.com/you/repo."); return; }
    setLinks((l) => (l.includes(url) ? l : [...l, url].slice(0, 5)));
    setLinkDraft(""); setLinkOpen(false); setError("");
  };

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const textChanged = text.trim() !== body.trim() || picked.join("|") !== tags.join("|");
  const changed = textChanged || files.length > 0 || links.length > 0;
  const save = () =>
    start(async () => {
      setError("");
      if (textChanged) {
        const r = await editPost(postId, text, picked).catch(() => ({ ok: false, message: "Couldn't save. Check your connection." }));
        if (!r.ok) { setError(r.message); return; }
      }
      // Then the new attachments, each tied to this update.
      if (projectId && (files.length || links.length)) {
        const failed = await uploadAttachments({ projectId, postId, files, links, onStep: setStep });
        setStep("");
        router.refresh();
        if (failed.length) {
          setFiles((f) => f.filter((p) => failed.includes(p.name))); setLinks((l) => l.filter((x) => failed.includes(x)));
          setError(`${failed.length === 1 ? `${failed[0]} didn't upload` : `${failed.length} attachments didn't upload`}. Try again.`);
          return;
        }
      }
      // The server adds any #tags written in the text (same rule, lib/hashtags.ts).
      onSaved({ body: text.trim(), tags: [...new Set([...picked, ...hashtagsIn(text)])].slice(0, MAX_TAGS) });
    });

  return (
    <form
      className="mt-4 flex flex-col gap-3"
      onSubmit={(e) => { e.preventDefault(); if (changed && text.trim()) save(); }}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && changed && text.trim()) { e.preventDefault(); save(); }
      }}
      onPaste={attach ? (e) => { const pasted = [...e.clipboardData.files]; if (pasted.length) { e.preventDefault(); add(pasted); } } : undefined}
      onDragOver={attach ? (e) => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); } : undefined}
      onDrop={attach ? (e) => { e.preventDefault(); add([...e.dataTransfer.files]); } : undefined}
    >
      <label htmlFor={`${id}-body`} className="sr-only">Edit your post</label>
      <textarea
        ref={area}
        id={`${id}-body`}
        value={text}
        maxLength={MAX}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(12, Math.max(3, text.split("\n").length + 1))}
        className="w-full resize-y rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-line-strong"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-faint">Topics</span>
        {picked.map((t) => (
          <button key={t} type="button" onClick={() => setPicked(picked.filter((x) => x !== t))} aria-label={`Remove topic ${t}`} className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-0.5 font-mono text-[11px] text-text">
            #{t} <X className="size-3" />
          </button>
        ))}
        {picked.length < 3 && (
          <>
            <label htmlFor={`${id}-topic`} className="sr-only">Add a topic</label>
            <select
              id={`${id}-topic`}
              value=""
              onChange={(e) => { const t = e.target.value; if (t && !picked.includes(t)) setPicked([...picked, t]); }}
              className={cn(selectPillCls, "h-8 text-xs")}
            >
              <option value="">Add a topic…</option>
              {TOPICS.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.topics.filter((t) => !picked.includes(t)).map((t) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
          </>
        )}
      </div>
      {attach && (
        <div className="rounded-2xl border border-dashed border-line px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-faint">Add to this update</span>
            <button type="button" disabled={busy} onClick={() => pick.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium transition hover:bg-hover"><Paperclip className="size-3.5" /> Files</button>
            <input ref={pick} type="file" multiple accept={ACCEPT_ATTR} aria-label="Attach files to this update" className="hidden" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
            <button type="button" disabled={busy} onClick={() => pickModel.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium transition hover:bg-hover"><Box className="size-3.5" /> 3D model</button>
            <input ref={pickModel} type="file" accept={MODEL_ACCEPT_ATTR} aria-label="Add a 3D model to this update" className="hidden" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
            <button type="button" disabled={busy} onClick={() => setLinkOpen(!linkOpen)} aria-expanded={linkOpen} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium transition hover:bg-hover"><Link2 className="size-3.5" /> Link</button>
            <span className="ml-auto text-[11px] text-faint">or drop or paste files here</span>
          </div>
          {linkOpen && (
            <div className="mt-2 flex gap-2">
              <label htmlFor={`${id}-link`} className="sr-only">Link</label>
              <input id={`${id}-link`} autoFocus value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); addLink(); } if (e.key === "Escape") { e.stopPropagation(); setLinkOpen(false); } }} placeholder="github.com/you/repo, an Onshape doc, a Drive folder…" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong" />
              <button type="button" onClick={addLink} disabled={!linkDraft.trim()} className="h-9 shrink-0 rounded-lg border border-line px-3.5 text-sm font-medium transition hover:bg-hover disabled:opacity-50">Add</button>
            </div>
          )}
          {(files.length > 0 || links.length > 0) && (
            <ul aria-label="To add" className="mt-2 flex flex-wrap gap-1.5">
              {files.map((p) => {
                const Icon = kindOfFile(p.name) === "model" ? Box : FileText;
                return (
                  <li key={p.key} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-2.5 text-xs">
                    <Icon className="size-3.5 shrink-0 text-muted" /><span className="max-w-48 truncate">{p.name}</span><span className="text-faint">{sizeLabel(p.file.size)}</span>
                    <button type="button" disabled={busy} onClick={() => setFiles((f) => f.filter((x) => x.key !== p.key))} aria-label={`Don't add ${p.name}`} className="grid size-5 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-3" /></button>
                  </li>
                );
              })}
              {links.map((l) => (
                <li key={l} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-2.5 text-xs">
                  <Link2 className="size-3.5 shrink-0 text-muted" /><span className="max-w-56 truncate">{githubRepo(l) ?? l.replace(/^https?:\/\//, "")}</span>
                  <button type="button" disabled={busy} onClick={() => setLinks((x) => x.filter((y) => y !== l))} aria-label={`Don't add ${l}`} className="grid size-5 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-3" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("font-mono text-[11px] tabular-nums", text.length > MAX - 100 ? "text-danger" : "text-faint")}>{text.length} / {MAX}</span>
        {error && <span role="alert" className="text-xs text-danger">{error}</span>}
        <Button type="button" variant="ghost" className="ml-auto" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy || !changed || !text.trim()}>
          {busy && <Loader2 className="size-4 animate-spin" />} {step || "Save"}
        </Button>
      </div>
    </form>
  );
}
