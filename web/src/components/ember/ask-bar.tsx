"use client";
import { emberCreditCost } from "@/lib/ember-credits";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Lookups } from "@/app/(app)/copilot/copilot-client";
import { EmberReply, Thinking } from "@/components/copilot/reply";
import { useCopilot } from "@/components/copilot/use-copilot";
import { Ember } from "@/components/ember/ember";
import { GlobalSearch } from "@/components/search/global-search";
import type { Proposal, Segment } from "@/lib/copilot-agent";
import { splitNext } from "@/lib/copilot-text";
import { pageContext } from "@/lib/ember-bar";

// The Ask Jig bar, at the top of every signed-in page (the flow redesign,
// docs/superpowers/specs/2026-11-19-app-flow-redesign-design.md). One bar: type to search people and
// clubs as before, or press Enter to ask Jig, or tell it what you did. It knows the page it's on (a
// project, club or event), and Jig's answer opens out of the bar itself, with its approve cards right
// there, not on another screen. Nothing is saved until the member presses a card's button.

type Answer = { q: string; text: string; tools: string[]; proposals: Proposal[]; segments: Segment[] };
const EMPTY: Answer = { q: "", text: "", tools: [], proposals: [], segments: [] };

export function AskBar() {
  const path = usePathname();
  const { run, busy, error, remaining, stop } = useCopilot();
  const [a, setA] = useState<Answer>(EMPTY);
  // A new page starts clean (and stops an answer still typing for the old one).
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setA(EMPTY); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), [path]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setA({ ...EMPTY, q });
    run({ task: "ask", input: q, page: pageContext(path) ?? undefined }, (full, tools, proposals, segments) => setA({ q, text: full, tools, proposals, segments }));
  };
  const close = () => { stop(); setA(EMPTY); };

  // Jig's own page has its composer: a second box to ask in would only compete with it.
  if (path.startsWith("/copilot")) return null;
  return (
    <div>
      <GlobalSearch onAsk={ask} asking={busy} joined={!!a.q} />
      <AskAnswer a={a} busy={busy} error={error} remaining={remaining} onAsk={ask} onClose={close} />
    </div>
  );
}

// Jig's answer, hanging from the bar as one piece: what you said as a quiet line, Jig's reply
// beside its mark, the cards to approve, and its suggested next questions, one tap to ask.
function AskAnswer({ a, busy, error, remaining, onAsk, onClose }: { a: Answer; busy: boolean; error: string; remaining: number | null; onAsk: (q: string) => void; onClose: () => void }) {
  const reduce = useReducedMotion();
  const { text, next } = splitNext(a.text);
  const thinking = busy && !text && !a.tools.length;
  return (
    <AnimatePresence initial={false}>
      {a.q && (
        <motion.section
          aria-label="Jig's answer"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-b-lg border border-t-0 border-line bg-surface shadow-[var(--shadow-float)]"
        >
          <div className="flex items-start gap-3 border-t border-dashed border-line px-3 pt-3 pb-1 sm:px-4">
            <p className="min-w-0 flex-1 truncate pt-0.5 text-sm text-muted" title={a.q}>{a.q}</p>
            <button type="button" onClick={onClose} aria-label="Close Jig's answer" className="-mt-0.5 -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-faint transition hover:bg-hover hover:text-text"><X className="size-4" /></button>
          </div>
          <div className="flex gap-3 px-3 pb-4 sm:px-4" aria-live="polite" aria-busy={busy}>
            <Ember size={28} mood={thinking ? "thinking" : error ? "sleepy" : "idle"} className="mt-0.5" />
            <div className="min-w-0 flex-1 text-[15px] leading-relaxed whitespace-pre-wrap text-text">
              <Lookups tools={a.tools} live={busy} />
              {thinking && <p className="flex items-center gap-2 text-sm text-muted"><Thinking label="Looking at this page" /> Looking at this page…</p>}
              {(a.text || a.proposals.length > 0) && <EmberReply text={a.text} proposals={a.proposals} segments={a.segments} live={busy} inline />}
              {error && <p role="alert" className="text-sm text-text-2">{error}</p>}
              {!busy && next.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 whitespace-normal">
                  {next.map((n) => <button key={n} type="button" onClick={() => onAsk(n)} className="rounded-full border border-line px-3 py-1 text-left text-xs text-text-2 transition hover:border-line-strong hover:text-text">{n} · {emberCreditCost("ask")}</button>)}
                </div>
              )}
            </div>
          </div>
          {(!busy || remaining !== null) && (
            <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-xs sm:px-4">
              <Link href="/copilot" className="font-medium text-text-2 underline-offset-4 hover:text-text hover:underline">Keep going on Jig&apos;s page</Link>
              {remaining !== null && <span className="ml-auto text-faint">{remaining} credits left today</span>}
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
