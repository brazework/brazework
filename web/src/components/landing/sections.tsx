import { ArrowRight, BadgeCheck, Building2, Users } from "lucide-react";
import Link from "next/link";

// The landing page's short sections (redesign 2026-11). The hero does the showing; these say who it's
// for and where each of them starts. The demos that used to live here (the app tour, Ember, the club
// checklist, company search, pricing, questions) are a click away on their own pages.

export const H2 = "text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.03] font-semibold tracking-[-0.04em] text-balance";

const FOR = [
  { icon: BadgeCheck, who: "Builders", body: "Students and working engineers. Log what you finish, and whoever saw it signs. Free, and yours wherever you go next.", cta: "Start your record", href: "/signup" },
  { icon: Users, who: "Clubs", body: "Officers verify what members build, and the club's work finally gets counted. Free for every club and member.", cta: "Bring your club", href: "#founding" },
  { icon: Building2, who: "Companies", body: "Find people by work someone signed, not by keywords on a résumé. Message them as a request they can accept.", cta: "Company pricing", href: "/pricing#pricing-companies" },
];

export function Audiences() {
  return (
    <section id="for" aria-labelledby="for-h" className="scroll-mt-20 py-14 md:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <h2 id="for-h" className={H2}>Who it&apos;s for</h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-3">
          {FOR.map((f) => (
            <li key={f.who} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-text-2"><f.icon className="size-5" aria-hidden="true" /></span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{f.who}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{f.body}</p>
              <Link href={f.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-text underline-offset-4 hover:underline">{f.cta} <ArrowRight className="size-3.5" /></Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">Already use Claude or ChatGPT? <Link href="/ai" className="font-medium text-text underline-offset-4 hover:underline">Connect your AI</Link> and it fills in your record, with your OK.</p>
      </div>
    </section>
  );
}
