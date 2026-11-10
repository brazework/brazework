"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Building2, Check, ChevronDown, GraduationCap, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";

const AUDIENCES = [
  {
    id: "students", label: "Students", icon: GraduationCap,
    headline: "Your work, on the record.",
    points: ["A profile built from projects and results, not just a résumé", "Milestones your club verified, with who checked them and when", "The clubs, events and people in your field", "An inbox where recruiters and strangers wait in Requests"],
    cta: { label: "Create your profile", href: "/signup" },
  },
  {
    id: "orgs", label: "Clubs", icon: Users,
    headline: "Run your chapter. Prove what it builds.",
    points: ["Members, events, chat, announcements and team chats in one place", "Officers verify the milestones members hit, so the work follows them into their careers", "Ember plans meetings, drafts updates and reports from real numbers", "End-of-term handoff, so the next officers start where you left off"],
    cta: { label: "Bring your club", href: "#founding" },
  },
  {
    id: "companies", label: "Companies", icon: Building2,
    headline: "Hire from proof, not keywords.",
    points: ["Sponsor a build challenge (pilots set up with the founders); clubs opt in and results get verified", "Meet the winners and follow the clubs where the building happens", "Host events beside the clubs you support", "Verified by your work domain, so members trust you"],
    cta: { label: "Sponsor a challenge", href: "#founding" },
  },
  {
    id: "pros", label: "Professionals", icon: UserRound,
    headline: "Your work, vouched for and findable.",
    points: ["A profile built from projects and verified results, not just a job title", "Mentor and recruit from the clubs in your field", "Professional and alumni communities that actually meet", "An inbox where strangers wait in Requests"],
    cta: { label: "Join free", href: "/signup" },
  },
] as const;

export function AudienceTabs() {
  const [active, setActive] = useState<(typeof AUDIENCES)[number]["id"]>("students");
  const a = AUDIENCES.find((x) => x.id === active)!;
  return (
    <div>
      <div role="tablist" aria-label="Who it's for" className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        {AUDIENCES.map((x) => (
          <button key={x.id} role="tab" aria-selected={active === x.id} aria-controls="audience-panel" onClick={() => setActive(x.id)} className="relative inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm whitespace-nowrap text-muted transition hover:text-text aria-selected:border-transparent aria-selected:text-on-accent">
            {active === x.id && <motion.span layoutId="aud-pill" className="bg-accent-grad absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <x.icon className="relative size-4" /> <span className="relative">{x.label}</span>
          </button>
        ))}
      </div>
      <div id="audience-panel" role="tabpanel" className="mt-6 overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[var(--shadow)]">
        <AnimatePresence mode="wait">
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="grid grid-cols-1 gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <h3 className="text-3xl font-semibold tracking-tight">{a.headline}</h3>
              <Button href={a.cta.href} className="mt-6">{a.cta.label} <ArrowRight className="size-4" /></Button>
            </div>
            <ul className="flex flex-col gap-3">
              {a.points.map((p) => (
                <li key={p} className="flex gap-3 text-[15px] text-text-2"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-grad text-on-accent"><Check className="size-3" /></span>{p}</li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const QA = [
  ["Is Brazework free?", "Yes, for students and clubs, always. Companies pay: they sponsor build challenges and, with a subscription, search and message verified builders."],
  ["Who is it for?", "Anyone 18 or older studying or working in STEM, the clubs they belong to, and the companies that hire from them. Students verify with a university email; companies with their work domain."],
  ["What does \"verified\" mean?", "An organization vouched for it: officers confirm a milestone they saw happen, and Brazework records who verified it and when. It's proof of the work, not just of who you are."],
  ["What does the AI do?", "Ember, the agent inside Brazework, plans meetings, drafts updates from real numbers, finds the right people and helps members keep their work on the record. It checks real Brazework data first and never acts without your approval."],
  ["How is this different from LinkedIn, Handshake or Discord?", "LinkedIn is built for reach and is filling up with AI-written posts; Handshake is run by career centers; Discord is chat that disappears. Brazework is where organizations actually run, so the work is recorded where it happens and verified by the people who saw it."],
  ["What happens to my data?", "Your birthday and analytics are private, read status in messages is never shown, private write-ups stay private, and you decide who can message you. Everything is enforced by the database, not just the app."],
  ["What does a founding organization get?", "We set you up personally, your requests shape what we build next, and it's free for your organization and its members."],
] as const;

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
      {QA.map(([q, a], i) => (
        <div key={q}>
          <h3>
            <button type="button" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-medium transition hover:bg-hover">
              <span>{q}</span>
              <ChevronDown className={cn("size-5 shrink-0 text-faint transition", open === i && "rotate-180")} />
            </button>
          </h3>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div id={`faq-${i}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <p className="px-6 pb-5 text-muted">{a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
