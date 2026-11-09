"use client";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ember } from "@/components/ember/ember";
import { cn } from "@/lib/forge";
import { applyOrganize, organizeProject } from "@/lib/organize";

// The owner asks Ember to organize the project; Ember suggests a stack and topics, the owner keeps
// what's right (tap to drop) and applies.
export function OrganizeWithEmber({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [s, setS] = useState<{ tools: string[]; topics: string[]; note: string } | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const ask = () => start(async () => {
    setMsg("");
    const r = await organizeProject(projectId);
    if (!r.ok) { setMsg(r.message); return; }
    setS({ tools: r.tools ?? [], topics: r.topics ?? [], note: r.message });
    setKeep(new Set([...(r.tools ?? []), ...(r.topics ?? []).map((t) => `#${t}`)]));
  });
  const apply = () => start(async () => {
    const r = await applyOrganize(projectId, s!.tools.filter((t) => keep.has(t)), s!.topics.filter((t) => keep.has(`#${t}`)));
    setMsg(r.message);
    if (r.ok) { setS(null); router.refresh(); }
  });
  const chip = (k: string, label: string) => (
    <button key={k} type="button" aria-pressed={keep.has(k)} onClick={() => setKeep((v) => { const n = new Set(v); if (n.has(k)) n.delete(k); else n.add(k); return n; })} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition", keep.has(k) ? "border-transparent bg-surface-2 font-medium" : "border-dashed border-line text-faint line-through")}>
      {keep.has(k) && <Check className="size-3" />} {label}
    </button>
  );
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-line-strong p-4">
      {!s ? (
        <div className="flex flex-wrap items-center gap-3">
          <Ember size={32} mood={pending ? "thinking" : "idle"} />
          <span className="min-w-0 flex-1 text-sm"><span className="font-medium">Organize with Ember</span><span className="block text-xs text-muted">Ember reads your write-up and suggests the stack and topics.</span></span>
          <button type="button" onClick={ask} disabled={pending} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent disabled:opacity-60">{pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Reading…" : "Organize"}</button>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium">Ember suggests</p>
          {s.note && <p className="mt-0.5 text-xs text-muted">{s.note}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">{s.tools.map((t) => chip(t, t))}{s.topics.map((t) => chip(`#${t}`, `#${t}`))}</div>
          {!s.tools.length && !s.topics.length && <p className="mt-2 text-xs text-muted">Nothing to suggest yet. Add a write-up first.</p>}
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={apply} disabled={pending || !keep.size} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent disabled:opacity-50">{pending && <Loader2 className="size-4 animate-spin" />} Apply</button>
            <button type="button" onClick={() => setS(null)} className="h-9 rounded-full px-3 text-sm text-muted hover:text-text">Cancel</button>
            <span className="text-[11px] text-faint">Tap a suggestion to drop it. Replaces the current stack.</span>
          </div>
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
