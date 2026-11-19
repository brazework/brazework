import { Building2 } from "lucide-react";
import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import { PLUS } from "@/lib/pricing";

// Companies that looked at your profile (supabase/money.sql my_company_viewers()): the last 7 days on
// Free, 90 with Plus. The database decides the window, so the limit isn't only in the page. Named by
// company, never by person. On Free, `hidden` is the real number of other verified companies from the
// last 90 days (plus-teaser.sql): one quiet line says so and links to Plus. With nothing hidden, no line.
export async function WhoLooked({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data, error } = await supabase.rpc("my_company_viewers", { p_days: 90 });
  if (error || !data) return null;
  const r = data as { days: number; plus: boolean; companies: { name: string; at: string }[]; hidden?: number };
  const hidden = r.plus ? 0 : (r.hidden ?? 0);
  const day = (ts: string) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <section aria-labelledby="who-looked" className="mt-8 rounded-2xl border border-line bg-surface p-5">
      <h2 id="who-looked" className="text-base font-semibold tracking-tight">Companies that looked <span className="font-normal text-muted">· last {r.days} days</span></h2>
      {r.companies.length ? (
        <ul className="mt-3 divide-y divide-line">
          {r.companies.map((c) => (
            <li key={c.name} className="flex items-center gap-3 py-2 text-sm">
              <Building2 className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <span className="text-xs text-faint">{day(c.at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No verified company has looked {r.days === 7 ? "this week" : `in the last ${r.days} days`}. Signed work is what they search for.</p>
      )}
      {hidden > 0 && (
        <p className="mt-3 text-sm text-muted">
          <b className="font-medium text-text tabular-nums">{hidden}</b> more {hidden === 1 ? "company" : "companies"} looked in the last 90 days.{" "}
          <Link href="/plus" className="font-medium text-text underline-offset-4 hover:underline">See who with {PLUS.name}</Link>
        </p>
      )}
    </section>
  );
}
