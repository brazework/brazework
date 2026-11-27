"use client";
import { Check, DoorOpen, Eye, EyeOff, FileUp, Link2, Loader2, Megaphone, Plus, Send, Star, Trash2, X } from "lucide-react";
import { useActionState, useId, useState, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { ABET_OUTCOMES, type RubricRow } from "@/lib/course-math";
import { addItem, addModule, announce, checkIn, closeSession, gradeStudents, markAttendance, openSession, peerReview, releaseGrades, removeCourseThing, saveAssignment, setAccommodation, setExtension, setPublished, submitAssignment, takeQuiz, type CourseState } from "@/lib/courses";
import { storageUpload } from "@/lib/storage-upload";
import { submitWithoutReset } from "@/lib/submit";

// Brazework Courses' forms (supabase/courses.sql, lib/courses.ts): staff build the course (modules,
// pages, links, files, assignments with rubrics, announcements) and grade; students hand in work.
// Every form stays put after an error, so nothing typed is lost.
const idle: CourseState = { ok: false, message: "" };
const areaCls = cn(inputCls, "h-auto py-2.5 leading-relaxed");

function Status({ state }: { state: CourseState }) {
  if (!state.message) return <p role="status" className="min-h-5 text-sm" />;
  return <p role="status" className={cn("flex min-h-5 items-start gap-1.5 text-sm", state.ok ? "text-ok" : "text-danger")}>{state.ok && <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}{state.message}</p>;
}

function Opener({ label, icon = <Plus className="size-4" />, children, variant = "outline" }: { label: string; icon?: React.ReactNode; children: (close: () => void) => React.ReactNode; variant?: "primary" | "outline" | "ghost" }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" variant={variant} onClick={() => setOpen(true)}>{icon} {label}</Button>;
  return <>{children(() => setOpen(false))}</>;
}

function FormShell({ title, onClose, children, ...rest }: { title: string; onClose: () => void; children: React.ReactNode } & React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form {...rest} aria-label={title} className="glass-card flex flex-col gap-4 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-text"><X className="size-4" /></button>
      </div>
      {children}
    </form>
  );
}

// A file into course-files/<class>/<folder>/<random>.<ext>; returns its path and name.
function FileField({ cid, folder, onDone, label = "Choose a file" }: { cid: string; folder: string; onDone: (f: { path: string; name: string; size: number } | null) => void; label?: string }) {
  const id = useId();
  const [state, setState] = useState<{ busy: boolean; name?: string; error?: string; pct?: number }>({ busy: false });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={id} className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-text-2 transition hover:border-line-strong hover:text-text", state.busy && "pointer-events-none opacity-60")}>
        {state.busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />} {label}
        <input id={id} type="file" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 50 * 1024 * 1024) { setState({ busy: false, error: "Files can be up to 50 MB." }); onDone(null); return; }
          const ext = (f.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 10) || "bin";
          const path = `${cid}/${folder}/${crypto.randomUUID()}.${ext}`;
          setState({ busy: true, name: f.name, pct: 0 });
          try {
            await storageUpload({ bucket: "course-files", path, file: f, contentType: f.type || "application/octet-stream", onProgress: (p) => setState((s) => ({ ...s, pct: p })) });
            setState({ busy: false, name: f.name });
            onDone({ path, name: f.name.slice(0, 200), size: f.size });
          } catch (err) {
            setState({ busy: false, error: err instanceof Error ? err.message : "Upload failed. Try again." });
            onDone(null);
          }
        }} />
      </label>
      {state.busy && <span className="text-xs text-muted tabular-nums">{Math.round((state.pct ?? 0) * 100)}%</span>}
      {!state.busy && state.name && !state.error && <span className="inline-flex min-w-0 items-center gap-1 truncate text-sm text-ok"><Check className="size-4 shrink-0" aria-hidden="true" /> {state.name}</span>}
      {state.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
    </div>
  );
}

export function AddModuleForm({ cid }: { cid: string }) {
  const [state, action, pending] = useActionState(addModule, idle);
  return (
    <Opener label="Add a module">
      {(close) => (
        <FormShell title="Add a module" onClose={close} onSubmit={submitWithoutReset(action)}>
          <input type="hidden" name="cid" value={cid} />
          <Field label="Name"><input name="title" required maxLength={120} placeholder="Week 1: Requirements" autoComplete="off" className={inputCls} /></Field>
          <label className="flex items-center gap-2 text-sm text-text-2"><input type="checkbox" name="published" defaultChecked className="size-4 accent-[var(--text)]" /> Students can see it now</label>
          <div className="flex items-center gap-3"><Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Add the module</Button></div>
          <Status state={state} />
        </FormShell>
      )}
    </Opener>
  );
}

