import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { PLUS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Brazework, in plain language.",
};

// The rules for using Brazework, written in plain language like /privacy. Like that page, every line
// has to stay true to the code (18+, students never pay, Torch drafts only, sponsors pay clubs).
// Have a lawyer review this before relying on it in a dispute, and change LAST_UPDATED on every edit.
const LAST_UPDATED = "28 November 2026";

const SECTIONS: { h: string; items: string[] }[] = [
  {
    h: "Who we are",
    items: [
      "Brazework is run by Brazework, Inc., a Delaware corporation (\"Brazework\", \"we\"). By creating an account or using brazework.com you agree to these terms and to how we handle data, described on the Privacy page.",
    ],
  },
  {
    h: "Your account",
    items: [
      "You must be 18 or older. A student account needs a school email address you can receive mail at.",
      "One account per person, in your real name, with accurate details. Keep your sign-in safe; you're responsible for what happens in your account.",
    ],
  },
  {
    h: "Your work stays yours",
    items: [
      "You own what you post: projects, milestones, evidence, updates and messages.",
      "You give Brazework permission to store, display and share it only as needed to run the service and as your settings allow (for example, showing a milestone you made public, or sending one to your club to verify). This ends when you delete it or your account, except for the anonymized verification record described on the Privacy page.",
      "Only post what you have the right to share. Don't upload someone else's private information or confidential work, including your employer's.",
    ],
  },
  {
    h: "Verification",
    items: [
      "A verification is a statement by the club officer, professor or mentor who gives it, about work they saw. Brazework records who gave it, their role and when; it doesn't independently confirm the work.",
      "Never ask for, give or trade a verification you know is false. We remove false verifications and may close the accounts involved.",
    ],
  },
  {
    h: "Using Brazework fairly",
    items: [
      "Don't break the law, harass, threaten or impersonate anyone, send spam, or post sexual or violent content.",
      "Don't scrape Brazework, get around its limits or security, or interfere with how it runs.",
      "We may remove content or suspend accounts that break these rules. If we close your account by mistake, write to us and we'll look again.",
    ],
  },
  {
    h: "Torch, the AI agent",
    items: [
      "Torch drafts; you decide. It never posts, sends or verifies anything without your tap.",
      "AI can be wrong. Read a draft before you approve it: what you post is yours.",
    ],
  },
  {
    h: "Paid plans",
    items: [
      "Students and student clubs never pay.",
      `Schools, companies and professionals can buy paid plans (for example, Plus at $${PLUS.everyone} a month). The price and term are shown at checkout or in your order, and those terms apply to that purchase.`,
      "Card payments are handled by Stripe; Brazework doesn't store card details.",
      "Sponsorship money goes to the club in full. Brazework charges only for its own services.",
    ],
  },
  {
    h: "Other services",
    items: [
      "When you connect GitHub, Google, an AI tool or another service, that service's own terms also apply to how you use it.",
    ],
  },
  {
    h: "Leaving, and changes",
    items: [
      "You can delete your account at any time from Settings.",
      "We may change these terms as Brazework grows. We'll post the new version here with its date, and tell you in Brazework or by email before a change that affects you takes effect.",
    ],
  },
  {
    h: "The legal part",
    items: [
      "Brazework is provided as it is, without warranties, to the extent the law allows. We work to keep it running and your data safe, but we can't promise it will always be available or error-free.",
      "To the extent the law allows, Brazework isn't liable for indirect or consequential losses, and our total liability for any claim is limited to what you paid Brazework in the 12 months before it, or $100 if that's more.",
      "These terms are governed by the laws of the State of Delaware.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-bg text-text">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" aria-label="Brazework home"><Logo /></Link>
        <h1 className="text-grad mt-10 text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">The rules for using Brazework, in plain language. Last updated {LAST_UPDATED}.</p>
        {SECTIONS.map((s) => (
          <section key={s.h} className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight">{s.h}</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {s.items.map((t) => (
                <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-text-2">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-2" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="mt-12 border-t border-line pt-6 text-sm text-faint">
          Questions: <a href="mailto:hello@brazework.com" className="hover:text-text">hello@brazework.com</a> · <Link href="/privacy" className="hover:text-text">Privacy</Link> · <Link href="/" className="hover:text-text">Back to Brazework</Link>
        </p>
      </div>
    </main>
  );
}
