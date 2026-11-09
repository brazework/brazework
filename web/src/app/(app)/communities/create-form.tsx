"use client";
import { Check, Loader2, ScrollText, X } from "lucide-react";
import { useActionState, useState } from "react";
import { chipCls } from "@/components/app/page-ui";
import { Button, Field, inputCls } from "@/components/ui";
import { COMMUNITY_FIELDS, LIMITS, PRIVACY, TYPES } from "@/lib/communities";
import { ALL_TOPICS, cn } from "@/lib/forge";
import { submitWithoutReset } from "@/lib/submit";
import { createCommunity, type CreateState } from "./actions";
import { CommunityBadge } from "./_components/badge";

const STARTER_RULES = "Be kind and assume good intent.\nShare your work, including what didn't go to plan.\nCredit teammates and sources.\nKeep it on topic; take side chats to messages.\nNo spam or self-promotion without context.";

export function CreateCommunity({ interests, field }: { interests: string[]; field: string }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createCommunity, { ok: false, message: "" });
  const [type, setType] = useState("field");
  const [privacy, setPrivacy] = useState("public");
  const [topics, setTopics] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [rules, setRules] = useState("");
  // Same minimums the server enforces (createSchema in actions.ts).
  const ready = name.trim().length >= 3 && about.trim().length >= 1;
  const options = [...new Set([...interests, ...ALL_TOPICS])];
  const pill = "relative rounded-2xl border border-line px-4 py-3 text-left text-sm transition hover:border-line-strong aria-pressed:border-text aria-pressed:bg-raised";
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Start a community</h2>
        <p className="mt-1 text-sm text-muted">Takes about a minute. You can change everything later in Manage.</p>
      </div>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="privacy" value={privacy} />
      {topics.map((t) => <input key={t} type="hidden" name="topics" value={t} />)}
      <Field label="Name" count={name.length} max={LIMITS.name}><input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} placeholder="e.g. State Robotics Club" className={inputCls} required /></Field>
      <Field label="What's it for?" count={about.length} max={LIMITS.about} hint="One or two sentences: what you build and when you meet."><textarea name="about" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={LIMITS.about} rows={3} placeholder="e.g. We design, machine and fly student rockets. Build nights Thursdays at 7 in Eng 210." className={cn(inputCls, "h-auto resize-none py-3")} required /></Field>
      <Field label="Main field">
        <select name="field" defaultValue={field || COMMUNITY_FIELDS[0]} className={inputCls}>{COMMUNITY_FIELDS.map((f) => <option key={f}>{f}</option>)}</select>
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-2">Type</legend>
        <div className="grid grid-cols-2 gap-2">{TYPES.map((t) => <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className={pill}>{t.label}{type === t.id && <Check className="absolute top-3 right-3 size-4" />}</button>)}</div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-2">Who can join</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRIVACY.map((p) => (
            <button key={p.id} type="button" aria-pressed={privacy === p.id} onClick={() => setPrivacy(p.id)} className={pill}>
              <span className="font-medium">{p.label}</span><span className="mt-0.5 block text-xs text-faint">{p.hint}</span>
              {privacy === p.id && <Check className="absolute top-3 right-3 size-4" />}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Topics" optional count={topics.length} max={3} hint="Helps the right people find you in Discover.">
        <select value="" disabled={topics.length >= 3} onChange={(e) => { const t = e.target.value; if (t && !topics.includes(t)) setTopics([...topics, t].slice(0, 3)); }} className={inputCls}>
          <option value="">{topics.length >= 3 ? "Up to 3 topics" : "Add a topic…"}</option>
          {options.map((t) => <option key={t} value={t} disabled={topics.includes(t)}>{t}</option>)}
        </select>
      </Field>
      {topics.length > 0 && <div className="-mt-3 flex flex-wrap gap-1.5">{topics.map((t) => <button key={t} type="button" onClick={() => setTopics(topics.filter((x) => x !== t))} className={cn(chipCls, "inline-flex items-center gap-1")} aria-label={`Remove ${t}`}>#{t} <X className="size-3" /></button>)}</div>}
      <Field label="Rules" optional count={rules.length} max={LIMITS.rules} hint="One per line. Shown on the club's About tab.">
        <textarea name="rules" value={rules} onChange={(e) => setRules(e.target.value)} maxLength={LIMITS.rules} rows={4} className={cn(inputCls, "h-auto resize-y py-3")} />
      </Field>
      {!rules && <button type="button" onClick={() => setRules(STARTER_RULES)} className="-mt-3 inline-flex items-center gap-1.5 self-start text-xs font-medium text-text-2 underline-offset-4 hover:underline"><ScrollText className="size-3.5" /> Use starter rules</button>}
      {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || !ready}>{pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Creating…" : "Create community"}</Button>
        {!ready && <span className="text-sm text-muted">Add a name and a line about what it&apos;s for.</span>}
      </div>
    </form>
    {/* What members will see in Discover, updating as you type. */}
    <aside className="hidden lg:block" aria-label="Preview">
      <div className="sticky top-24">
        <div className="mb-2 text-xs font-medium tracking-wide text-faint uppercase">Preview</div>
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="cover-empty h-20" />
          <div className="flex gap-3 p-4">
            <CommunityBadge id="preview" name={name || "Your club"} className="relative z-10 -mt-9 border-4 border-surface" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{name || "Your club"}</div>
              <div className="text-xs text-muted">1 member · {PRIVACY.find((p) => p.id === privacy)?.label}</div>
            </div>
          </div>
          <p className="line-clamp-3 px-4 text-sm text-text-2">{about || "What you build and when you meet shows here."}</p>
          <div className="flex flex-wrap gap-1 p-4">{(topics.length ? topics : ["Topic"]).map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">#{t}</span>)}</div>
        </div>
      </div>
    </aside>
    </div>
  );
}