export function AddItemForm({ cid, moduleId }: { cid: string; moduleId: string }) {
  const [state, action, pending] = useActionState(addItem, idle);
  const [kind, setKind] = useState<"page" | "link" | "file">("page");
  const [file, setFile] = useState<{ path: string; name: string; size: number } | null>(null);
  return (
    <Opener label="Add material" variant="ghost">
      {(close) => (
        <FormShell title="Add material" onClose={close} onSubmit={submitWithoutReset(action)}>
          <input type="hidden" name="cid" value={cid} />
          <input type="hidden" name="module_id" value={moduleId} />
          <input type="hidden" name="kind" value={kind} />
          <div role="radiogroup" aria-label="Kind" className="flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
            {(["page", "link", "file"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("flex-1 rounded-md px-3 py-1.5 capitalize transition", kind === k ? "bg-surface font-medium text-text shadow-sm" : "text-muted hover:text-text")}>{k}</button>
            ))}
          </div>
          <Field label="Title"><input name="title" required maxLength={160} placeholder={kind === "page" ? "How this course runs" : kind === "link" ? "Design review template" : "Lecture 1 slides"} defaultValue={kind === "file" ? file?.name ?? "" : undefined} key={kind + (file?.name ?? "")} autoComplete="off" className={inputCls} /></Field>
          {kind === "page" && <Field label="Page"><textarea name="body" rows={6} maxLength={20000} placeholder="Write it here. Blank lines start new paragraphs." className={areaCls} /></Field>}
          {kind === "link" && <Field label="Link"><input name="url" required inputMode="url" placeholder="https://cad.onshape.com/documents/…" className={inputCls} /></Field>}
          {kind === "file" && (
            <>
              <FileField cid={cid} folder="materials" onDone={setFile} />
              <input type="hidden" name="path" value={file?.path ?? ""} />
              <input type="hidden" name="size" value={file?.size ?? ""} />
            </>
          )}
          <div className="flex items-center gap-3"><Button type="submit" disabled={pending || (kind === "file" && !file)}>{pending && <Loader2 className="size-4 animate-spin" />} Add it</Button></div>
          <Status state={state} />
        </FormShell>
      )}
    </Opener>
  );
}

function RubricEditor() {
  const [rows, setRows] = useState<number[]>([0]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-text-2">Rubric <span className="ml-1 text-xs font-normal text-faint">Optional. With a rubric, the assignment is worth what its rows add up to; tag a row with an ABET outcome and the school&apos;s accreditation evidence groups by it.</span></legend>
      {rows.map((i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_5rem_2.25rem] gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,14rem)_2.25rem]">
          <input name={`criterion_${i}`} maxLength={200} placeholder="Criterion, like Analysis" aria-label="Criterion" className={inputCls} />
          <input name={`points_${i}`} inputMode="decimal" placeholder="Points" aria-label="Points" className={inputCls} />
          <select name={`outcome_${i}`} aria-label="ABET outcome" defaultValue="" className={cn(inputCls, "col-span-2 sm:col-span-1 sm:order-none")}>
            <option value="">No outcome</option>
            {ABET_OUTCOMES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button type="button" aria-label="Remove row" onClick={() => setRows((r) => (r.length > 1 ? r.filter((x) => x !== i) : r))} className="row-start-1 col-start-3 grid size-10 place-items-center rounded-lg text-muted hover:bg-hover hover:text-text sm:col-start-4"><X className="size-4" /></button>
        </div>
      ))}
      {rows.length < 20 && <button type="button" onClick={() => setRows((r) => [...r, Math.max(...r) + 1])} className="self-start text-sm font-medium text-text-2 underline-offset-4 hover:text-text hover:underline">Add a row</button>}
    </fieldset>
  );
}

// A quiz's questions as the professor writes them (the right answers go to the database's quiz_keys,
// which students can't read; supabase/courses-b.sql).
type DraftQ = { id: string; type: "choice" | "multi" | "number" | "short"; prompt: string; options: string[]; answer: number[]; value: string; tolerance: string; points: string };
const newQ = (n: number): DraftQ => ({ id: `q${n}`, type: "choice", prompt: "", options: ["", ""], answer: [], value: "", tolerance: "", points: "1" });
const Q_TYPES: { id: DraftQ["type"]; label: string }[] = [{ id: "choice", label: "One answer" }, { id: "multi", label: "Several answers" }, { id: "number", label: "A number" }, { id: "short", label: "Short answer" }];

