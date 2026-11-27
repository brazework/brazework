import { emberCreditCost } from "@/lib/ember-credits";
import type { Metadata } from "next";
import { Footer } from "@/components/landing/closing";
import { PricingTiers } from "@/components/landing/pricing";
import { H2 } from "@/components/landing/sections";
import { Nav } from "@/components/landing/nav";
import { ThemeChrome } from "@/components/theme-chrome";
import { CAMPUS_BANDS, EMBER_DAILY_LIMIT, EMBER_RESET, FOUNDING, SCHOOL, SPONSORSHIP, TALENT, departmentPrice, perStudent, seatsWhereCampusWins } from "@/lib/pricing";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const metadata: Metadata = {
  title: "Pricing",
  description: "Schools pay for a portal and their faculty seats. Students, clubs and the people who sign never pay.",
};

// /pricing: the whole price list (lib/pricing.ts), schools first (docs/strategy.md, 2026-11-26), then
// students and clubs (free), then companies. With the questions people ask about it. Static.
const QUESTIONS: [string, string][] = [
  ["What does a school pay?", `Start with a one-semester pilot for one department (${usd(SCHOOL.pilot)}, credited toward the first year). A department is ${usd(SCHOOL.department)} a year with ${SCHOOL.seatsIncluded} faculty seats and ${usd(SCHOOL.perSeat)} for each extra seat: 10 seats is ${usd(departmentPrice(10))}. A whole campus, with every department and unlimited faculty, is ${usd(CAMPUS_BANDS[0].price)} to ${usd(CAMPUS_BANDS[2].price)} a year by enrollment for founding schools; past ${seatsWhereCampusWins()} seats it costs less than a department. Never per student or per club, so nobody is kept off to save money.`],
  ["What is a founding school?", `One of the first ${FOUNDING.schools} campuses on Brazework. A founding school pays ${usd(CAMPUS_BANDS[0].price)}, ${usd(CAMPUS_BANDS[1].price)} or ${usd(CAMPUS_BANDS[2].price)} a year by enrollment, and that price is locked for ${FOUNDING.lockYears} years. After those places are taken, the list price is ${usd(CAMPUS_BANDS[0].list)}, ${usd(CAMPUS_BANDS[1].list)} or ${usd(CAMPUS_BANDS[2].list)}. At ${CAMPUS_BANDS[1].upTo.toLocaleString("en-US")} students the founding price is ${perStudent(CAMPUS_BANDS[1].upTo)} a student a year. The founders set a founding school up in person, and its requests shape what's built next.`],
  ["What's in a pilot?", `One department or a few classes, for one semester, for ${usd(SCHOOL.pilot)}. The founders set it up with you: your students and clubs join with their school email, faculty sign the work they saw, and at the end you get a report of what your students built and who signed it. Then you decide on the full campus with your own numbers, and the pilot is credited toward it.`],
  ["What about student privacy?", "Class work stays private to the class by default, and each student chooses what goes on their public record. A grade is seen only by its student and the course's staff, never on a profile; the school's offices see counts. Before any class data comes in, we sign a data agreement with the school (FERPA)."],
  ["Do students ever pay?", "No. A student's record, every signature, their clubs and being found by companies are free for good, with no ads. When they graduate they move the account to a personal email and keep everything."],
  ["How much Torch can I use?", `Free includes ${EMBER_DAILY_LIMIT.free} credits a day. A Torch message costs ${emberCreditCost("ask")}. Polishing a post, asking Torch in a group, summarizing a chat or organizing a project costs ${emberCreditCost("post")} each. Drafting or polishing a project write-up costs ${emberCreditCost("writeup")}. Web and iPhone share one balance. ${EMBER_RESET} Connecting your own AI has no extra Brazework charge. Your AI provider's plan and limits apply.`],
  ["Why do signatures matter?", "Anyone can type a claim. A milestone on Brazework is signed by someone who saw the work: a professor, a club's officers, a coworker. That's what a school can report and a company can trust."],
  ["Where does sponsorship money go?", `All of it. A chapter sponsorship goes to the club in full, for its builds, events and travel, and Brazework takes none of it. Sponsors pay a separate ${usd(SPONSORSHIP.serviceFee)} service fee for setup, coordination and reporting. A ${usd(SPONSORSHIP.chapter)} chapter sponsorship costs ${usd(SPONSORSHIP.chapter + SPONSORSHIP.serviceFee)} total. Challenge prizes start at ${usd(SPONSORSHIP.challengePrizes)}, plus the service fee (${usd(SPONSORSHIP.challengePrizes + SPONSORSHIP.serviceFee)} total), and go to the winners in full. Sponsors never choose whose work gets signed.`],
  ["How do companies start?", `Book a pilot: name your company and we reply within a day, to the email on your Brazework account. Starter is ${usd(TALENT.starter)} a year for one seat; the ${usd(TALENT.plan)} plan covers ${TALENT.planSeats} search and messaging seats. Sponsorships and challenges are separate. We confirm the scope and payment terms before anything is charged.`],
];

export default function PricingPage() {
  return (
    <div className="landing min-h-dvh">
      <ThemeChrome landing />
      <Nav />
      <main className="mx-auto max-w-6xl px-5 pt-[calc(env(safe-area-inset-top)+7.5rem)] pb-24 sm:px-6 sm:pt-36">
        <h1 className={H2}>Schools pay.<br className="hidden sm:block" /> Students and clubs never do.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">A school pays for the portal its faculty and offices use: verified student projects, club reports and a showcase of what its students build. Every student and every club is included. Companies pay for their own tools.</p>
        <PricingTiers className="reveal mt-14" />
        <section aria-labelledby="pricing-questions" className="reveal mt-20 max-w-3xl">
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
