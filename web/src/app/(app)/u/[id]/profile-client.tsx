"use client";
import { ExternalLink, Loader2, Lock, Pencil, Plus, Share2, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { chipCls } from "@/components/app/page-ui";
import { Button, Field, inputCls } from "@/components/ui";
import { ALL_TOPICS, cn, timeAgo } from "@/lib/forge";
import { deleteProject, saveProject, setProjectPrivate, shareProject, updateProfileBasics, type ProjectState } from "@/lib/projects";
import { submitWithoutReset } from "@/lib/submit";

export type ProjectView = {
  id: string;
  title: string;
  summary: string;
  status: "in_progress" | "completed";
  year: number | null;
  tags: string[];
  private: boolean;
  updated_at: string;
  details: string | null;
  link: string | null;
};

const initial: ProjectState = { ok: false, message: "" };

export function EditBasics({ headline, bio }: { headline: string; bio: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateProfileBasics, initial);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.ok) setEditing(false);
  }

  if (!editing)
    return (
      <div className="mt-5">
        {bio ? <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{bio}</p> : <p className="text-sm text-faint">Add a short bio so people know what you work on.</p>}
        <button onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text">
          <Pencil className="size-3.5" /> Edit headline and bio
        </button>
      </div>
    );
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-5 flex flex-col gap-4">
      <Field label="Headline"><input name="headline" defaultValue={headline} maxLength={200} className={inputCls} /></Field>
      <Field label="Bio"><textarea name="bio" defaultValue={bio} maxLength={2000} rows={5} className={cn(inputCls, "h-auto resize-y py-3 leading-relaxed")} /></Field>
      {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </form>
  );
}

const meta = (p: ProjectView) => (p.status === "completed" ? `Completed${p.year ? ` ${p.year}` : ""}` : `In progress · updated ${timeAgo(p.updated_at)}`);
const safeLink = (l: string | null) => (l && /^https?:\/\/\S+$/i.test(l) ? l : null);