function quizJson(qs: DraftQ[]): string {
  return JSON.stringify(qs.filter((q) => q.prompt.trim()).map((q) => {
    const options = q.options.map((o) => o.trim()).filter(Boolean);
    const base = { id: q.id, prompt: q.prompt.trim(), type: q.type, points: Number(q.points) || 0 };
    if (q.type === "choice") return { ...base, options, answer: q.answer[0] ?? null };
    if (q.type === "multi") return { ...base, options, answer: q.answer };
    if (q.type === "number") return { ...base, answer: q.value.trim() === "" ? null : Number(q.value), tolerance: Number(q.tolerance) || 0 };
    return base;
  }));
}

function QuizEditor({ value, onChange }: { value: DraftQ[]; onChange: (q: DraftQ[]) => void }) {
  const set = (i: number, patch: Partial<DraftQ>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const total = value.reduce((t, q) => t + (Number(q.points) || 0), 0);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 flex w-full items-baseline justify-between text-sm font-medium text-text-2">Questions <span className="text-xs font-normal text-faint">{value.length} · {total} points · marked automatically, short answers by you</span></legend>
      {value.map((q, i) => (
        <div key={q.id} className="flex flex-col gap-2.5 rounded-xl bg-[color-mix(in_oklab,var(--text)_4%,transparent)] p-3.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-faint">{i + 1}</span>
            <select aria-label={`Question ${i + 1} kind`} value={q.type} onChange={(e) => set(i, { type: e.target.value as DraftQ["type"], answer: [] })} className={cn(inputCls, "h-9 w-auto text-sm")}>{Q_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            <input aria-label={`Question ${i + 1} points`} inputMode="decimal" value={q.points} onChange={(e) => set(i, { points: e.target.value })} className={cn(inputCls, "h-9 w-16 text-right text-sm tabular-nums")} /><span className="text-xs text-muted">pts</span>
            {value.length > 1 && <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="ml-auto grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-text"><X className="size-4" /></button>}
          </div>
          <textarea aria-label={`Question ${i + 1}`} rows={2} value={q.prompt} onChange={(e) => set(i, { prompt: e.target.value })} placeholder="The question" className={areaCls} />
          {(q.type === "choice" || q.type === "multi") && (
            <div className="flex flex-col gap-1.5">
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type={q.type === "choice" ? "radio" : "checkbox"} name={`right_${q.id}`} aria-label={`Option ${k + 1} is right`} checked={q.answer.includes(k)}
                    onChange={(e) => set(i, { answer: q.type === "choice" ? [k] : e.target.checked ? [...q.answer, k] : q.answer.filter((x) => x !== k) })} className="size-4 accent-[var(--ok)]" />
                  <input aria-label={`Question ${i + 1} option ${k + 1}`} value={o} onChange={(e) => set(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Option ${k + 1}`} className={cn(inputCls, "h-9 text-sm")} />
                </div>
              ))}
              <span className="flex items-center gap-3 text-xs text-muted">
                {q.options.length < 10 && <button type="button" onClick={() => set(i, { options: [...q.options, ""] })} className="font-medium text-text-2 hover:text-text hover:underline">Add an option</button>}
                <span>Tick the {q.type === "choice" ? "right one" : "right ones"}.</span>
              </span>
            </div>
          )}
          {q.type === "number" && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-2">
              Answer <input aria-label={`Question ${i + 1} answer`} inputMode="decimal" value={q.value} onChange={(e) => set(i, { value: e.target.value })} className={cn(inputCls, "h-9 w-28 text-sm tabular-nums")} />
              within ± <input aria-label={`Question ${i + 1} tolerance`} inputMode="decimal" value={q.tolerance} onChange={(e) => set(i, { tolerance: e.target.value })} placeholder="0" className={cn(inputCls, "h-9 w-20 text-sm tabular-nums")} />
            </div>
          )}
          {q.type === "short" && <p className="text-xs text-muted">You read and score these after students hand in.</p>}
        </div>
      ))}
      {value.length < 60 && <button type="button" onClick={() => onChange([...value, newQ(Math.max(0, ...value.map((q) => Number(q.id.slice(1)) || 0)) + 1)])} className="self-start text-sm font-medium text-text-2 underline-offset-4 hover:text-text hover:underline">Add a question</button>}
    </fieldset>
  );
}

export function AssignmentForm({ cid, modules }: { cid: string; modules: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(saveAssignment, idle);
  const [due, setDue] = useState("");
  const [kind, setKind] = useState<"assignment" | "quiz">("assignment");
  const [group, setGroup] = useState(false);
  const [qs, setQs] = useState<DraftQ[]>([newQ(1)]);
  const quiz = kind === "quiz";
  return (
    <Opener label="New assignment" variant="primary">
      {(close) => (
        <FormShell title="New assignment" onClose={close} onSubmit={submitWithoutReset(action)}>
          <input type="hidden" name="cid" value={cid} />
          <input type="hidden" name="kind" value={kind} />
          {quiz && <input type="hidden" name="quiz_json" value={quizJson(qs)} />}
          {/* The browser knows the professor's time zone; the server gets the exact moment. */}
          <input type="hidden" name="due_iso" value={due ? new Date(due).toISOString() : ""} />
          <div role="radiogroup" aria-label="Kind" className="flex gap-1 self-start rounded-lg bg-surface-2 p-1 text-sm">
            {([["assignment", "Assignment"], ["quiz", "Quiz"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("rounded-md px-4 py-1.5 transition", kind === k ? "bg-surface font-medium text-text shadow-sm" : "text-muted hover:text-text")}>{l}</button>
            ))}
          </div>
          <Field label="Title"><input name="title" required maxLength={160} placeholder={quiz ? "Quiz 1: Free-body diagrams" : "Requirements memo"} autoComplete="off" className={inputCls} /></Field>
          <div className={cn("grid grid-cols-1 gap-4", quiz ? "sm:grid-cols-2" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]")}>
            <Field label={quiz ? "Closes" : "Due"}><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></Field>
            <Field label="Module" optional><select name="module_id" defaultValue="" className={inputCls}><option value="">None</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></Field>
            {!quiz && <Field label="Points"><input name="points" inputMode="decimal" defaultValue="100" className={inputCls} /></Field>}
          </div>
          <Field label="Instructions" optional={quiz}><textarea name="instructions" rows={quiz ? 2 : 5} maxLength={20000} placeholder={quiz ? "Anything to know before starting." : "What to hand in, how it's judged, and anything they should read first."} className={areaCls} /></Field>
          {quiz ? <QuizEditor value={qs} onChange={setQs} /> : (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-text-2">Students hand in</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-2">
                  {([["file", "A file"], ["link", "A link"], ["text", "Text"], ["milestone", "A project milestone"]] as const).map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2"><input type="checkbox" name={`as_${k}`} defaultChecked={k !== "text"} className="size-4 accent-[var(--text)]" /> {l}</label>
                  ))}
                </div>
                <p className="text-xs text-faint">A milestone, once you verify it as you grade, also goes on the student&apos;s record.</p>
              </fieldset>
              <RubricEditor />
            </>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-2">
            {!quiz && <label className="flex items-center gap-2"><input type="checkbox" name="group_work" checked={group} onChange={(e) => setGroup(e.target.checked)} className="size-4 accent-[var(--text)]" /> Group work (one hand-in per project group)</label>}
            {!quiz && group && <label className="flex items-center gap-2"><input type="checkbox" name="peer_eval" defaultChecked className="size-4 accent-[var(--text)]" /> Peer evaluation (each student rates their teammates)</label>}
            {quiz && <label className="flex items-center gap-2"><input type="checkbox" name="show_score" defaultChecked className="size-4 accent-[var(--text)]" /> Show each student their score when they finish</label>}
            <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked className="size-4 accent-[var(--text)]" /> Post it now and tell the class</label>
          </div>
          <div className="flex items-center gap-3"><Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {quiz ? "Save the quiz" : "Save the assignment"}</Button></div>
          <Status state={state} />
        </FormShell>
      )}
    </Opener>
  );
}

export function AnnounceForm({ cid }: { cid: string }) {
  const [state, action, pending] = useActionState(announce, idle);
  return (
    <Opener label="Announce" icon={<Megaphone className="size-4" />}>
      {(close) => (
        <FormShell title="Announce to the class" onClose={close} onSubmit={submitWithoutReset(action)}>
          <input type="hidden" name="cid" value={cid} />
          <Field label="Title"><input name="title" required maxLength={160} placeholder="Design reviews move to Thursday" autoComplete="off" className={inputCls} /></Field>
          <Field label="Message"><textarea name="body" required rows={4} maxLength={10000} className={areaCls} /></Field>
          <div className="flex items-center gap-3"><Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Announce</Button></div>
          <Status state={state} />
        </FormShell>
      )}
    </Opener>
  );
}

export function PublishToggle({ table, id, cid, published }: { table: "course_modules" | "assignments"; id: string; cid: string; published: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await setPublished(table, id, cid, !published); setMsg(r.ok ? "" : r.message); })}
        className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition disabled:opacity-50", published ? "border-line text-text-2 hover:border-line-strong hover:text-text" : "border-dashed border-line-strong text-muted hover:text-text")}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} {published ? "Published" : "Draft · publish"}
      </button>
      {msg && <span role="alert" className="text-xs text-danger">{msg}</span>}
    </span>
  );
}

export function RemoveButton({ table, id, cid, what }: { table: "course_modules" | "course_items" | "assignments" | "course_announcements"; id: string; cid: string; what: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-label={`Remove ${what}`} title={`Remove ${what}`} disabled={pending}
      onClick={() => { if (confirm(`Remove ${what}? This can't be undone.`)) start(async () => { await removeCourseThing(table, id, cid); }); }}
      className="grid size-8 place-items-center rounded-md text-faint transition hover:bg-hover hover:text-danger disabled:opacity-50">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}

export function ReleaseButton({ cid, aid, waiting }: { cid: string; aid: string; waiting: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<CourseState>(idle);
  if (!waiting && !msg.message) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {waiting > 0 && <Button type="button" disabled={pending} onClick={() => start(async () => setMsg(await releaseGrades(cid, aid)))}>{pending && <Loader2 className="size-4 animate-spin" />} Release {waiting} {waiting === 1 ? "grade" : "grades"}</Button>}
      <Status state={msg} />
    </div>
  );
}

export type Handin = { body: string; url: string | null; file_name: string | null; file_href: string | null; milestone_id: string | null; project_id: string | null; submitted_at: string };

export function SubmitForm({ cid, aid, uid, submitAs, groupWork, projects, milestones, current, locked }: {
  cid: string; aid: string; uid: string; submitAs: string[]; groupWork: boolean; projects: { id: string; title: string }[]; milestones: { id: string; title: string; status: string }[]; current: Handin | null; locked: boolean;
}) {
  const [state, action, pending] = useActionState(submitAssignment, idle);
  const [file, setFile] = useState<{ path: string; name: string } | null>(null);
  const [editing, setEditing] = useState(!current);
  // Once it's handed in, the form folds away (React's "adjust state on a change" pattern).
  const [seen, setSeen] = useState(state);
  if (state !== seen) { setSeen(state); if (state.ok) setEditing(false); }
  if (locked) return null;
  if (!editing) return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={() => setEditing(true)}>Replace what you handed in</Button>
      {state.ok && <Status state={state} />}
    </div>
  );
  const takes = (k: string) => submitAs.includes(k);
  return (
    <form onSubmit={submitWithoutReset(action)} aria-label="Hand it in" className="glass-card flex flex-col gap-4 rounded-xl p-5">
      <input type="hidden" name="cid" value={cid} />
      <input type="hidden" name="aid" value={aid} />
      <h3 className="font-semibold">{current ? "Replace your work" : "Hand it in"}</h3>
      {groupWork && (
        projects.length
          ? <Field label="Your group's project" hint="Group work: your group hands in once, and everyone on the project sees it."><select name="project_id" required defaultValue={current?.project_id ?? projects[0].id} className={inputCls}>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
          : <p className="rounded-lg border border-dashed border-wait px-3 py-2.5 text-sm text-text-2">This is group work. Start your group&apos;s project on the class page (or ask a teammate to add you to theirs), then hand it in from here.</p>
      )}
      {takes("milestone") && (
        <Field label="A milestone" optional hint={milestones.length ? "Your professor can verify it as they grade, so it also goes on your record." : "Log a milestone on your class project first, with its proof."}>
          <select name="milestone_id" defaultValue={current?.milestone_id ?? ""} className={inputCls} disabled={!milestones.length}>
            <option value="">None</option>
            {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}{m.status === "verified" ? " · verified" : ""}</option>)}
          </select>
        </Field>
      )}
      {takes("link") && <Field label="A link" optional hint="Onshape, Drive, GitHub, a video: anywhere your work lives."><span className="relative block"><Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden="true" /><input name="url" inputMode="url" defaultValue={current?.url ?? ""} placeholder="https://" className={cn(inputCls, "pl-9")} /></span></Field>}
      {takes("file") && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-2">A file <span className="ml-1 text-xs font-normal text-faint">PDF, CAD, code, photos or video, up to 50 MB</span></span>
          <FileField cid={cid} folder={uid} onDone={setFile} label={current?.file_name ? "Choose a new file" : "Choose a file"} />
          {current?.file_name && !file && <span className="text-xs text-muted">Now: {current.file_name}</span>}
          <input type="hidden" name="file_path" value={file?.path ?? ""} />
          <input type="hidden" name="file_name" value={file?.name ?? ""} />
        </div>
      )}
      {takes("text") && <Field label="Text" optional><textarea name="body" rows={5} maxLength={20000} defaultValue={current?.body ?? ""} className={areaCls} /></Field>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || (groupWork && !projects.length)}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {current ? "Replace it" : "Hand it in"}</Button>
        {current && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
      </div>
      <Status state={state} />
    </form>
  );
}

export function GradeForm({ cid, aid, uids, who, rubric, points, current, milestoneId }: {
  cid: string; aid: string; uids: string[]; who: string; rubric: RubricRow[]; points: number;
  current: { score: number | null; rubric_scores: Record<string, number>; feedback: string; released: boolean } | null; milestoneId: string | null;
}) {
  const [state, action, pending] = useActionState(gradeStudents, idle);
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(rubric.map((r) => [r.id, current?.rubric_scores?.[r.id] != null ? String(current.rubric_scores[r.id]) : ""])));
  const total = rubric.reduce((s, r) => s + (Number(scores[r.id]) || 0), 0);
  return (
    <form onSubmit={submitWithoutReset(action)} aria-label={`Grade ${who}`} className="flex flex-col gap-3">
      <input type="hidden" name="cid" value={cid} />
      <input type="hidden" name="aid" value={aid} />
      <input type="hidden" name="uids" value={uids.join(",")} />
      {rubric.length ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <tbody>
              {rubric.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">{r.criterion}{r.outcome && <span className="ml-2 text-xs text-faint">ABET {r.outcome}</span>}</td>
                  <td className="w-32 px-3 py-1.5 text-right whitespace-nowrap">
                    <input name={`rubric_${r.id}`} aria-label={`${r.criterion}, out of ${r.points}`} inputMode="decimal" value={scores[r.id]} onChange={(e) => setScores((s) => ({ ...s, [r.id]: e.target.value }))} className={cn(inputCls, "h-8 w-16 px-2 text-right text-sm tabular-nums")} /> <span className="text-xs text-muted">/ {r.points}</span>
                  </td>
                </tr>
              ))}
              <tr className="bg-surface-2"><td className="px-3 py-2 font-medium">Total</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{total} / {points}</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm text-text-2">Score <input name="score" inputMode="decimal" aria-label={`Score, out of ${points}`} defaultValue={current?.score ?? ""} className={cn(inputCls, "h-9 w-24 text-right tabular-nums")} /> <span className="text-muted">/ {points}</span></label>
      )}
      <textarea name="feedback" rows={3} maxLength={10000} aria-label="Feedback" placeholder="Feedback for the student" defaultValue={current?.feedback ?? ""} className={areaCls} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-2">
        {!current?.released && <label className="flex items-center gap-2"><input type="checkbox" name="release" className="size-4 accent-[var(--text)]" /> Release now</label>}
        {milestoneId && (
          <>
            <input type="hidden" name="verify_milestone" value={milestoneId} />
            <label className="flex items-center gap-2"><input type="checkbox" name="verify" defaultChecked className="size-4 accent-[var(--text)]" /> Verify the milestone too (it goes on their record)</label>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {current ? "Update the grade" : "Save the grade"}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}

// A fold that stays as the person left it when the page refreshes after a save (a server-rendered
// <details open={…}> would snap shut once the grade exists, hiding the confirmation).
export function Fold({ label, openAtFirst, className, children }: { label: string; openAtFirst: boolean; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(openAtFirst);
  return (
    <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium text-text-2 hover:text-text">{label}</summary>
      {children}
    </details>
  );
}

// ---------- Phase B: quizzes, extensions, accommodations, attendance, peer evaluation ----------

export type QuizQuestion = { id: string; prompt: string; type: "choice" | "multi" | "number" | "short"; options?: string[]; points: number };

// A student takes the quiz: once, before it closes (supabase/courses-b.sql submit_quiz).
export function QuizForm({ cid, aid, questions }: { cid: string; aid: string; questions: QuizQuestion[] }) {
  const [state, action, pending] = useActionState(takeQuiz, idle);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const answered = questions.filter((q) => { const a = answers[q.id]; return Array.isArray(a) ? a.length > 0 : a !== undefined && a !== ""; }).length;
  if (state.ok) return <div className="glass-card rounded-2xl p-5"><Status state={state} /></div>;
  return (
    <form onSubmit={(e) => { if (answered < questions.length && !confirm(`You've answered ${answered} of ${questions.length}. Hand it in anyway? You can only take it once.`)) { e.preventDefault(); return; } submitWithoutReset(action)(e); }}
      aria-label="Take the quiz" className="flex flex-col gap-4">
      <input type="hidden" name="cid" value={cid} />
      <input type="hidden" name="aid" value={aid} />
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />
      {questions.map((q, i) => (
        <fieldset key={q.id} className="glass-card rounded-2xl p-5">
          <legend className="sr-only">Question {i + 1}</legend>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] leading-relaxed font-medium whitespace-pre-line"><span className="mr-2 font-mono text-xs text-faint">{i + 1}</span>{q.prompt}</p>
            <span className="shrink-0 text-xs text-muted">{q.points} {q.points === 1 ? "pt" : "pts"}</span>
          </div>
          {(q.type === "choice" || q.type === "multi") && (
            <div className="mt-3 flex flex-col gap-1.5">
              {(q.options ?? []).map((o, k) => {
                const on = q.type === "choice" ? answers[q.id] === k : ((answers[q.id] as number[] | undefined) ?? []).includes(k);
                return (
                  <label key={k} className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition", on ? "bg-[color-mix(in_oklab,var(--text)_9%,transparent)] font-medium" : "bg-[color-mix(in_oklab,var(--text)_3%,transparent)] hover:bg-[color-mix(in_oklab,var(--text)_6%,transparent)]")}>
                    <input type={q.type === "choice" ? "radio" : "checkbox"} name={`a_${q.id}`} checked={on} className="size-4 accent-[var(--text)]"
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: q.type === "choice" ? k : e.target.checked ? [...((a[q.id] as number[]) ?? []), k] : ((a[q.id] as number[]) ?? []).filter((x) => x !== k) }))} />
                    {o}
                  </label>
                );
              })}
              {q.type === "multi" && <p className="text-xs text-faint">Tick every right answer.</p>}
            </div>
          )}
          {q.type === "number" && <input aria-label={`Answer ${i + 1}`} inputMode="decimal" onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value.trim() === "" ? undefined : Number(e.target.value) }))} className={cn(inputCls, "mt-3 w-40 tabular-nums")} />}
          {q.type === "short" && <textarea aria-label={`Answer ${i + 1}`} rows={3} maxLength={4000} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} className={cn(areaCls, "mt-3")} />}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Hand in the quiz</Button>
        <span className="text-sm text-muted tabular-nums">{answered} of {questions.length} answered · one attempt</span>
      </div>
      <Status state={state} />
    </form>
  );
}

