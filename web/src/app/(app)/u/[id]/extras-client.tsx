"use client";
import { Globe, Loader2, MapPin, Pencil, Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { saveProfileExtras, type ProjectState } from "@/lib/projects";
import { OPEN_TO, linkName, openToLabel, type ProfileLink } from "@/lib/profile-meta";
import { submitWithoutReset } from "@/lib/submit";

const initial: ProjectState = { ok: false, message: "" };

// The "Open to", location and links card: read-only for visitors, editable in place for you.
export function ExtrasCard({ openTo, location, links, own }: { openTo: string[]; location: string; links: ProfileLink[]; own: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(saveProfileExtras, initial);
  const [seen, setSeen] = useState(state);
  const [picked, setPicked] = useState<string[]>(openTo);
  const [rows, setRows] = useState<ProfileLink[]>(links.length ? links : [{ url: "" }]);
  if (state !== seen) { setSeen(state); if (state.ok) setEditing(false); }
  const empty = !openTo.length && !location && !links.length;
  if (!own && empty) return null;

  if (!editing)
    return (
      <section className="glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Open to</h2>
          {own && <button type="button" onClick={() => setEditing(true)} aria-label="Edit open to, location and links" className="grid size-7 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text"><Pencil className="size-3.5" /></button>}
        </div>
        {openTo.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">{openTo.map((o) => <span key={o} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-text">{openToLabel(o)}</span>)}</div>
        ) : own && <p className="mt-2 text-sm text-muted">Tell recruiters and clubs what you&apos;re looking for.</p>}
        {location && <p className="mt-3 flex items-center gap-1.5 text-sm text-text-2"><MapPin className="size-3.5 text-faint" /> {location}</p>}
        {links.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 truncate text-sm text-text-2 transition hover:text-text hover:underline"><Globe className="size-3.5 shrink-0 text-faint" /> {linkName(l)}</a></li>)}
          </ul>
        )}
      </section>
    );

  return (
    <form onSubmit={submitWithoutReset(action)} className="glass-card flex flex-col gap-4 rounded-3xl p-5">
      <fieldset>
        <legend className="text-sm font-medium">Open to <span className="font-normal text-faint">(up to 4)</span></legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OPEN_TO.map((o) => {
            const on = picked.includes(o.id);
            return (
              <label key={o.id} className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent", on ? "border-transparent bg-accent-grad text-on-accent" : "border-line text-muted hover:border-line-strong hover:text-text", !on && picked.length >= 4 && "pointer-events-none opacity-40")}>
                <input type="checkbox" name="openTo" value={o.id} checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== o.id) : [...p, o.id]))} className="sr-only" />
                {o.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field label="Location" optional><input name="location" defaultValue={location} maxLength={80} placeholder="Boston, MA" className={inputCls} /></Field>
      <div>
        <span className="text-sm font-medium">Links <span className="font-normal text-faint">(https, up to 5)</span></span>
        <input type="hidden" name="links" value={JSON.stringify(rows.filter((r) => r.url.trim()))} />
        <div className="mt-2 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Link ${i + 1} label`} value={r.label ?? ""} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={40} placeholder="GitHub" className={cn(inputCls, "w-24 shrink-0")} />
              <input aria-label={`Link ${i + 1} URL`} type="url" value={r.url} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://" className={cn(inputCls, "min-w-0 flex-1")} />
              <button type="button" aria-label={`Remove link ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ url: "" }]))} className="grid size-10 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
            </div>
          ))}
        </div>
        {rows.length < 5 && <button type="button" onClick={() => setRows((rs) => [...rs, { url: "" }])} className="mt-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text"><Plus className="size-3.5" /> Add a link</button>}
      </div>
      {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </form>
  );
}
