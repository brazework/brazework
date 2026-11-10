"use client";
import { CalendarPlus, Loader2, Pencil, Plus, X } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { EVENT_FORMATS, EVENT_TYPES, INDUSTRIES, ORG_SIZES, toLocalInput, whereLabel, type ForgeEvent } from "@/lib/events";
import { ALL_TOPICS, cn } from "@/lib/forge";
import { submitWithoutReset } from "@/lib/submit";
import { LocalTime } from "../events/local-time";
import { parseIcs, upcoming, type IcsEvent } from "@/lib/ics";
import { cancelEvent, importClubEvents, registerOrganization, saveEvent, type OrgState } from "./actions";

const init: OrgState = { ok: false, message: "" };

export function RegisterOrg({ email }: { email: string }) {
  const [state, action, pending] = useActionState(registerOrganization, init);
  const [type, setType] = useState<"company" | "school">("company");
  const [industries, setIndustries] = useState<string[]>([]);
  const domain = email.split("@")[1] ?? "";
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
      <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
        You&apos;re signed in as <span className="text-text">{email}</span>. The website you enter must be at <span className="text-text">{domain || "your work domain"}</span>; personal email providers can&apos;t register organizations.
      </p>
      <input type="hidden" name="type" value={type} />
      {industries.map((i) => <input key={i} type="hidden" name="industries" value={i} />)}
      <div role="group" aria-label="Organization type" className="flex gap-2">
        {(["company", "school"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className="rounded-full border border-line px-4 py-1.5 text-sm text-muted transition aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent">{t === "company" ? "Company" : "School"}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name"><input name="name" maxLength={120} className={inputCls} required /></Field>
        <Field label="Website" hint={type === "school" ? "Needs an academic domain, e.g. ending in .edu." : undefined}><input name="website" placeholder={domain ? `https://${domain}` : "https://"} className={inputCls} required /></Field>
        <Field label="Location"><input name="location" maxLength={160} placeholder="City, country" className={inputCls} /></Field>
        <Field label="Size"><select name="size" className={inputCls} defaultValue=""><option value="">Choose…</option>{ORG_SIZES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      {type === "company" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-2">Industries</legend>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRIES.map((i) => (
              <button key={i} type="button" aria-pressed={industries.includes(i)} onClick={() => setIndustries((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition aria-pressed:border-text aria-pressed:text-text">{i}</button>
            ))}
          </div>
        </fieldset>
      )}
      {state.message && <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-ok" : "text-danger")}>{state.message}</p>}
      <Button type="submit" size="lg" disabled={pending} className="self-start">{pending && <Loader2 className="size-4 animate-spin" />} Register organization</Button>
    </form>
  );
}

export function EventRow({ event: e, editable }: { event: ForgeEvent; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-surface/70 p-4">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{e.title}{e.status === "cancelled" && <span className="ml-2 text-xs text-danger">Cancelled</span>}</div>
        <div className="text-sm text-muted"><LocalTime kind="full-clock" value={e.starts_at} /> · {whereLabel(e)} · {e.rsvp_count} going</div>
        {msg && <div className="text-xs text-muted">{msg}</div>}
      </div>
      {editable && e.status !== "cancelled" && (
        <div className="flex gap-1">
          <button aria-label="Edit event" onClick={() => setEditing(true)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-text"><Pencil className="size-4" /></button>
          <button disabled={pending} onClick={() => confirm("Cancel this event? Everyone who RSVP'd sees it's cancelled.") && start(async () => setMsg((await cancelEvent(e.id)).message))} className="inline-flex h-9 items-center rounded-full px-3 text-sm text-danger hover:bg-hover">Cancel</button>
        </div>
      )}
      {editing && <EventDialog event={e} host={{ orgId: e.org_id, communityId: e.community_id }} onClose={() => setEditing(false)} />}
    </div>
  );
}

type Host = { orgId?: string | null; communityId?: string | null };

export function EventEditor({ orgId, communityId }: Host) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> {communityId ? "Host an event" : "New event"}</Button>
      {open && <EventDialog host={{ orgId, communityId }} onClose={() => setOpen(false)} />}
    </>
  );
}

function EventDialog({ event, host, onClose }: { event?: ForgeEvent; host: Host; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveEvent, init);
  const [format, setFormat] = useState<string>(event?.format ?? "In person");
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => { if (state.ok) onClose(); }, [state.ok, onClose]);

  // The date picker is local time; send exact moments.
  const onSubmit = (ev: React.SyntheticEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    for (const k of ["starts_at", "ends_at"]) {
      const v = String(fd.get(k) ?? "");
      fd.set(k, v ? new Date(v).toISOString() : "");
    }
    startTransition(() => action(fd));
  };

  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[min(640px,calc(100vw-24px))] overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-bg/70 backdrop:backdrop-blur-sm">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-semibold tracking-tight">{event ? "Edit event" : "New event"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        </div>
        <input type="hidden" name="id" value={event?.id ?? ""} />
        <input type="hidden" name="org_id" value={host.orgId ?? ""} />
        <input type="hidden" name="community_id" value={host.communityId ?? ""} />
        <Field label="Title"><input name="title" defaultValue={event?.title} maxLength={120} className={inputCls} required /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Type"><select name="type" defaultValue={event?.type ?? "Talk"} className={inputCls}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Format"><select name="format" value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>{EVENT_FORMATS.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Topic"><select name="topic" defaultValue={event?.topic ?? ""} className={inputCls} required><option value="">Choose…</option>{ALL_TOPICS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Starts"><input name="starts_at" type="datetime-local" defaultValue={event ? toLocalInput(event.starts_at) : ""} className={inputCls} required /></Field>
          <Field label="Ends"><input name="ends_at" type="datetime-local" defaultValue={event ? toLocalInput(event.ends_at) : ""} className={inputCls} required /></Field>
        </div>
        {format !== "Online" && <Field label="Location"><input name="location" defaultValue={event?.location} maxLength={160} className={inputCls} /></Field>}
        <Field label="Link" hint="Registration or stream link (optional)."><input name="link" type="url" defaultValue={event?.link} maxLength={300} className={inputCls} /></Field>
        <Field label="Description"><textarea name="description" defaultValue={event?.description} maxLength={2000} rows={5} className={cn(inputCls, "h-auto resize-y py-3")} /></Field>
        {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {event ? "Save" : "Publish event"}</Button>
        </div>
      </form>
    </dialog>
  );
}

// Bring a semester over from Google Calendar, Outlook or Apple Calendar: pick the exported .ics
// file, tick the events to bring, choose how they're labelled, import. The file never leaves the
// browser; only the chosen events are sent.
export function CalendarImport({ communityId }: { communityId: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<IcsEvent[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [type, setType] = useState<string>("Workshop");
  const [topic, setTopic] = useState<string>("");
  const [msg, setMsg] = useState<OrgState>(init);
  const [pending, start] = useTransition();
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close(); }, [open]);

  const load = async (file: File | undefined) => {
    setMsg(init);
    if (!file) return;
    if (file.size > 2_000_000) { setMsg({ ok: false, message: "That file is over 2 MB. Export just this calendar." }); return; }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const list = upcoming(parseIcs(await file.text(), tz), Date.now());
    setEvents(list);
    setPicked(new Set(list.map((e) => e.uid)));
    if (!list.length) setMsg({ ok: false, message: "No upcoming events in that file." });
  };
  const run = () => start(async () => {
    const chosen = (events ?? []).filter((e) => picked.has(e.uid)).map(({ title, description, location, link, starts_at, ends_at }) => ({ title, description, location, link, starts_at, ends_at }));
    const r = await importClubEvents(communityId, chosen, type, topic);
    setMsg(r);
    if (r.ok) { setEvents(null); setTimeout(() => setOpen(false), 900); }
  });
  const toggle = (uid: string) => setPicked((s) => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setEvents(null); setMsg(init); }} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm transition hover:border-line-strong hover:bg-hover">
        <CalendarPlus className="size-4" /> Import calendar
      </button>
      {open && (
        <dialog ref={ref} aria-label="Import events from a calendar" onCancel={(e) => { e.preventDefault(); setOpen(false); }} className="m-auto max-h-[90dvh] w-[min(640px,calc(100vw-24px))] overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-bg/70 backdrop:backdrop-blur-sm">
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Import from your calendar</h2>
                <p className="mt-1 text-sm text-muted">Export your club&apos;s calendar as an .ics file (Google Calendar: Settings → Import &amp; export), then pick it here.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
            </div>
            <input id="ics-file" type="file" accept=".ics,text/calendar" onChange={(e) => void load(e.target.files?.[0])} className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-line file:bg-surface-2 file:px-4 file:py-2 file:text-sm file:text-text" />
            {events && events.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Type"><select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                  <Field label="Topic"><select id="ics-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls} required><option value="">Choose…</option>{ALL_TOPICS.map((t) => <option key={t}>{t}</option>)}</select></Field>
                </div>
                <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-2xl border border-line p-1.5">
                  {events.map((e) => (
                    <li key={e.uid}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2 hover:bg-hover">
                        <input type="checkbox" checked={picked.has(e.uid)} onChange={() => toggle(e.uid)} className="mt-1 size-4 accent-[var(--accent)]" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{e.title}</span>
                          <span className="block truncate text-xs text-muted"><LocalTime kind="full-clock" value={e.starts_at} />{e.location ? ` · ${e.location}` : e.link ? " · Online" : ""}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {events && events.length > 0 && (
                <Button onClick={run} disabled={pending || !picked.size || !topic}>{pending && <Loader2 className="size-4 animate-spin" />} Import {picked.size} {picked.size === 1 ? "event" : "events"}</Button>
              )}
              {msg.message && <p role={msg.ok ? "status" : "alert"} className={cn("text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.message}</p>}
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
