import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";
import { AUDIENCES, tiersFor, type Audience, type Tier } from "@/lib/pricing";
import { SwipeControls } from "./swipe-controls";

// The price list (lib/pricing.ts): who it's for, then two or three tiers each. /pricing shows every audience;
// the landing page passes `only` and shows builders alone (lib/pricing.ts LANDING_AUDIENCES), with
// links to the rest. Each audience's heading is an anchor (/pricing#pricing-companies).
// Server-rendered, no state.
export function PricingTiers({ className, only, swipeOnMobile = false }: { className?: string; only?: Audience[]; swipeOnMobile?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-12", className)}>
      {AUDIENCES.filter((a) => !only || only.includes(a.id)).map((a) => {
        const tiers = tiersFor(a.id);
        const rowId = swipeOnMobile ? `landing-plans-${a.id}` : undefined;
        return <section key={a.id} aria-labelledby={`pricing-${a.id}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 id={`pricing-${a.id}`} className="scroll-mt-24 text-xl font-semibold tracking-tight">{a.label}</h3>
            <p className="text-[15px] text-muted">{a.line}</p>
          </div>
          {rowId && <SwipeControls rowId={rowId} count={tiers.length} hint="Swipe to compare plans" />}
          <div id={rowId} data-landing-pricing={swipeOnMobile || undefined} className={cn(
            "grid grid-cols-1 md:divide-x md:divide-line", tiers.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
            swipeOnMobile
              ? "landing-swipe-row mt-2 md:mt-4 md:overflow-hidden md:rounded-[1.25rem] md:border md:border-line md:bg-surface"
              : "mt-4 overflow-hidden rounded-[1.25rem] border border-line bg-surface",
          )}>
            {tiers.map((t, i) => <TierCard key={t.id} t={t} first={i === 0} swipeOnMobile={swipeOnMobile} />)}
          </div>
        </section>;
      })}
    </div>
  );
}

function TierCard({ t, first, swipeOnMobile }: { t: Tier; first: boolean; swipeOnMobile: boolean }) {
  return (
    <div className={cn("flex flex-col p-6 sm:p-8", swipeOnMobile ? "rounded-2xl border border-line bg-surface md:rounded-none md:border-0 md:bg-transparent" : !first && "border-t border-line md:border-t-0")}>
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-muted">{t.name}</h4>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{t.price}</p>
      <p className="mt-1 text-sm text-muted">{t.note}</p>
      <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-[15px] text-text-2">
        {t.points.map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-ok" />{x}</li>)}
      </ul>
      <Link href={t.cta.href} className={cn("mt-8 inline-flex h-11 items-center justify-center self-start rounded-lg px-5 text-[15px] font-medium transition", t.featured ? "bg-accent text-on-accent hover:opacity-90" : "border border-line-strong hover:bg-hover")}>{t.cta.label}</Link>
    </div>
  );
}
