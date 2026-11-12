"use client";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, CheckCircle2, ExternalLink, GitBranch, Loader2, Lock, Pencil, Plus, Share2, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCopilot } from "@/components/copilot/use-copilot";
import { importFromGitHub } from "@/lib/connectors/actions";
import type { ProjectDraft } from "@/lib/connectors/github";
import { StackPicker } from "@/components/projects/stack-picker";
import { AddMilestone, MilestoneTimeline, type Club, type Milestone } from "./milestones";
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
  milestones?: Milestone[];
  tools?: string[];
  specs?: { label: string; value: string }[];
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

export function ProjectCard({ project, own, interests, copilot = false, clubs, stack = false, specsOn = false }: { project: ProjectView; own: boolean; interests: string[]; copilot?: boolean; clubs?: Club[]; stack?: boolean; specsOn?: boolean }) {
  const verified = (project.milestones ?? []).filter((m) => m.status === "verified").length;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const link = safeLink(project.link);
  const act = (fn: () => Promise<ProjectState>) => start(async () => { const r = await fn(); setMsg(r.ok ? r.message : r.message); });

  return (
    <article className="glass-card group relative flex h-full flex-col overflow-hidden rounded-3xl p-5 transition duration-300">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight"><Link href={`/projects/${project.id}`} className="hover:underline">{project.title}</Link></h3>
        {verified > 0 && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 text-[11px] font-medium text-ok"><BadgeCheck className="size-3.5" /> {verified} verified</span>}
        {project.private && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted"><Lock className="size-3" /> Private</span>}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
        {project.status === "completed" ? <CheckCircle2 className="size-3.5 text-ok" /> : <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-50" /><span className="relative size-2 rounded-full bg-accent" /></span>}
        {meta(project)}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-text-2">{project.summary}</p>
      {project.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{project.tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-text-2">#{t}</span>)}</div>}
      {!!project.tools?.length && <p className="mt-2 truncate text-xs text-muted"><span className="text-faint">Built with</span> {project.tools.slice(0, 5).join(" · ")}{project.tools.length > 5 ? ` +${project.tools.length - 5}` : ""}</p>}
      {project.milestones && <MilestoneTimeline items={project.milestones} own={own} />}
      {own && clubs && <div className="mt-3"><AddMilestone projectId={project.id} projectTitle={project.title} clubs={clubs} /></div>}
      {(project.details || link) && (
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-2 transition hover:bg-hover hover:text-text">
          {open ? "Hide write-up" : "Read the write-up"}
          <motion.span animate={{ rotate: open ? 45 : 0 }} className="inline-flex"><Plus className="size-3.5" /></motion.span>
        </button>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="mt-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm leading-relaxed whitespace-pre-wrap text-text-2">
              {project.details}
              {link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 flex items-center gap-1.5 text-text underline underline-offset-4"><ExternalLink className="size-3.5" /> {new URL(link).hostname}</a>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      {editing && <ProjectDialog project={project} interests={interests} copilot={copilot} stack={stack} specsOn={specsOn} onClose={() => setEditing(false)} />}
    </article>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
] as const;

// The project grid with All / In progress / Completed filters; cards glide into their new spots.
export function ProjectGrid({ projects, own, interests, copilot = false, clubs, stack = false, specsOn = false }: { projects: ProjectView[]; own: boolean; interests: string[]; copilot?: boolean; clubs?: Club[]; stack?: boolean; specsOn?: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const shown = filter === "all" ? projects : projects.filter((p) => p.status === filter);
  const count = (id: string) => (id === "all" ? projects.length : projects.filter((p) => p.status === id).length);
  return (
    <>
      {projects.length > 1 && (
        <div role="radiogroup" aria-label="Filter projects" className="mb-4 inline-flex gap-1 rounded-full bg-surface-2 p-1">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)} className={cn("relative rounded-full px-3.5 py-1.5 text-xs font-medium transition", filter === f.id ? "text-on-accent" : "text-muted hover:text-text")}>
              {filter === f.id && <motion.span layoutId="project-filter" className="bg-accent-grad absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{f.label} · {count(f.id)}</span>
            </button>
          ))}
        </div>
      )}
      <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((pr) => (
            <motion.div key={pr.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.25 }}>
              <ProjectCard project={pr} own={own} interests={interests} copilot={copilot} clubs={clubs} stack={stack} specsOn={specsOn} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {projects.length > 0 && !shown.length && <p className="text-sm text-muted">No {filter === "completed" ? "completed" : "in-progress"} projects yet.</p>}
    </>
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

export function ProjectEditor({ interests, copilot = false, stack = false, specsOn = false }: { interests: string[]; copilot?: boolean; stack?: boolean; specsOn?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add project</Button>
      {open && <ProjectDialog interests={interests} copilot={copilot} stack={stack} specsOn={specsOn} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProjectDialog({ project, interests, onClose, copilot = false, stack = false, specsOn = false }: { project?: ProjectView; interests: string[]; onClose: () => void; copilot?: boolean; stack?: boolean; specsOn?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [details, setDetails] = useState(project?.details ?? "");
  const [tools, setTools] = useState<string[]>(project?.tools ?? []);
  const [summaryText, setSummaryText] = useState(project?.summary ?? "");
  const ai = useCopilot();
  // Import from GitHub: fills the form from a public repo; the member reviews it before saving.
  const [repoUrl, setRepoUrl] = useState("");
  const [importing, startImport] = useTransition();
  const [importMsg, setImportMsg] = useState("");
  const [imported, setImported] = useState<ProjectDraft | null>(null);
  const runImport = () => startImport(async () => {
    setImportMsg("");
    const r = await importFromGitHub(repoUrl);
    if (!r.ok) { setImportMsg(r.message); return; }
    const d = r.draft;
    const form = formRef.current;
    const put = (name: string, value: string) => { const el = form?.elements.namedItem(name); if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = value; };
    put("title", d.title); put("summary", d.summary); put("link", d.link);
    setDetails(d.details); setStatus(d.status); setTags(d.tags); setSummaryText(d.summary); if (d.tools?.length) setTools(d.tools);
    if (d.year) requestAnimationFrame(() => put("year", d.year));
    setImported(d);
  });
  // Copilot drafts the write-up from the title, summary and whatever notes are already in the box.
  const writeUp = () => {
    const f = new FormData(formRef.current ?? undefined);
    const notes = details.trim() || String(f.get("summary") ?? "");
    void ai.run({ task: "writeup", input: notes || "No notes yet.", title: String(f.get("title") ?? "").slice(0, 120), summary: String(f.get("summary") ?? "").slice(0, 600) }, (full) => setDetails(full.slice(0, 5000)));
  };
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
      <form ref={formRef} onSubmit={submitWithoutReset(action)} className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{project ? "Edit project" : "Add a project"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        {!project && (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface-2/50 p-3">
            <label htmlFor="gh-url" className="flex items-center gap-1.5 text-xs font-medium text-muted"><GitBranch className="size-3.5" /> Import from GitHub (optional)</label>
            <div className="mt-2 flex gap-2">
              <input id="gh-url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runImport(); } }} placeholder="github.com/owner/repo" className={cn(inputCls, "h-10 flex-1")} />
              <Button type="button" variant="outline" onClick={runImport} disabled={importing || !repoUrl.trim()}>{importing ? <Loader2 className="size-4 animate-spin" /> : "Import"}</Button>
            </div>
            {importMsg && <p role="alert" className="mt-2 text-xs text-danger">{importMsg}</p>}
            {imported && (
              <div className="mt-2 text-xs text-muted">
                <p className="text-ok">Filled in from GitHub. Check everything, then save.</p>
                {imported.milestones.length > 0 && <p className="mt-1">After saving, add these as milestones for your club to verify: {imported.milestones.map((m) => `${m.title} (${m.date})`).join(", ")}.</p>}
              </div>
            )}
          </div>
        )}
        <input type="hidden" name="id" value={project?.id ?? ""} />
        <input type="hidden" name="status" value={status} />
        {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
        <Field label="Title"><input name="title" defaultValue={project?.title} maxLength={120} className={inputCls} required /></Field>
        <Field label="Summary" hint="Everyone sees this, even when the project is private."><textarea name="summary" defaultValue={project?.summary} onChange={(e) => setSummaryText(e.target.value)} maxLength={600} rows={3} className={cn(inputCls, "h-auto resize-none py-3")} required /></Field>
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Status" className="flex gap-1.5">
            {(["in_progress", "completed"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition aria-pressed:border-transparent aria-pressed:bg-accent-grad aria-pressed:text-on-accent">
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
        <Field label="Write-up" hint="What you built, how, and what you learned."><textarea name="details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={5000} rows={6} className={cn(inputCls, "h-auto resize-y py-3 leading-relaxed")} /></Field>
        {copilot && (
          <div className="-mt-2 flex flex-wrap items-center gap-2">
            {ai.busy ? (
              <button type="button" onClick={ai.stop} className="h-8 rounded-lg border border-line px-3 text-xs">Stop</button>
            ) : (
              <button type="button" onClick={writeUp} className="bg-accent-grad inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-on-accent"><Sparkles className="size-3.5" /> {details.trim() ? "Polish it with Copilot" : "Write it with Copilot"}</button>
            )}
            <span className="text-xs text-faint">Uses your title, summary and notes. Check every fact before saving.</span>
            {ai.error && <p role="alert" className="w-full text-xs text-danger">{ai.error}</p>}
          </div>
        )}
        {stack && <StackPicker value={tools} onChange={setTools} text={`${summaryText}\n${details}`} />}
        <Field label="Link"><input name="link" type="url" defaultValue={project?.link ?? ""} placeholder="https://github.com/…" maxLength={300} className={inputCls} /></Field>
        {specsOn && <SpecsEditor initial={project?.specs ?? []} />}
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

// Specs: label/value rows for the numbers that matter ("Peak thrust: 2 kN"). Empty rows are dropped.
function SpecsEditor({ initial }: { initial: { label: string; value: string }[] }) {
  const [rows, setRows] = useState(initial.length ? initial : [{ label: "", value: "" }]);
  const set = (i: number, k: "label" | "value", v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">Specs <span className="font-normal text-faint">(optional)</span></legend>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <input name="spec_label" value={r.label} onChange={(e) => set(i, "label", e.target.value)} maxLength={40} placeholder={i === 0 ? "e.g. Peak thrust" : "Name"} aria-label={`Spec ${i + 1} name`} className={cn(inputCls, "w-2/5")} />
          <input name="spec_value" value={r.value} onChange={(e) => set(i, "value", e.target.value)} maxLength={80} placeholder={i === 0 ? "e.g. 2 kN" : "Value"} aria-label={`Spec ${i + 1} value`} className={cn(inputCls, "flex-1")} />
          <button type="button" onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [{ label: "", value: "" }]))} aria-label={`Remove spec ${i + 1}`} className="grid size-9 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
      ))}
      {rows.length < 16 && <button type="button" onClick={() => setRows((x) => [...x, { label: "", value: "" }])} className="self-start rounded-full px-1 text-sm text-text-2 hover:text-text">+ Add a spec</button>}
    </fieldset>
  );
}
