"use client";
import { Check, FileUp, Loader2, Plus, Users, X } from "lucide-react";
import { useActionState, useId, useRef, useState, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { addFaculty, createClass, removeFaculty, setRoster, type PortalState } from "@/lib/school-portal";
import { submitWithoutReset } from "@/lib/submit";

// The school portal's forms (Your school): faculty start a class and paste or upload its roster; the
// school's admins keep the faculty list. Lists come from a CSV export or plain text
// (lib/school-roster.ts reads them on the server).
const idle: PortalState = { ok: false, message: "" };

// A CSV or text file read into the box beside it, so what's sent is what the person sees.
function FilePick({ onText, label }: { onText: (text: string) => void; label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-text-2 transition hover:border-line-strong hover:text-text">
      <FileUp className="size-4" aria-hidden="true" /> {label}
      <input id={id} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) onText((await f.text()).slice(0, 200_000)); }} />
    </label>
  );
}
function Status({ state }: { state: PortalState }) {
  if (!state.message) return <p role="status" className="min-h-5 text-sm" />;
  return <p role="status" className={cn("flex min-h-5 items-start gap-1.5 text-sm", state.ok ? "text-ok" : "text-danger")}>{state.ok && <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}{state.message}</p>;
}

export function CreateClassForm({ terms }: { terms: string[] }) {
  const [state, action, pending] = useActionState(createClass, idle);
  const [open, setOpen] = useState(false);
  const roster = useRef<HTMLTextAreaElement>(null);
  if (!open) return <Button type="button" onClick={() => setOpen(true)} className="self-start"><Plus className="size-4" /> Start a class</Button>;
  return (
    <form onSubmit={submitWithoutReset(action)} className="glass-card flex flex-col gap-4 rounded-xl p-5" aria-label="Start a class">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Start a class</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-text"><X className="size-4" /></button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_minmax(0,1fr)_10rem]">
        <Field label="Course"><input name="course" required maxLength={12} placeholder="ME 410" autoComplete="off" className={inputCls} /></Field>
        <Field label="Name"><input name="title" required maxLength={44} placeholder="Capstone Design" autoComplete="off" className={inputCls} /></Field>
        <Field label="Term"><select name="term" defaultValue={terms[0]} className={inputCls}>{terms.map((t) => <option key={t}>{t}</option>)}</select></Field>
      </div>
      <Field label="Roster (optional)">
        <textarea ref={roster} name="roster" rows={4} placeholder={"Paste the class list, or choose its CSV: one school email per line or an email column.\nben.cho@hartford.edu\nann.lee@hartford.edu"} className={cn(inputCls, "h-auto py-2.5 font-mono text-[13px]")} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Starting…" : "Start the class"}</Button>
        <FilePick onText={(t) => { if (roster.current) roster.current.value = t; }} label="Choose a CSV" />
      </div>
      <Status state={state} />
      <p className="text-xs text-faint">The class is private: only its roster and its faculty are in it. Students on the roster join with their school email, now or when they sign up.</p>
    </form>
  );
}

export function RosterForm({ cid }: { cid: string }) {
  const [state, action, pending] = useActionState(setRoster, idle);
  const roster = useRef<HTMLTextAreaElement>(null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-3 flex flex-col gap-3" aria-label="Class roster">
      <input type="hidden" name="cid" value={cid} />
      <textarea ref={roster} name="roster" rows={3} aria-label="Roster emails" placeholder="Paste emails or choose the roster CSV" className={cn(inputCls, "h-auto py-2 font-mono text-[13px]")} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save roster</Button>
        <FilePick onText={(t) => { if (roster.current) roster.current.value = t; }} label="CSV" />
        <label className="inline-flex items-center gap-2 text-muted"><input type="checkbox" name="replace" className="accent-[var(--brand)]" /> Replace the list</label>
      </div>
      <Status state={state} />
    </form>
  );
}

export function FacultyForm({ domain }: { domain: string }) {
  const [state, action, pending] = useActionState(addFaculty, idle);
  const list = useRef<HTMLTextAreaElement>(null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-3" aria-label="Add faculty">
      <input type="hidden" name="domain" value={domain} />
      <textarea ref={list} name="faculty" rows={4} aria-label="Faculty list" placeholder={`email, name, title\nmaya.ortiz@${domain}, Maya Ortiz, Professor`} className={cn(inputCls, "h-auto py-2.5 font-mono text-[13px]")} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} <Users className="size-4" /> Add faculty</Button>
        <FilePick onText={(t) => { if (list.current) list.current.value = t; }} label="Choose a CSV" />
      </div>
      <Status state={state} />
    </form>
  );
}

export function RemoveFaculty({ domain, email }: { domain: string; email: string }) {
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  if (!sure) return <button type="button" onClick={() => setSure(true)} className="text-xs text-muted hover:text-danger">Remove</button>;
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <button type="button" disabled={pending} onClick={() => start(async () => { await removeFaculty(domain, email); })} className="font-medium text-danger">{pending ? "Removing…" : "Remove"}</button>
      <button type="button" onClick={() => setSure(false)} className="text-muted hover:text-text">Keep</button>
    </span>
  );
}
