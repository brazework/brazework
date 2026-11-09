"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, Check, ChevronDown, GraduationCap, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";

const AUDIENCES = [
  {
    id: "students", label: "Students", icon: GraduationCap,
    headline: "Your work, finally on the record.",
    points: ["A profile built from projects, results and write-ups, not just a résumé", "Milestones your club vouches for, visible to companies that care", "Events, clubs and people in your field, with For you showing only what matches your interests", "A messaging inbox that keeps recruiters and strangers in Requests"],
    cta: { label: "Create your free account", href: "/signup" },
  },
  {
    id: "clubs", label: "Club leaders", icon: Users,
    headline: "Everything your club runs on, in one place.",
    points: ["Roles from owner to helper, join approvals and invite links", "Moderation that works: word filters, link holds for new members, held-post review", "Club events with RSVPs, calendar files and a past-events log", "Your members' work becomes career capital, so recruiting new members gets easier"],
    cta: { label: "Bring your club", href: "#founding" },
  },
  {
    id: "companies", label: "Companies & schools", icon: BadgeCheck,
    headline: "Meet builders by what they've built.",
    points: ["Verified through your work or school domain, so students trust you", "Host career nights, talks and hackathons next to club events", "Follow students and clubs in your field; reach out through a respectful inbox", "Sponsor club projects and challenges where the work happens"],
    cta: { label: "Talk to us", href: "#founding" },
  },
] as const;

export function AudienceTabs() {
  const [active, setActive] = useState<(typeof AUDIENCES)[number]["id"]>("clubs");
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
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
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
  ["Is Forge free?", "Yes, for students, professionals and clubs. We plan to earn money from companies that sponsor club events and challenges to meet the people building."],
  ["Who can join?", "Anyone 18 or older working or studying in STEM. Students verify with a university email; companies and schools verify with their own domain."],
  ["How is this different from LinkedIn or Discord?", "LinkedIn is built for reach and recruiters; Discord is built for chat that disappears. Forge is built for the work: clubs run on it, projects live on it, and the people who matter can find both."],
  ["What does a founding club get?", "We set your club up with you personally, your requests shape what we build next, and it's free for your club and its members."],
  ["What happens to my data?", "Your birthday and analytics are private, read status in messages is never shown, and you decide who can message you. Everything is enforced by the database, not just the app."],
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
