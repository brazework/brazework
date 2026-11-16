"use client";
import { Check, RotateCcw, Search } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Ember } from "@/components/ember/ember";
import { cn } from "@/lib/forge";
import { EMBER_ASKS, typedSoFar, type EmberAsk } from "@/lib/landing-demo";

// Ember, to try: pick a request and watch what it does in the app. It checks real data first, writes
// its answer, and puts what it wants to do on a card that waits for your OK. Nothing here calls a
// model: the three conversations are written out (lib/landing-demo.ts) and the page says "example".
export function EmberDemo() {
  const [pick, setPick] = useState<EmberAsk | null>(null);
  const [runs, setRuns] = useState(0);
  const ask = (a: EmberAsk) => { setPick(a); setRuns((n) => n + 1); };
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-line bg-surface shadow-[var(--shadow-float)]">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Ember size={24} mood={pick ? "happy" : "idle"} />
        <p className="text-sm font-semibold">Ember</p>
        <p className="ml-auto text-xs text-faint">Example conversation</p>
      </div>
      <div className="flex h-[25rem] flex-col justify-end gap-3 overflow-hidden p-4 sm:h-[23rem] sm:p-5">
        {pick ? <Turn key={runs} a={pick} /> : (
          <div className="my-auto flex flex-col items-center text-center">
            <Ember size={56} />
            <p className="mt-4 text-[15px] font-medium">Ask Ember something</p>
            <p className="mt-1 max-w-xs text-sm text-muted">It looks things up in your Brazework first, and never posts without your OK.</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line bg-surface-2/50 px-4 py-3">
        {EMBER_ASKS.map((a) => (
          <button key={a.id} type="button" onClick={() => ask(a)} aria-pressed={pick?.id === a.id}
            className={cn("inline-flex min-h-9 items-center rounded-lg border px-3 py-1.5 text-left text-sm transition", pick?.id === a.id ? "border-text bg-surface font-medium" : "border-line bg-surface text-text-2 hover:border-line-strong")}>
            {a.ask}
          </button>
        ))}
        {pick && <button type="button" onClick={() => setPick(null)} aria-label="Clear the conversation" className="ml-auto grid size-9 place-items-center rounded-lg text-muted transition hover:bg-hover hover:text-text"><RotateCcw className="size-4" /></button>}
      </div>
    </div>
  );
}

// One exchange: the question, what Ember checked, its answer written out, then the card.
function Turn({ a }: { a: EmberAsk }) {
  const reduce = useReducedMotion();
  const [chars, setChars] = useState(0);
  const [done, setDone] = useState(false);
  const full = reduce || chars >= a.reply.length;
  useEffect(() => {
    if (full) return;
    const t = setTimeout(() => setChars((c) => c + 3), chars === 0 ? 650 : 22);
    return () => clearTimeout(t);
  }, [chars, full]);
  return (
    <>
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-accent px-3.5 py-2 text-[15px] leading-snug text-on-accent">{a.ask}</p>
      <div className="max-w-[92%]" aria-live="polite">
        <p className="flex items-center gap-1.5 text-xs text-muted"><Search className="size-3.5" /> Checked {a.checked}</p>
        {/* The whole reply holds the space from the start, so nothing below it moves while it's written. */}
        <p className="relative mt-1.5 text-[15px] leading-snug">
          <span aria-hidden={!full} className={full ? undefined : "invisible"}>{a.reply}</span>
          {!full && <span className="absolute inset-0">{typedSoFar(a.reply, chars)}</span>}
        </p>
        <div className={cn("mt-3 rounded-xl border border-line bg-surface-2/60 p-3.5 transition duration-500", full ? "opacity-100" : "translate-y-1 opacity-0")} inert={!full}>
          <p className="text-sm font-semibold">{a.card.title}</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm text-text-2">{a.card.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <div className="mt-3 flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {done
              ? <p className="flex items-center gap-1.5 text-sm font-medium text-ok"><Check className="size-4" /> {a.done}</p>
              : <><button type="button" onClick={() => setDone(true)} className="inline-flex h-9 shrink-0 items-center rounded-lg bg-accent px-3.5 text-sm font-medium whitespace-nowrap text-on-accent transition hover:opacity-90">{a.action}</button><span className="text-xs text-muted">Nothing happens until you press it</span></>}
          </div>
        </div>
      </div>
    </>
  );
}
