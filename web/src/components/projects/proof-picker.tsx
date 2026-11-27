"use client";
import { AlertTriangle, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { proofSource } from "@/lib/proof-source";
import { cleanLink, MAX_PROOF_LINKS, toolForSource, toolsForField, type ProofTool } from "@/lib/proof-tools";
import { checkProofLink } from "@/lib/proof-check-action";
import type { ProofCheck } from "@/lib/proof-check";

type Card = { url: string; check: ProofCheck | "checking" };

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

// "Add proof" (Linear FIX-235): the tools the member's field builds with, then one box to paste a link
// from any of them. Each link becomes a card that says what it is, its real title when the tool tells us,
// and a warning when it looks closed to the person who'll sign. Inside a form, the box is
// `input[name=<name>]` and the cards ride along in `<name>More` (lib/proof-tools.ts evidenceLinks reads
// both), so a link typed and never turned into a card still counts. `onLinks` gives every link, for
// pages that keep their own state (the first-build wizard).
export function ProofPicker({ field, name = "evidence", label = "Proof", hint, max = MAX_PROOF_LINKS, required = false, autoFocus = false, initial = [], onLinks }: {
  field?: string | null; name?: string; label?: string; hint?: React.ReactNode; max?: number; required?: boolean; autoFocus?: boolean; initial?: string[]; onLinks?: (links: string[]) => void;
}) {
  const id = useId();
  const box = useRef<HTMLInputElement>(null);
  const [cards, setCards] = useState<Card[]>(() => initial.map(cleanLink).filter(Boolean).slice(0, max).map((url) => ({ url, check: {} })));
  const [text, setText] = useState("");
  const [active, setActive] = useState<ProofTool | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const { first, more: rest } = toolsForField(field);
  const full = cards.length >= max;

  const typed = cleanLink(text);
  const links = [...new Set([...cards.map((c) => c.url), ...(typed ? [typed] : [])])].slice(0, max);
  const key = links.join(" ");
  const report = useRef(onLinks);
  useEffect(() => { report.current = onLinks; });
  useEffect(() => { report.current?.(key ? key.split(" ") : []); }, [key]);

  const add = (raw: string) => {
    const url = cleanLink(raw);
    if (!url) { setError("That doesn't look like a link. Paste the address from your tool's Share button."); return false; }
    setError("");
    setText("");
    if (cards.some((c) => c.url === url)) return true;
    if (full) { setError(`Up to ${max} links.`); return false; }
    setCards((cs) => [...cs, { url, check: "checking" }]);
    checkProofLink(url).then((check) => setCards((cs) => cs.map((c) => (c.url === url ? { ...c, check } : c))), () => setCards((cs) => cs.map((c) => (c.url === url ? { ...c, check: {} } : c))));
    return true;
  };
  const pickTool = (t: ProofTool) => { setActive((a) => (a?.id === t.id ? null : t)); box.current?.focus(); };
  const tip = active?.share;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text-2">{label}</label>
      <div role="group" aria-label="Where your proof is" className="flex flex-wrap gap-1.5">
        {[...first, ...(more ? rest : [])].map((t) => (
          <button key={t.id} type="button" aria-pressed={active?.id === t.id} onClick={() => pickTool(t)}
            className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-text-2 transition hover:border-line-strong hover:text-text aria-pressed:border-accent aria-pressed:text-text aria-pressed:ring-[3px] aria-pressed:ring-accent/15">
            {t.name}
          </button>
        ))}
        {!more && <button type="button" onClick={() => setMore(true)} className="h-8 rounded-lg px-2 text-xs font-medium text-muted underline-offset-4 hover:text-text hover:underline">More tools</button>}
      </div>

      {cards.length > 0 && (
        <ul aria-label="Proof added" className="flex flex-col gap-1.5">
          {cards.map((c) => {
            const src = proofSource(c.url);
            const what = src?.label ?? hostOf(c.url);
            const check = c.check === "checking" ? null : c.check;
            const share = toolForSource(src?.tool)?.share;
            return (
              <li key={c.url} className={cn("rounded-lg border bg-surface px-3 py-2", check?.closed ? "border-amber-500/50" : "border-line")}>
                <div className="flex items-start gap-2">
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-sm font-medium text-text hover:underline">{check?.title ?? what}</a>
                    <span className="block truncate text-xs text-muted">{check?.title ? `${what} · ` : ""}{hostOf(c.url)}{c.check === "checking" && <> · <Loader2 aria-hidden className="inline size-3 animate-spin align-[-2px]" /> checking</>}</span>
                  </div>
                  <button type="button" aria-label={`Remove ${what}`} onClick={() => setCards((cs) => cs.filter((x) => x.url !== c.url))} className="grid size-7 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-3.5" /></button>
                </div>
                {check?.closed && (
                  <p role="status" className="mt-1.5 flex items-start gap-1.5 text-xs text-text-2">
                    <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-500" />
                    <span>This looks private, so the person signing may not be able to open it.{share ? ` ${share}` : ""}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!full && (
        <div className="flex gap-2">
          <input ref={box} id={id} name={name} value={text} autoFocus={autoFocus} required={required && cards.length === 0} type="text" inputMode="url" autoComplete="off" spellCheck={false} maxLength={300}
            placeholder={active ? active.example : cards.length ? "Add another link" : "Paste a link from any tool: https://…"}
            onChange={(e) => { setText(e.target.value); if (error) setError(""); }}
            onPaste={(e) => { const v = e.clipboardData.getData("text"); if (cleanLink(v) && !text.trim()) { e.preventDefault(); add(v); } }}
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { e.preventDefault(); add(text); } }}
            aria-describedby={`${id}-hint`} className={cn(inputCls, "min-w-0 flex-1")} />
          {typed && max > 1 && <button type="button" onClick={() => add(text)} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-text-2 hover:bg-hover"><Plus className="size-4" /> Add</button>}
        </div>
      )}
      {/* Cards travel with the form; the box's own value is read too. */}
      <input type="hidden" name={`${name}More`} value={JSON.stringify(cards.map((c) => c.url))} />
      {error ? <span role="alert" className="text-xs text-danger">{error}</span>
        : <span id={`${id}-hint`} className="text-xs text-faint">{tip ?? hint ?? "Paste it here and it's checked as you add it. Make sure the person signing can open it."}{max > 1 && cards.length > 0 ? ` ${cards.length} of ${max}.` : ""}</span>}
    </div>
  );
}
