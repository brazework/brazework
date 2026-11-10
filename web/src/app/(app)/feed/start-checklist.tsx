import { BadgeCheck, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { GuideStep } from "@/lib/guide";
import { cn } from "@/lib/forge";

// The first five minutes on Home, in the loop's order, until every step is done.
export function StartChecklist({ steps }: { steps: GuideStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (!steps.length || done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  return (
    <section aria-label="Get started" className="glass-card mb-4 rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <span className="bg-accent-grad grid size-9 shrink-0 place-items-center rounded-xl text-on-accent"><BadgeCheck className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Your first five minutes</h2>
          <p className="text-xs text-muted">Get one piece of your work verified by your club. {done} of {steps.length} done.</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Progress">
        <div className="bg-accent-grad h-full rounded-full transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 flex flex-col gap-1">
        {steps.map((s, i) => {
          const current = s.id === next.id;
          return (
            <li key={s.id}>
              <Link href={s.href} aria-current={current ? "step" : undefined} className={cn("flex items-start gap-3 rounded-2xl px-3 py-2.5 transition", current ? "bg-surface-2" : "hover:bg-hover")}>
                <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", s.done ? "bg-ok text-white" : current ? "bg-text text-bg" : "border border-line text-faint")}>
                  {s.done ? <Check className="size-3" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", s.done ? "text-muted line-through decoration-faint" : "font-medium text-text")}>{s.label}</span>
                  {current && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{s.why}</span>}
                </span>
                {current && <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint" />}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
