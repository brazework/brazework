"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";

const QA = [
  ["What is Brazework, in one sentence?", "A record of what you built, where each piece is signed by someone who saw it happen, so anyone can check it's real."],
  ["How does it work?", "Tell your AI what you finished: Claude, another assistant that takes connectors, or Ember, the assistant inside Brazework. It writes it up with the proof from your tools: a pull request, a test log, a report. You check it and say yes. Then the person who saw the work gets an email link and signs. Their name, role and the date stay on it."],
  ["Is Brazework free?", "Yes, for everyone who builds and for clubs, always. Companies pay to search signed work and message the people who did it. Schools pay for a portal for their advisors."],
  ["Who is it for?", "Anyone 18 or older who builds things, in any field: software, mechanical, electrical, civil, research, design and more. Students, people with jobs, and people working for themselves. Plus the clubs they belong to and the companies that hire."],
  ["I already work. Is this for me?", "Yes. Choose Professional when you sign up and log what you ship. Your manager, tech lead or client signs from their work email, and they don't need an account. Before you ask, you add your LinkedIn profile link, which stays private. Nothing shows on your profile until you choose to show it, so work for your employer is never public by accident. Leave out customer names and numbers your employer hasn't published; the person who signs still knows what you did. The record stays yours when you change jobs."],
  ["Who can sign my work?", "Someone who saw it happen: your manager, tech lead, professor, TA, lab lead, client or club officer. We email their work or university address, and they don't need an account. Gmail-type addresses don't count, and you can't sign your own work. If their company isn't verified on Brazework yet, the signature says so."],
  ["What if my work is on GitHub?", "A merged pull request, commit or release you made can back a milestone on its own, and it names who approved the pull request. You can still ask a person to sign it too."],
  ["I'm not in a club. Can I still use it?", "Yes. Clubs are one way to get work verified. A manager, a professor or a client signing works just the same."],
  ["How is this different from LinkedIn?", "LinkedIn shows what you say about yourself. Brazework shows what someone who saw it says about your work, with their name on it. Anyone can write a great profile with AI now; a signature from the person who was there is much harder to fake."],
  ["Does my AI act on its own?", "No. Your AI drafts; nothing is added to your record until you say yes, and nothing is signed until the person who saw it signs. Neither Ember nor any connected assistant can sign anything."],
  ["What happens to my data?", "Your birthday and analytics are private, read status in messages is never shown, private write-ups stay private, and you decide who can message you. All of it is enforced by the database, not just the app."],
  ["Does it work for study groups?", "Yes. A study group is a club with a course, a term and a meeting time. The owner confirms who led each session, and that goes on the leader's record like any other signed work."],
] as const;

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line overflow-hidden rounded-[1.25rem] border border-line bg-surface">
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
