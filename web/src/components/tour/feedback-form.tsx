"use client";
import { Bug, Heart, Lightbulb, Loader2, Send, Sparkles, Wrench } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { cn } from "@/lib/forge";
import { sendFeedback, type FeedbackKind } from "@/lib/feedback";

const KINDS: { id: FeedbackKind; label: string; icon: typeof Lightbulb; prompt: string }[] = [
  { id: "idea", label: "Idea", icon: Lightbulb, prompt: "What would make Forge more useful to you?" },
  { id: "problem", label: "Problem", icon: Bug, prompt: "What went wrong, and where?" },
  { id: "improvement", label: "Improve", icon: Wrench, prompt: "What could work better, and how?" },
  { id: "praise", label: "Praise", icon: Heart, prompt: "What do you like? We'd love to know what to keep." },
];

const AREAS: [string, string][] = [
  ["general", "Forge in general"], ["feed", "Feed"], ["search", "Search"], ["profiles", "Profiles & projects"],
  ["communities", "Communities"], ["messages", "Messages"], ["events", "Events"], ["network", "Network"],
  ["notifications", "Notifications"], ["other", "Something else"],
];

const MAX = 1000;

// "Send feedback": ideas, problems, improvements and praise go straight to the Forge team.
// Similar feedback is grouped into one idea, so we tell people when others asked for the same thing.
export function FeedbackForm({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [area, setArea] = useState("general");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ idea: string; joined: boolean; others: number; praise: boolean } | null>(null);
  const [pending, start] = useTransition();
  const k = KINDS.find((x) => x.id === kind)!;
  const tooShort = body.trim().length < 10;

  if (done) {
    return (
      <div role="status" className="flex flex-col items-start gap-2 rounded-2xl bg-surface-2 p-4 text-sm">
        <span className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-accent" /> Thank you, it&apos;s with the team.</span>
        <p className="text-text-2">
          {done.praise
            ? "We pass every kind word on. It helps us know what to keep."
            : done.joined && done.others > 0
              ? <>{done.others === 1 ? "One other member has" : `${done.others} other members have`} asked for something similar, so we added your voice to <strong className="font-medium">&ldquo;{done.idea}&rdquo;</strong>. Ideas more people ask for rise to the top.</>
              : <>We logged it as <strong className="font-medium">&ldquo;{done.idea}&rdquo;</strong>. When others ask for the same thing, it rises to the top.</>}
        </p>
        <button type="button" onClick={() => { setDone(null); setBody(""); setKind("idea"); setArea("general"); setContact(false); }} className="text-sm underline underline-offset-4 hover:text-text">
          Send more feedback
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (tooShort) { setError("Tell us a little more (at least 10 characters)."); return; }
        start(async () => {
          setError("");
          const r = await sendFeedback({ kind, area, body, mayContact: contact }).catch(() => ({ ok: false as const, message: "Couldn't send that. Check your connection." }));
          if (r.ok) setDone({ idea: r.idea, joined: r.joined, others: r.others, praise: kind === "praise" });
          else setError(r.message);
        });
      }}
    >
      {!compact && <p className="text-sm text-muted">Tell us what to build next or what got in your way. Similar ideas are grouped, so the most-requested ones rise to the top.</p>}
      <div role="radiogroup" aria-label="Kind of feedback" className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
        {KINDS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={kind === x.id}
            onClick={() => setKind(x.id)}
            className={cn("flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition", kind === x.id ? "bg-surface text-text shadow-[var(--shadow)]" : "text-muted hover:text-text")}
          >
            <x.icon className="size-4" /> {x.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-area`} className="text-xs text-faint">About</label>
        <select id={`${id}-area`} value={area} onChange={(e) => setArea(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-3 text-sm">
          {AREAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-body`} className="text-xs text-faint">{k.prompt}</label>
        <textarea
          id={`${id}-body`}
          value={body}
          maxLength={MAX}
          onChange={(e) => setBody(e.target.value)}
          rows={compact ? 3 : 4}
          placeholder={kind === "problem" ? "e.g. Messages take a few seconds to appear after I send them" : kind === "praise" ? "e.g. The project write-ups are exactly what I needed" : "e.g. Let me filter people by school in search"}
          className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-line-strong"
        />
        <span className={cn("self-end font-mono text-[10px] tabular-nums", body.length > MAX - 50 ? "text-danger" : "text-faint")}>{body.length} / {MAX}</span>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-text-2">
        <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>The Forge team can contact me about this (they&apos;ll see my name)</span>
      </label>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent-grad inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-on-accent transition hover:-translate-y-px active:scale-95 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send feedback
      </button>
      <p className="text-[11px] text-faint">Only the Forge team sees your feedback. Unless you tick the box above, it&apos;s shared with the team without your name.</p>
    </form>
  );
}
