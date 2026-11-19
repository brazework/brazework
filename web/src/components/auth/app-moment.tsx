import { Check, FileSpreadsheet, MessageSquareText, Sparkles, X } from "lucide-react";
import { ProStamp } from "@/components/app/verified-seal";

// The log-in screen's picture: Brazework's one moment, drawn with the app's own pieces. A draft your
// AI left waits as a card (the same card Ember and your tools leave, components/copilot/proposal-card.tsx),
// and below it the same result on your record, signed by the person who saw it (the real ProStamp).
// A professional's story on purpose: the landing page already tells a club's. Example people; it's
// decorative (aria-hidden by the layout) and has no live buttons.
export function AppMoment() {
  return (
    <div className="relative mx-auto flex w-full max-w-[400px] flex-col gap-3">
      {/* What your AI drafted, waiting for you. */}
      <div className="grad-edge rounded-2xl p-4 text-sm shadow-[var(--shadow-float)]">
        <div className="flex items-center gap-2">
          <span className="bg-accent-grad grid size-7 place-items-center rounded-lg text-on-accent"><Sparkles className="size-4" /></span>
          <span className="font-semibold text-text">Add a result</span>
          <span className="ml-auto text-[11px] text-faint">Drafted by Claude</span>
        </div>
        <p className="mt-3 text-[15px] leading-snug font-medium text-text">New pricing tiers cut churn 9% in the 6-week pilot</p>
        <p className="mt-1 text-xs text-muted">On <span className="font-medium text-text-2">Q3 pricing model</span></p>
        <ul className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-text-2">
          <li className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5"><MessageSquareText className="size-3" /> The analysis, in Claude</li>
          <li className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5"><FileSpreadsheet className="size-3" /> pilot-results.xlsx</li>
        </ul>
        <div className="mt-3.5 flex items-center gap-2">
          <span className="bg-accent-grad inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium text-on-accent"><Check className="size-3.5" /> Confirm</span>
          <span className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs text-muted"><X className="size-3.5" /> Dismiss</span>
        </div>
      </div>

      {/* The same result, on your record, signed. */}
      <div className="ml-8 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-float)]">
        <p className="text-[15px] leading-snug font-semibold text-text">New pricing tiers cut churn 9% in the 6-week pilot</p>
        <p className="mt-0.5 text-xs text-muted">Q3 pricing model · Priya Shah</p>
        <ProStamp name="Dana Ruiz" title="Director of Product" employer="Northwind" note="I ran the pilot review. The 9% held across both cohorts." when="Nov 12" className="mt-3" />
      </div>
    </div>
  );
}
