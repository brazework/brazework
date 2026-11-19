"use client";
import { ArrowRight, BadgeCheck, FileText, Plug, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";
import { CONNECT_LABEL, PLAYBOOKS, playbookFor, type Connect } from "@/lib/mcp-playbooks";

const TONE: Record<Connect, string> = { official: "bg-ok/12 text-ok", community: "bg-info/12 text-info", files: "bg-surface-2 text-muted" };
const BECOMES = { milestone: "Milestone", result: "Result post", update: "Build update" } as const;
const COMMANDS = [
  { cmd: "/start", what: "your first minute → your first milestone, from real work" },
  { cmd: "/shipped", what: "finished work → a milestone with its proof" },
  { cmd: "/result", what: "a number → a result post" },
  { cmd: "/week", what: "your week → the 1–3 things worth recording" },
  { cmd: "/ask_signature", what: "ask the person who saw it to sign" },
];

// Recipes for your field (docs/mcp-workflows.md): the same playbooks the MCP server serves to your
// assistant, shown here so you can see what it will do before you connect anything.
export function FieldRecipes({ initialField }: { initialField: string }) {
  const [id, setId] = useState(playbookFor(initialField)?.id ?? PLAYBOOKS[0].id);
  const p = PLAYBOOKS.find((x) => x.id === id) ?? PLAYBOOKS[0];
  return (
    <section aria-label="Recipes for your field" className="border border-line bg-surface rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Recipes for your field</h2>
          <p className="mt-0.5 text-sm text-muted">The tools you already use, and the moments your assistant turns into your record.</p>
        </div>
        <label className="text-sm">
          <span className="sr-only">Field</span>
          <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Field" className="h-9 rounded-lg border border-line bg-surface pr-8 pl-3 text-sm">
            {PLAYBOOKS.map((x) => <option key={x.id} value={x.id}>{x.field}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><Plug className="size-3.5" /> Your tools</p>
          <ul className="mt-2 space-y-2">
            {p.tools.map((t) => (
              <li key={t.name} className="text-sm">
                <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.name}</span><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[t.connect])}>{CONNECT_LABEL[t.connect]}</span></span>
                <span className="mt-0.5 block text-xs text-muted">{t.reads}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><Sparkles className="size-3.5" /> Moments worth recording</p>
          <ul className="mt-2 space-y-3">
            {p.moments.map((m) => (
              <li key={m.example} className="rounded-2xl border border-line p-3 text-sm">
                <p className="text-text-2">{m.when}</p>
                <p className="mt-1.5 flex items-start gap-1.5 font-medium">{m.becomes === "milestone" ? <BadgeCheck className="mt-0.5 size-4 shrink-0 text-ok" /> : <FileText className="mt-0.5 size-4 shrink-0 text-muted" />}<span><span className="text-muted">{BECOMES[m.becomes]}:</span> &ldquo;{m.example}&rdquo;</span></p>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-muted"><ArrowRight className="mt-0.5 size-3 shrink-0" />Proof: {m.evidence}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted"><Users className="mt-0.5 size-3.5 shrink-0" />Who signs: {p.signers}.</p>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-xs font-medium text-muted">In your assistant</p>
        <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
          {COMMANDS.map((c) => <li key={c.cmd} className="text-text-2"><code className="font-mono text-[13px] text-text">{c.cmd}</code> {c.what}</li>)}
        </ul>
        <p className="mt-3 text-xs text-muted">In Claude Code they&apos;re <code className="font-mono">/mcp__brazework__shipped</code> and so on; other assistants list them under Brazework. Community servers are written by other people: read one before you install it.</p>
      </div>
    </section>
  );
}
