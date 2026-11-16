"use client";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";

const QA = [
  ["Is Brazework free?", "Yes, for students and clubs, always. Companies pay: they sponsor build challenges and, with a subscription, search and message verified builders."],
  ["Who is it for?", "Anyone 18 or older studying or working in any field, the clubs they belong to, and the companies that hire from them. Students verify with a university email; companies with their work domain."],
  ["What does \"verified\" mean?", "An organization vouched for it: officers confirm a milestone they saw happen, and Brazework records who verified it and when. It's proof of the work, not just of who you are."],
  ["I'm not in a club. Can I still get verified?", "Yes. Ask someone who saw the work (a professor, TA, lab PI, manager or mentor) to vouch for a milestone. We email their university or company address; they answer what they saw and how they know your work, and their name and domain go on your record. Free-mail addresses don't count, and you can't vouch for yourself."],
  ["What does the AI do?", "Ember, the assistant inside Brazework, plans meetings, drafts updates from real numbers, finds the right people and helps members keep their work on the record. It checks real Brazework data first and never acts without your approval. You can also connect the AI tools you already use, like Claude Code or Cursor, to log progress as you work; they can never verify anything."],
  ["Does it work for study groups?", "Yes. A study group is a club with a course, a term and a meeting time. The owner confirms who led each session, and that goes on the leader's record like any other signed work."],
  ["How is this different from LinkedIn, Handshake or Discord?", "LinkedIn is built for reach and is filling up with AI-written posts; Handshake is run by career centers; Discord is chat that disappears. Brazework is where organizations actually run, so the work is recorded where it happens and verified by the people who saw it."],
  ["What happens to my data?", "Your birthday and analytics are private, read status in messages is never shown, private write-ups stay private, and you decide who can message you. Everything is enforced by the database, not just the app."],
  ["What does a founding organization get?", "We set you up personally, your requests shape what we build next, and it's free for your organization and its members."],
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