// Staff move one student's due date on this assignment.
export function ExtensionForm({ cid, aid, students }: { cid: string; aid: string; students: { uid: string; name: string }[] }) {
  const [state, action, pending] = useActionState(setExtension, idle);
  const [due, setDue] = useState("");
  return (
    <form onSubmit={submitWithoutReset(action)} aria-label="Give an extension" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="cid" value={cid} />
      <input type="hidden" name="aid" value={aid} />
      <input type="hidden" name="due_iso" value={due ? new Date(due).toISOString() : ""} />
      <Field label="Student"><select name="uid" required defaultValue="" className={cn(inputCls, "h-9 text-sm")}><option value="" disabled>Choose</option>{students.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}</select></Field>
      <Field label="New due date"><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={cn(inputCls, "h-9 text-sm")} /></Field>
      <Button type="submit" variant="outline" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {due ? "Give the extension" : "Clear an extension"}</Button>
      <div className="basis-full"><Status state={state} /></div>
    </form>
  );
}

// Staff set a student's accommodation: extra days on every due date, extra time noted.
export function AccommodationForm({ cid, students }: { cid: string; students: { uid: string; name: string }[] }) {
  const [state, action, pending] = useActionState(setAccommodation, idle);
  return (
    <form onSubmit={submitWithoutReset(action)} aria-label="Set an accommodation" className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_minmax(0,1fr)_auto]">
      <input type="hidden" name="cid" value={cid} />
      <Field label="Student"><select name="uid" required defaultValue="" className={cn(inputCls, "h-9 text-sm")}><option value="" disabled>Choose</option>{students.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}</select></Field>
      <Field label="Extra days"><input name="extra_days" inputMode="numeric" defaultValue="0" className={cn(inputCls, "h-9 text-sm tabular-nums")} /></Field>
      <Field label="Extra time %"><input name="extra_time_pct" inputMode="numeric" defaultValue="0" className={cn(inputCls, "h-9 text-sm tabular-nums")} /></Field>
      <Field label="Note" optional><input name="note" maxLength={500} placeholder="From disability services" className={cn(inputCls, "h-9 text-sm")} /></Field>
      <Button type="submit" variant="outline" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button>
      <div className="sm:col-span-5"><Status state={state} /></div>
    </form>
  );
}

