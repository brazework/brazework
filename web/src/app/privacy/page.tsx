import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Forge handles your data, in plain language.",
};

// A plain-language account of what Forge does with data today. Every line here has to stay true
// to the code: change the page when the behavior changes.
const SECTIONS: { h: string; items: string[] }[] = [
  {
    h: "What Forge keeps",
    items: [
      "What you give it: your profile, posts, replies, projects, milestones and their evidence links, messages, clubs and the events you RSVP to.",
      "Forge never pulls records from your school. Nothing about you comes from a registrar, a transcript or a student system.",
      "Forge counts views of your profile so you can see your own analytics.",
    ],
  },
  {
    h: "Who sees your work",
    items: [
      "New milestones are private by default. They show on your profile only if you choose to show them.",
      "A milestone is verified only by an officer of the club you sent it to, never by you, a teammate on the project or Ember. Each badge records who verified it, their role, the club and when.",
      "Verified companies and schools can search public verified work only. Messages they send land in your Requests, and you choose whether to reply.",
      "Challenge entries are seen by the sponsor. Winners are shown publicly once the sponsor announces them.",
    ],
  },
  {
    h: "Ember, the AI agent",
    items: [
      "Ember drafts; you approve. It never posts, sends, verifies or saves anything without your tap.",
      "When you ask Ember something, your request and the Forge data it needs to answer are sent to Anthropic's API to generate the reply.",
      "If you connect an AI tool to your Forge (Settings), its access is read-only and you can revoke it at any time.",
    ],
  },
  {
    h: "Your controls",
    items: [
      "Download your data from Settings: a JSON file with what you've put on Forge, plus links to your files.",
      "Delete your account from Settings. What you authored is removed; the verification log keeps an anonymized record so clubs' history stays consistent.",
      "Choose who can message you in Settings. Block and report anyone from your conversation with them; you can unblock them in Settings.",
    ],
  },
  {
    h: "Payments",
    items: ["Members and student clubs never pay. When companies pay for sponsorships, payment is handled by Stripe; Forge doesn't store card details."],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-bg text-text">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" aria-label="Forge home"><Logo /></Link>
        <h1 className="text-grad mt-10 text-3xl font-semibold tracking-tight sm:text-4xl">How Forge handles your data</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">The short version, in plain language. It describes what Forge does today; full terms will be published before Forge opens publicly.</p>
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
        <p className="mt-12 border-t border-line pt-6 text-sm text-faint"><Link href="/" className="hover:text-text">Back to Forge</Link></p>
      </div>
    </main>
  );
}
