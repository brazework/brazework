"use client";
import { ArrowRight, Check, GraduationCap, Loader2, Lock, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { Panel } from "@/components/app/page-ui";
import { cn } from "@/lib/forge";
import { startChapter, type Network } from "@/lib/chapters";

// Two choices and a preview: which national organization, and whether people join straight away or
// ask first. The name is made from both ("NSBE - University of Hartford").
export function ChapterForm({ school, networks }: { school: string; networks: Network[] }) {
  const [network, setNetwork] = useState(networks[0].id);
  const [privacy, setPrivacy] = useState<"public" | "approval">("approval");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const picked = networks.find((n) => n.id === network) ?? networks[0];
  const name = `${picked.short} - ${school}`;

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => { const r = await startChapter(network, privacy); if (r && !r.ok) setError(r.message); }); }} className="flex flex-col gap-4">
      <Panel className="p-5 sm:p-6">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-faint uppercase"><GraduationCap className="size-3.5" /> Your school</p>
        <p className="mt-1.5 text-lg font-semibold tracking-tight">{school}</p>
        <p className="text-xs text-muted">From your school email.</p>

        <fieldset className="mt-6">
          <legend className="text-xs font-medium tracking-wide text-faint uppercase">National organization</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
            {networks.map((n) => (
              <label key={n.id} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition", network === n.id ? "border-text bg-surface shadow-[var(--shadow)]" : "border-line hover:border-line-strong")}>
                <input type="radio" name="network" value={n.id} checked={network === n.id} onChange={() => setNetwork(n.id)} className="sr-only" />
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-text text-sm font-bold text-surface">{n.short.slice(0, 4)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{n.name}</span></span>
                {network === n.id && <Check className="size-4 shrink-0" />}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-xs font-medium tracking-wide text-faint uppercase">Who can join</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([["approval", Lock, "Ask first", "You approve each request. Invite links skip the wait."], ["public", Users, "Open", "Anyone at Brazework can join."]] as const).map(([v, Icon, title, line]) => (
              <label key={v} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition", privacy === v ? "border-text bg-surface shadow-[var(--shadow)]" : "border-line hover:border-line-strong")}>
                <input type="radio" name="privacy" value={v} checked={privacy === v} onChange={() => setPrivacy(v)} className="sr-only" />
                <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
                <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted">{line}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      <Panel className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-faint">Your chapter</p>
          <p className="truncate text-base font-semibold" aria-label="Chapter name">{name}</p>
        </div>
        <button type="submit" disabled={pending} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-text px-5 text-sm font-semibold text-surface transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Start the chapter <ArrowRight className="size-4" />
        </button>
      </Panel>
      {error && <p role="alert" className="px-1 text-sm text-danger">{error}</p>}
    </form>
  );
}