// Staff open a class session: a code to put on the screen, open for a few minutes.
export function OpenSessionForm({ cid }: { cid: string }) {
  const [state, action, pending] = useActionState(openSession, idle);
  return (
    <form onSubmit={submitWithoutReset(action)} aria-label="Take attendance" className="glass-card flex flex-wrap items-end gap-3 rounded-2xl p-5">
      <input type="hidden" name="cid" value={cid} />
      <Field label="Session" optional><input name="title" maxLength={120} placeholder="Lecture 7: Gear trains" className={cn(inputCls, "h-9 text-sm")} /></Field>
      <Field label="Check-in open for"><select name="minutes" defaultValue="15" className={cn(inputCls, "h-9 text-sm")}><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="0">No self check-in</option></select></Field>
      <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <DoorOpen className="size-4" />} Take attendance</Button>
      <div className="basis-full"><Status state={state} /></div>
    </form>
  );
}

const STATUSES = [["present", "Present"], ["late", "Late"], ["absent", "Absent"], ["excused", "Excused"]] as const;

export function AttendancePicker({ cid, sid, uid, name, status }: { cid: string; sid: string; uid: string; name: string; status: string | null }) {
  const [pending, start] = useTransition();
  const [now, setNow] = useState(status);
  return (
    <div role="radiogroup" aria-label={`${name}'s attendance`} className={cn("flex gap-1", pending && "opacity-60")}>
      {STATUSES.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={now === k} onClick={() => start(async () => { const r = await markAttendance(cid, sid, uid, k); if (r.ok) setNow(k); })}
          className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition", now === k ? (k === "present" ? "bg-ok text-white" : k === "absent" ? "bg-danger text-white" : "bg-text text-bg") : "bg-[color-mix(in_oklab,var(--text)_5%,transparent)] text-muted hover:text-text")}>{l}</button>
      ))}
    </div>
  );
}