export function ProjectCard({ project, own, interests }: { project: ProjectView; own: boolean; interests: string[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const link = safeLink(project.link);
  const act = (fn: () => Promise<ProjectState>) => start(async () => { const r = await fn(); setMsg(r.ok ? r.message : r.message); });

  return (
    <article className="flex flex-col rounded-3xl border border-line bg-surface/70 p-5 transition hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{project.title}</h3>
        {project.private && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted"><Lock className="size-3" /> Private</span>}
      </div>
      <p className="mt-1 text-xs text-faint">{meta(project)}</p>
      <p className="mt-3 text-sm leading-relaxed text-text-2">{project.summary}</p>
      {project.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{project.tags.map((t) => <span key={t} className={chipCls}>#{t}</span>)}</div>}
      {(project.details || link) && (
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-4 self-start text-sm text-muted underline-offset-4 hover:text-text hover:underline">
          {open ? "Hide write-up" : "Read the write-up"}
        </button>
      )}
      {open && (
        <div className="mt-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm leading-relaxed whitespace-pre-wrap text-text-2">
          {project.details}
          {link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 flex items-center gap-1.5 text-text underline underline-offset-4"><ExternalLink className="size-3.5" /> {new URL(link).hostname}</a>}
        </div>
      )}
      {own && (
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
          <IconBtn label="Edit" onClick={() => setEditing(true)}><Pencil className="size-4" /></IconBtn>
          <IconBtn label="Share to feed" onClick={() => setSharing((v) => !v)}><Share2 className="size-4" /></IconBtn>
          <IconBtn label={project.private ? "Make public" : "Make private"} onClick={() => act(() => setProjectPrivate(project.id, !project.private))} disabled={pending}><Lock className="size-4" /></IconBtn>
          <IconBtn label="Delete" onClick={() => confirm("Delete this project? Posts about it are removed too.") && act(() => deleteProject(project.id))} disabled={pending}><Trash2 className="size-4" /></IconBtn>
          {msg && <span className="ml-1 text-xs text-muted">{msg}</span>}
        </div>
      )}
      {sharing && <ShareBox id={project.id} title={project.title} onDone={(m) => { setSharing(false); setMsg(m); }} />}
      {editing && <ProjectDialog project={project} interests={interests} onClose={() => setEditing(false)} />}
    </article>
  );
}

function IconBtn({ label, children, ...rest }: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-hover hover:text-text disabled:opacity-50" {...rest}>
      {children}
    </button>
  );
}

function ShareBox({ id, title, onDone }: { id: string; title: string; onDone: (m: string) => void }) {
  const [body, setBody] = useState(`Working on ${title}. `);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="sr-only" htmlFor={`share-${id}`}>Post about this project</label>
      <textarea id={`share-${id}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={3} className={cn(inputCls, "h-auto resize-none py-2.5 text-sm")} />
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      <Button className="self-end" disabled={pending || !body.trim()} onClick={() => start(async () => { const r = await shareProject(id, body); if (r.ok) onDone(r.message); else setErr(r.message); })}>
        {pending && <Loader2 className="size-4 animate-spin" />} Post to feed
      </Button>
    </div>
  );
}

export function ProjectEditor({ interests }: { interests: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add project</Button>
      {open && <ProjectDialog interests={interests} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProjectDialog({ project, interests, onClose }: { project?: ProjectView; interests: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveProject, initial);
  const [status, setStatus] = useState(project?.status ?? "in_progress");
  const [tags, setTags] = useState<string[]>(project?.tags ?? []);
  // Topics to pick from: your interests first, then everything else.
  const options = [...new Set([...interests, ...ALL_TOPICS])];

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => { if (state.ok) onClose(); }, [state.ok, onClose]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="m-auto max-h-[90dvh] w-[min(640px,calc(100vw-24px))] overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{project ? "Edit project" : "Add a project"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        <input type="hidden" name="id" value={project?.id ?? ""} />
        <input type="hidden" name="status" value={status} />
        {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
        <Field label="Title"><input name="title" defaultValue={project?.title} maxLength={120} className={inputCls} required /></Field>
        <Field label="Summary" hint="Everyone sees this, even when the project is private."><textarea name="summary" defaultValue={project?.summary} maxLength={600} rows={3} className={cn(inputCls, "h-auto resize-none py-3")} required /></Field>
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Status" className="flex gap-1.5">
            {(["in_progress", "completed"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent">
                {s === "completed" ? "Completed" : "In progress"}
              </button>
            ))}
          </div>
          {status === "completed" && <Field label="Year"><input name="year" inputMode="numeric" pattern="\d{4}" defaultValue={project?.year ?? ""} placeholder="2026" className={cn(inputCls, "w-28")} /></Field>}
        </div>
        <Field label={`Topics (${tags.length}/3)`}>
          <select
            value=""
            onChange={(e) => { const t = e.target.value; if (t && !tags.includes(t) && tags.length < 3) setTags([...tags, t]); }}
            className={inputCls}
            disabled={tags.length >= 3}
          >
            <option value="">{tags.length >= 3 ? "Up to 3 topics" : "Add a topic…"}</option>
            {options.map((t) => <option key={t} value={t} disabled={tags.includes(t)}>{t}</option>)}
          </select>
        </Field>
        {tags.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className={cn(chipCls, "inline-flex items-center gap-1 hover:text-text")} aria-label={`Remove ${t}`}>
                #{t} <X className="size-3" />
              </button>
            ))}
          </div>
        )}
        <Field label="Write-up" hint="What you built, how, and what you learned."><textarea name="details" defaultValue={project?.details ?? ""} maxLength={5000} rows={6} className={cn(inputCls, "h-auto resize-y py-3 leading-relaxed")} /></Field>
        <Field label="Link"><input name="link" type="url" defaultValue={project?.link ?? ""} placeholder="https://github.com/…" maxLength={300} className={inputCls} /></Field>
        <label className="flex items-start gap-3 rounded-2xl border border-line p-4 text-sm">
          <input type="checkbox" name="private" defaultChecked={project?.private} className="mt-0.5 size-4 accent-[var(--text)]" />
          <span><span className="font-medium">Keep the write-up and link private</span><span className="block text-faint">Others see only the card.</span></span>
        </label>
        {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {project ? "Save" : "Add project"}</Button>
        </div>
      </form>
    </dialog>
  );
}
