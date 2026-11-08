"use client";
import { Loader2, X } from "lucide-react";
import { useActionState, useState } from "react";
import { chipCls } from "@/components/app/page-ui";
import { Button, Field, inputCls } from "@/components/ui";
import { COMMUNITY_FIELDS, LIMITS, PRIVACY, TYPES } from "@/lib/communities";
import { ALL_TOPICS, cn } from "@/lib/forge";
import { submitWithoutReset } from "@/lib/submit";
import { createCommunity, type CreateState } from "./actions";

export function CreateCommunity({ interests, field }: { interests: string[]; field: string }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createCommunity, { ok: false, message: "" });
  const [type, setType] = useState("field");
  const [privacy, setPrivacy] = useState("public");
  const [topics, setTopics] = useState<string[]>([]);
  const options = [...new Set([...interests, ...ALL_TOPICS])];
  const pill = "rounded-2xl border border-line px-4 py-3 text-left text-sm transition aria-pressed:border-text aria-pressed:bg-raised";
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold tracking-tight">Start a community</h2>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="privacy" value={privacy} />
      {topics.map((t) => <input key={t} type="hidden" name="topics" value={t} />)}
      <Field label="Name"><input name="name" maxLength={LIMITS.name} placeholder="e.g. State Robotics Club" className={inputCls} required /></Field>
      <Field label="What's it for?"><textarea name="about" maxLength={LIMITS.about} rows={3} className={cn(inputCls, "h-auto resize-none py-3")} required /></Field>
      <Field label="Main field">
        <select name="field" defaultValue={field || COMMUNITY_FIELDS[0]} className={inputCls}>{COMMUNITY_FIELDS.map((f) => <option key={f}>{f}</option>)}</select>
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-2">Type</legend>
        <div className="grid grid-cols-2 gap-2">{TYPES.map((t) => <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className={pill}>{t.label}</button>)}</div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-2">Who can join</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRIVACY.map((p) => (
            <button key={p.id} type="button" aria-pressed={privacy === p.id} onClick={() => setPrivacy(p.id)} className={pill}>
              <span className="font-medium">{p.label}</span><span className="mt-0.5 block text-xs text-faint">{p.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Field label={`Topics (${topics.length}/3)`}>
        <select value="" disabled={topics.length >= 3} onChange={(e) => { const t = e.target.value; if (t && !topics.includes(t)) setTopics([...topics, t].slice(0, 3)); }} className={inputCls}>
          <option value="">{topics.length >= 3 ? "Up to 3 topics" : "Add a topic…"}</option>
          {options.map((t) => <option key={t} value={t} disabled={topics.includes(t)}>{t}</option>)}
        </select>
      </Field>
      {topics.length > 0 && <div className="-mt-3 flex flex-wrap gap-1.5">{topics.map((t) => <button key={t} type="button" onClick={() => setTopics(topics.filter((x) => x !== t))} className={cn(chipCls, "inline-flex items-center gap-1")} aria-label={`Remove ${t}`}>#{t} <X className="size-3" /></button>)}</div>}
      <Field label="Rules" hint="Optional. Shown on the community page."><textarea name="rules" maxLength={LIMITS.rules} rows={4} className={cn(inputCls, "h-auto resize-y py-3")} /></Field>
      {state.message && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
      <Button type="submit" size="lg" disabled={pending} className="self-start">{pending && <Loader2 className="size-4 animate-spin" />} Create community</Button>
    </form>
  );
}
