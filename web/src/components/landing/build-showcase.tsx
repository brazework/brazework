"use client";
import { Check } from "lucide-react";
import { useState } from "react";
import { ModelViewer } from "@/components/projects/model-viewer";
import { SAMPLES, type SampleId } from "@/components/projects/sample-models";
import { cn } from "@/lib/forge";

// "Show the build", to try: pick what you do and see an example of what you'd post, in the product's
// own 3D viewer (turn it, see through it, switch to the blueprint), with the kind of milestone that
// goes with it and who would sign it. Example models and results (sample-models.ts).
export function BuildShowcase() {
  const [id, setId] = useState<SampleId>("robot");
  const s = SAMPLES.find((x) => x.id === id)!;
  return (
    <div>
      {/* Every field the app offers. Laptop: they wrap. Phone: one row you swipe, so the model stays in view. */}
      <div role="tablist" aria-label="What do you build?" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {SAMPLES.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === id} aria-controls="build-example" onClick={() => setId(x.id)}
            className={cn("inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm whitespace-nowrap transition", x.id === id ? "border-transparent bg-accent font-medium text-on-accent" : "border-line bg-surface text-text-2 hover:border-line-strong")}>
            {x.field}
          </button>
        ))}
      </div>
      <div id="build-example" role="tabpanel" aria-label={s.field} className="mt-4 overflow-hidden rounded-[1.25rem] border border-line bg-surface shadow-[var(--shadow-float)]">
        {/* Keyed, so each example starts fresh: its own view, solid, parts together. */}
        <ModelViewer key={id} sample={id} name={s.name} className="aspect-[5/6] sm:aspect-[16/10]" />
        <div className="flex flex-col items-start gap-2.5 border-t border-line px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
          <p className="min-w-0 text-sm leading-snug sm:flex-1"><span className="font-semibold">{s.name}</span><span className="mt-0.5 block text-text-2">{s.milestone}</span></p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ok)_8%,var(--surface))] px-2.5 py-1 text-xs font-medium text-ok"><Check className="size-3.5" /> Verified by {s.by}</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-faint">Example builds and results. Your own files open the same way on your project page.</p>
    </div>
  );
}