export function CloseSessionButton({ cid, sid }: { cid: string; sid: string }) {
  const [pending, start] = useTransition();
  return <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => { await closeSession(cid, sid); })}>{pending && <Loader2 className="size-4 animate-spin" />} Close check-in</Button>;
}

// A student checks in with the code on the screen.
export function CheckInForm({ compact = false }: { compact?: boolean }) {
  const [state, action, pending] = useActionState(checkIn, idle);
  return (
    <form onSubmit={submitWithoutReset(action)} aria-label="Check in to class" className={cn("flex flex-wrap items-center gap-3", !compact && "glass-card rounded-2xl p-5")}>
      <DoorOpen className="size-5 text-text-2" aria-hidden="true" />
      <span className="text-sm font-medium">In class now?</span>
      <input name="code" aria-label="Check-in code" required maxLength={8} autoComplete="off" autoCapitalize="characters" placeholder="CODE" className={cn(inputCls, "h-10 w-32 text-center font-mono tracking-[0.3em] uppercase")} />
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Check in</Button>
      <div className="basis-full"><Status state={state} /></div>
    </form>
  );
}

// A student rates each teammate on a group assignment with peer evaluation.
export function PeerReviewForm({ cid, aid, mates, given }: { cid: string; aid: string; mates: { uid: string; name: string }[]; given: Record<string, { score: number; comment: string }> }) {
  const [state, action, pending] = useActionState(peerReview, idle);
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries(Object.entries(given).map(([k, v]) => [k, v.score])));
  return (
    <form onSubmit={submitWithoutReset(action)} aria-label="Rate your teammates" className="glass-card flex flex-col gap-4 rounded-2xl p-5">
      <input type="hidden" name="cid" value={cid} />
      <input type="hidden" name="aid" value={aid} />
      <div>
        <h2 className="font-semibold tracking-tight">Rate your teammates</h2>
        <p className="mt-0.5 text-sm text-muted">How much each one contributed, 1 to 5. Only your professor sees your ratings.</p>
      </div>
      {mates.map((m) => (
        <div key={m.uid} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{m.name}</span>
            <span role="radiogroup" aria-label={`Rate ${m.name}`} className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={scores[m.uid] === n} aria-label={`${n} of 5`} onClick={() => setScores((s) => ({ ...s, [m.uid]: n }))}
                  className="grid size-8 place-items-center rounded-lg transition hover:bg-hover"><Star className={cn("size-5", (scores[m.uid] ?? 0) >= n ? "fill-[var(--brand)] text-[var(--brand)]" : "text-faint")} /></button>
              ))}
            </span>
            {scores[m.uid] && <input type="hidden" name={`score_${m.uid}`} value={scores[m.uid]} />}
          </div>
          <input name={`comment_${m.uid}`} aria-label={`About ${m.name}`} maxLength={2000} defaultValue={given[m.uid]?.comment ?? ""} placeholder="What they did (optional)" className={cn(inputCls, "h-9 text-sm")} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || mates.some((m) => !scores[m.uid])}>{pending && <Loader2 className="size-4 animate-spin" />} {Object.keys(given).length ? "Update ratings" : "Send ratings"}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}
