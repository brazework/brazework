import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";
import { AUDIENCES, tiersFor, type Tier } from "@/lib/pricing";

// The price list (lib/pricing.ts), the same on the landing page and /pricing: who it's for, then two
// tiers each. Server-rendered, no state.
export function PricingTiers({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-12", className)}>
      {AUDIENCES.map((a) => (
        <section key={a.id} aria-labelledby={`pricing-${a.id}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 id={`pricing-${a.id}`} className="text-xl font-semibold tracking-tight">{a.label}</h3>
            <p className="text-[15px] text-muted">{a.line}</p>
          </div>
          <div className="mt-4 grid grid-cols-1 overflow-hidden rounded-[1.25rem] border border-line bg-surface md:grid-cols-2 md:divide-x md:divide-line">
            {tiersFor(a.id).map((t, i) => <TierCard key={t.id} t={t} first={i === 0} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function TierCard({ t, first }: { t: Tier; first: boolean }) {
  return (
    <div className={cn("flex flex-col p-6 sm:p-8", !first && "border-t border-line md:border-t-0")}>
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
