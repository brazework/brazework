import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/landing/closing";
import { PricingTiers } from "@/components/landing/pricing";
import { H2 } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { Logo } from "@/components/ui";
import { EMBER_ALLOWANCE, PLUS, SCHOOL, SPONSORSHIP, schoolPrice } from "@/lib/pricing";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free for the people who build, and for their clubs. Companies pay to find builders by work someone signed.",
};

// /pricing: the whole price list (lib/pricing.ts): builders, as on the landing page, plus what
// companies, clubs and schools pay, which the landing page links here for. With the questions
// people ask about it. Static.
const QUESTIONS: [string, string][] = [
  ["Is Ember included?", `${EMBER_ALLOWANCE}. Free and Plus currently have the same allowance. Connecting your own AI has no extra Brazework charge; your AI provider’s subscription and limits still apply.`],
  ["Is the free plan really free?", "Yes. Your record, every signature, your clubs, and being found by companies are free for good, with no ads. Companies pay so builders don't have to."],
  [`What is ${PLUS.name}?`, `An optional upgrade led by review packets: signed work ready for a performance review or promotion. Review packets are free for everyone during launch. Professional Plus is $${PLUS.everyoneYear}/year or $${PLUS.everyone}/month; students pay $${PLUS.studentYear}/year or $${PLUS.student}/month. Plus also shows every company that looked in the last 90 days. Custom profile links, PDF portfolios and more AI drafts from your tools are coming soon. Join the waitlist while paid plans are being set up. Nothing in Free moves to Plus.`],
  ["Why do signatures matter?", "Anyone can type a claim. A milestone on Brazework is signed by someone who saw the work: a club's officers, a professor, a manager. That's what a company can trust."],
  ["What do schools pay?", `A flat ${usd(SCHOOL.portal)} a year for the school's portal with ${SCHOOL.seatsIncluded} advisor seats, then ${usd(SCHOOL.perAdvisor)} a year for each extra advisor: a campus with 8 advisors pays ${usd(schoolPrice(8))}. Never per club, so every club stays free and welcome. The first 10 schools get their first semester free. National networks are priced with the founders.`],
  ["Where does sponsorship money go?", `All of it. A chapter sponsorship goes to the club in full, for its builds, events and travel, and Brazework takes none of it. Sponsors pay a separate ${usd(SPONSORSHIP.serviceFee)} service fee for setup, coordination and reporting. A ${usd(SPONSORSHIP.chapter)} chapter sponsorship costs ${usd(SPONSORSHIP.chapter + SPONSORSHIP.serviceFee)} total. Challenge prizes start at ${usd(SPONSORSHIP.challengePrizes)}, plus the service fee (${usd(SPONSORSHIP.challengePrizes + SPONSORSHIP.serviceFee)} total). We also earn from search seats and school portals. A challenge's prizes go to the winners in full too. Sponsors never choose whose work gets signed.`],
  ["How do companies start?", "Book a pilot: name your company and we reply within a day, to the email on your Brazework account. The $15,000 annual plan covers two search and messaging seats. Sponsorships and challenges are separate. We confirm the scope and payment terms before anything is charged."],
];

export default function PricingPage() {
  return (
    <div className="landing min-h-dvh">
      <ThemeChrome landing />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
        <Link href="/" aria-label="Brazework home"><Logo /></Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 text-muted hover:text-text">Log in</Link>
          <Link href="/signup" className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 font-medium text-on-accent hover:opacity-90">Sign up free</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-6 sm:pt-16">
        <h1 className={H2}>Free for the people who build.<br className="hidden sm:block" /> Upgrade when it helps.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">Your record is yours, and free forever. Clubs are free. Plus helps professionals prepare for reviews. Companies, networks and schools pay for their own tools.</p>
        <PricingTiers className="mt-14" />
        <section aria-labelledby="pricing-questions" className="mt-20 max-w-3xl">
          <h2 id="pricing-questions" className="text-2xl font-semibold tracking-tight">Questions</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {QUESTIONS.map(([q, a]) => (
              <div key={q} className="py-5">
                <dt className="font-medium">{q}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <Footer />
    </div>
  );
}
