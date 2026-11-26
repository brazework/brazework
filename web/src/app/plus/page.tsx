import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/landing/closing";
import { ThemeChrome } from "@/components/theme-chrome";
import { Logo } from "@/components/ui";
import { PLUS_STUDENT_ANNUAL_PRICE_ENV, plusOnSale, plusPriceEnv, plusYearlyOnSale } from "@/lib/billing";
import { dbFeatures } from "@/lib/db-features";
import { EMBER_DAILY_LIMIT, PLUS, PLUS_SOON, PLUS_TIER } from "@/lib/pricing";
import { getViewer } from "@/lib/supabase/server";
import { PlusButton } from "./plus-button";

export const metadata: Metadata = { title: "Plus", description: "Your signed work, ready for a performance review or a promotion case, and every company that looked in the last 90 days. Free stays free." };

// /plus: what Plus adds, and the one button. On sale (Stripe on and STRIPE_PRICE_PLUS set), it goes
// to checkout; until then it takes a place on the waitlist (lib/money.ts startPlus()).
export default function PlusPage({ searchParams }: PageProps<"/plus">) {
  return (
    <div className="landing min-h-dvh">
      <ThemeChrome landing />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
        <Link href="/" aria-label="Brazework home"><Logo /></Link>
        <Link href="/pricing" className="text-sm text-muted hover:text-text">Pricing</Link>
      </header>
      <main className="mx-auto max-w-xl px-5 pt-8 pb-24 sm:px-6">
        <Suspense fallback={<div className="h-96 shimmer rounded-3xl" aria-busy="true" />}>
          <Plus searchParams={searchParams} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

// The before/after for what Plus does today (lib/pricing.ts), labelled as an example; the member's own
// numbers are on their dashboard. What's coming is listed as coming, never sold as built (PLUS_SOON).
const DIFF = [
  { what: "Your review packet", free: "Your self-review, written from memory the week it's due.", plus: "12 signed results from January to June on one page, each with who signed it and their role." },
  { what: "Companies that looked", free: "This week: Acme Robotics. 3 more companies looked in the last 90 days.", plus: "All 90 days, by name: Acme Robotics, Northwind Aero, Hartwell Labs, Quarry Systems." },
];

async function Plus({ searchParams }: { searchParams: PageProps<"/plus">["searchParams"] }) {
  const welcome = (await searchParams).welcome === "1";
  const { supabase, user, profile } = await getViewer();
  const has = user && (await dbFeatures()).money ? Boolean((await supabase.rpc("has_plus")).data) : false;
  const onSale = plusOnSale();
  const studying = profile?.account_type === "student";
  const student = studying && (await supabase.rpc("student_plus_eligible")).data === true;
  const yearly = onSale && (student
    ? plusPriceEnv({ student, yearly: true }) === PLUS_STUDENT_ANNUAL_PRICE_ENV
    : plusYearlyOnSale());
  const tier = PLUS_TIER;
  return (
    <>
      <h1 className="text-[clamp(2rem,5vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.03em]">{PLUS.name}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">Your signed work, ready for your next review or promotion, and every company that looked. Plus also includes {EMBER_DAILY_LIMIT.plus} Jig credits a day.</p>
      <section className="mt-8 rounded-[1.25rem] border border-line bg-surface p-6 sm:p-8">
        <p className="text-3xl font-semibold tracking-tight">{tier.price}</p>
        <p className="mt-1 text-sm text-muted">{tier.note}</p>
        <ul className="mt-6 flex flex-col gap-2.5 text-[15px] text-text-2">
          {tier.points.map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-ok" />{x}</li>)}
        </ul>
        <div className="mt-8">
          {has ? (
            <p role="status" className="flex items-start gap-2 text-[15px]"><Check className="mt-0.5 size-4 shrink-0 text-ok" /> {welcome ? "Welcome to Plus. It's on your account now." : "You have Plus."} <Link href="/dashboard" className="font-medium underline-offset-4 hover:underline">See who looked</Link></p>
          ) : user ? (
            yearly ? (
              <div className="flex flex-wrap gap-3">
                <PlusButton yearly label={`Get ${PLUS.name} for a year, $${student ? PLUS.studentYear : PLUS.everyoneYear}`} />
                <PlusButton quiet label={`Monthly, $${student ? PLUS.student : PLUS.everyone}/mo`} />
              </div>
            ) : (
              <PlusButton label={onSale ? `Get ${PLUS.name}` : "Join the waitlist"} />
            )
          ) : (
            <Link href="/login?next=/plus" className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-[15px] font-medium text-on-accent hover:opacity-90">{onSale ? `Log in to get ${PLUS.name}` : "Log in to join the waitlist"}</Link>
          )}
          {!has && studying && !student && (
            <p className="mt-3 text-sm text-muted">Student pricing requires a confirmed school email. <Link href="/settings#school-email" className="font-medium text-text underline underline-offset-4">Switch to your school email</Link></p>
          )}
          {!has && !onSale && <p className="mt-3 text-sm text-muted">{PLUS.name} opens soon. Join the waitlist and we&apos;ll email you, at the launch price.</p>}
          {!has && onSale && <p className="mt-3 text-sm text-muted">Cancel anytime, from Settings. Your record stays yours either way.</p>}
        </div>
      </section>

      <section aria-labelledby="plus-diff" className="mt-10">
        <h2 id="plus-diff" className="text-lg font-semibold tracking-tight">What {PLUS.name} shows you</h2>
        <p className="mt-1 text-xs text-faint">Examples</p>
        <dl className="mt-4 flex flex-col gap-3">
          {DIFF.map((d) => (
            <div key={d.what} className="rounded-2xl border border-line bg-surface p-4">
              <dt className="text-sm font-medium">{d.what}</dt>
              <dd className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-muted"><span className="block text-[11px] font-medium tracking-wide text-faint">Free</span>{d.free}</p>
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-text"><span className="block text-[11px] font-medium tracking-wide text-ok">{PLUS.name}</span>{d.plus}</p>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted">Coming to {PLUS.name}: {PLUS_SOON.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(", ")}. They join your plan when they ship, at the same price.</p>
      </section>

      <section aria-labelledby="plus-free" className="mt-10 rounded-2xl border border-line p-5">
        <h2 id="plus-free" className="text-base font-semibold tracking-tight">Free stays free, forever</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Logging your work, asking anyone who saw it to sign, your profile, your clubs, your AI agent and being found by companies never go behind a paywall. Signatures are the point of Brazework, so they&apos;re never for sale.</p>
      </section>
    </>
  );
}
