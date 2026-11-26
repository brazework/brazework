"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Proposal, Segment } from "@/lib/copilot-agent";
import { ProposalCard } from "@/components/copilot/proposal-card";
import Link from "next/link";
import { splitNext } from "@/lib/copilot-text";

// Jig's answer as it streams (redesign 2026-11). Three things keep it smooth:
// - Order: text and cards render in the order they arrived, so a card never gets pushed down by
//   words arriving above it.
// - Pace: the network delivers text in bursts. useReveal shows it at an even pace that catches up
//   with the backlog (a few frames for a burst), instead of jumping a paragraph at a time.
// - Shape: the reply takes its full width from the first word, so lines don't reflow sideways as it
//   grows, and the caret, dots and cards are all the height they end at.

// How many characters to show: grows toward `total` each frame, faster the further behind it is.
// An answer that is already finished when it mounts (a saved chat) shows at once.
export function useReveal(total: number, live: boolean): number {
  const reduce = useReducedMotion();
  const [n, setN] = useState(live ? 0 : total);
  const shown = useRef(n);
  const goal = useRef(total);
  const raf = useRef(0);
  useEffect(() => {
    goal.current = total;
    if (raf.current) return;
    const tick = () => {
      const g = goal.current, c = shown.current;
      if (c === g) { raf.current = 0; return; }
      const next = c > g ? g : Math.min(g, c + Math.max(2, Math.ceil((g - c) / 5)));
      shown.current = next;
      setN(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [total]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return reduce ? total : Math.min(n, total);
}

const textOf = (segs: Segment[]) => segs.reduce((n, s) => n + (s.type === "text" ? s.text.length : 0), 0);

export function EmberReply({ text, proposals = [], segments, live, inline = false, cardProps }: {
  text: string;
  proposals?: Proposal[];
  segments?: Segment[];
  live: boolean;
  inline?: boolean;
  cardProps?: Partial<React.ComponentProps<typeof ProposalCard>>;
}) {
  // A saved chat has no segments: its text, then its cards.
  const segs: Segment[] = segments?.length ? segments : [...(text ? [{ type: "text" as const, text }] : []), ...proposals.map((p) => ({ type: "proposal" as const, proposal: p }))];
  const total = textOf(segs);
  const n = useReveal(total, live);
  const revealing = live || n < total;

  let budget = n;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.type === "text") {
      if (budget <= 0 && i > 0) break;
      const part = s.text.slice(0, Math.max(0, budget));
      budget -= s.text.length;
      // Rich turns Brazework links into links and hides Jig's trailing "next" marker.
      out.push(<Rich key={`t${i}`} text={part} />);
      if (budget < 0) break;
    } else {
      if (budget < 0) break;
      out.push(
        <motion.div key={s.proposal.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="whitespace-normal">
          <ProposalCard p={s.proposal} inline={inline} {...cardProps} />
        </motion.div>,
      );
    }
  }
  return (
    <div className="w-full min-w-0">
      {out}
      {revealing && total > 0 && <span aria-hidden="true" className="ember-caret" />}
    </div>
  );
}

// Links Copilot gives (/c/…, /events/…, /u/…) become real links; everything else stays text.
export function Rich({ text: raw }: { text: string }) {
  const text = splitNext(raw).text;
  const parts = text.split(/(\/(?:c|events|u)\/[A-Za-z0-9-]+)/g);
  return <>{parts.map((p, i) => (/^\/(c|events|u)\//.test(p) ? <Link key={i} href={p} className="font-medium text-accent underline underline-offset-4">{p.startsWith("/c/") ? "Open club" : p.startsWith("/events/") ? "Open event" : "Open profile"} →</Link> : <span key={i}>{p}</span>))}</>;
}

// Waiting for the first word: three dots, one line tall, so the first word takes their place exactly.
export function Thinking({ label = "Thinking" }: { label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex h-[1.625em] items-center gap-1 align-middle">
      {[0, 1, 2].map((d) => <span key={d} className="ember-dot size-1.5 rounded-full bg-brand" style={{ animationDelay: `${d * 0.15}s` }} />)}
    </span>
  );
}
