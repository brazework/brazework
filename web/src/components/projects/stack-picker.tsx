"use client";
import { Check, Plus, Search, Wand2, X } from "lucide-react";
import { useState } from "react";
import { STACK_CATEGORIES, TOOLS, toolsInText, type StackCategory } from "@/lib/stack";
import { cn } from "@/lib/forge";

const MAX = 12;

// "Built with": pick the tools behind a project from a catalog that spans STEM (software, electronics,
// CAD, lab, simulation, fabrication), add your own, or pull the ones your write-up already mentions.
// Sends them as hidden "tools" inputs with the project form.
export function StackPicker({ value, onChange, text = "" }: { value: string[]; onChange: (v: string[]) => void; text?: string }) {
  const [cat, setCat] = useState<StackCategory>("software");
  const [q, setQ] = useState("");
  const [hint, setHint] = useState("");
  const full = value.length >= MAX;
  const toggle = (name: string) => onChange(value.includes(name) ? value.filter((v) => v !== name) : full ? value : [...value, name]);
  const needle = q.trim().toLowerCase();
  const shown = needle ? TOOLS.filter((t) => t.name.toLowerCase().includes(needle) || t.what.toLowerCase().includes(needle)) : TOOLS.filter((t) => t.cat === cat);
  const custom = q.trim() && !TOOLS.some((t) => t.name.toLowerCase() === needle) && !value.some((v) => v.toLowerCase() === needle) ? q.trim().slice(0, 40).replace(/[<>]/g, "") : "";
  const suggest = () => {
    const found = toolsInText(text).filter((t) => !value.includes(t));
    if (!found.length) { setHint("No catalog tools named in your summary or write-up yet."); return; }
    onChange([...value, ...found].slice(0, MAX));
    setHint(`Added ${found.slice(0, MAX - value.length).join(", ")}.`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {value.map((t) => <input key={t} type="hidden" name="tools" value={t} />)}
      <div className="flex items-baseline gap-2 text-sm font-medium text-text-2">
        Built with <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-normal tracking-wide text-faint uppercase">Optional</span>
        <span className="ml-auto font-mono text-[11px] font-normal text-faint tabular-nums">{value.length}/{MAX}</span>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <button key={t} type="button" onClick={() => toggle(t)} aria-label={`Remove ${t}`} className="bg-accent-grad inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-on-accent">{t} <X className="size-3" /></button>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (custom && !full) { onChange([...value, custom]); setQ(""); } } }} placeholder="Search tools, or type your own and press Enter" aria-label="Search tools" className="h-9 w-full rounded-xl border border-line bg-surface/70 pr-3 pl-8 text-sm outline-none focus:border-text" />
        </div>
        {!needle && (
          <div role="tablist" aria-label="Tool categories" className="no-scrollbar -mx-1 mt-2 flex gap-1 overflow-x-auto px-1">
            {STACK_CATEGORIES.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition", cat === c.id ? "bg-text text-bg" : "text-muted hover:bg-hover hover:text-text")}>
                <c.icon className="size-3.5" /> {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {shown.map((t) => {
            const on = value.includes(t.name);
            return (
              <button key={t.name} type="button" aria-pressed={on} title={t.what} disabled={!on && full} onClick={() => toggle(t.name)} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-40", on ? "border-transparent bg-surface-2 font-medium text-text" : "border-line text-text-2 hover:border-line-strong")}>
                {on && <Check className="size-3" />} {t.name}
              </button>
            );
          })}
          {custom && <button type="button" disabled={full} onClick={() => { onChange([...value, custom]); setQ(""); }} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs text-text-2"><Plus className="size-3" /> Add “{custom}”</button>}
          {!shown.length && !custom && <span className="text-xs text-muted">No tools match.</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={suggest} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-text-2 transition hover:bg-hover"><Wand2 className="size-3.5" /> Suggest from my write-up</button>
        {hint ? <span role="status" className="text-xs text-muted">{hint}</span> : <span className="text-xs text-faint">Hover a tool to see what it&apos;s for. Others can find your project by its tools.</span>}
      </div>
    </div>
  );
}
