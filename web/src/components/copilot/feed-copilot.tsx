"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck, CalendarDays, Compass, GitBranch, Megaphone, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Lookups, Rich } from "@/app/(app)/copilot/copilot-client";
import { ProposalCard } from "@/components/copilot/proposal-card";
import type { Proposal } from "@/lib/copilot-agent";

// Pieces of "Ask Ember" in the feed's create box (feed/composer.tsx): example prompts typed into
// the placeholder, the one-tap actions, and the answer area with lookups and confirm cards.

export type EmberAction = { icon: typeof Compass; label: string; ask?: string; prefill?: string; href: string };
export type EmberAnswerState = { q: string; text: string; tools: string[]; proposals: Proposal[] };

// Short enough to fit on one line on a phone.
const EXAMPLES = ["Which robotics clubs fit me?", "Import github.com/you/rover…", "What's on this week for me?", "What should I build next?", "Prep me for the career fair"];

export function useTypedPlaceholder(on: boolean) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on || reduce) return;
    const full = EXAMPLES[i];
    const t = setTimeout(() => {
      if (n < full.length) setN(n + 1);
      else { setN(0); setI((i + 1) % EXAMPLES.length); }
    }, n < full.length ? 38 : 2200);
    return () => clearTimeout(t);
  }, [on, reduce, i, n]);
  return reduce ? EXAMPLES[0] : EXAMPLES[i].slice(0, n);
}

export function emberActions(club?: { id: string; name: string } | null): EmberAction[] {
  return [
    { icon: Compass, label: "Find clubs for me", ask: "Which clubs on Forge fit me best, and why?", href: "/communities?tab=discover" },
    { icon: CalendarDays, label: "What's on this week", ask: "What's coming up on Forge in the next 7 days that fits me?", href: "/events" },
    { icon: GitBranch, label: "Import a GitHub repo", prefill: "Add my GitHub repo to my profile: github.com/", href: "/profile#projects" },
    { icon: BadgeCheck, label: "Get a milestone verified", ask: "Help me pick one of my milestones to ask my club to verify, then draft it.", href: "/profile#projects" },
    ...(club ? [{ icon: Megaphone, label: `This week's update for ${club.name}`, ask: `Use club_report for club ${club.id}, then draft this week's update for ${club.name} with propose_club_post. Use only the report's numbers.`, href: `/c/${club.id}/manage?tab=report` }] : []),
  ];
}

export function EmberAnswer({ a, busy, error, remaining, onClear }: { a: EmberAnswerState; busy: boolean; error: string; remaining: number | null; onClear: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {a.q && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden" aria-live="polite">
          <div className="mt-3 rounded-2xl border border-line bg-surface-2/60 p-4">
            <p className="text-xs text-muted">You asked: <span className="text-text-2">{a.q}</span></p>
            <div className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">
              <Lookups tools={a.tools} live={busy} />
              {a.text ? <Rich text={a.text} /> : !a.tools.length && busy && <span className="inline-flex gap-1" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.span key={d} className="size-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span>}
              {a.proposals.map((p) => <ProposalCard key={p.id} p={p} />)}
            </div>
            {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-3 flex items-center gap-3 text-xs">
              <Link href="/copilot" className="inline-flex items-center gap-1 font-medium text-text hover:underline">Continue with Ember <ArrowRight className="size-3.5" /></Link>
              <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-muted hover:text-text"><RotateCcw className="size-3.5" /> Clear</button>
              {remaining !== null && <span className="ml-auto text-faint">{remaining} left today</span>}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
