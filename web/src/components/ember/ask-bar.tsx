"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Lookups, Rich } from "@/app/(app)/copilot/copilot-client";
import { ProposalCard } from "@/components/copilot/proposal-card";
import { useCopilot } from "@/components/copilot/use-copilot";
import { Ember } from "@/components/ember/ember";
import { GlobalSearch } from "@/components/search/global-search";
import type { Proposal } from "@/lib/copilot-agent";
import { splitNext } from "@/lib/copilot-text";
import { pageContext } from "@/lib/ember-bar";
import { saveChat } from "@/lib/copilot-chats";
import { followUpHistory, type Turn } from "@/lib/ember-history";

// The Ask Ember bar, at the top of every signed-in page (the flow redesign,
// docs/superpowers/specs/2026-11-19-app-flow-redesign-design.md). One bar: type to search people and
// clubs as before, or press Enter to ask Ember, or tell it what you did. It knows the page it's on (a
// project, club or event), and Ember's answer opens out of the bar itself, with its approve cards right
// there, not on another screen. Nothing is saved until the member presses a card's button.

// `earlier`: the questions and answers before this one in the same open card (FIX-239), so a
// follow-up like "and the second one?" knows what came before. Closing the card or leaving the page
// starts over.
type Answer = { q: string; text: string; tools: string[]; proposals: Proposal[]; earlier: Turn[] };
const EMPTY: Answer = { q: "", text: "", tools: [], proposals: [], earlier: [] };

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
    // A follow-up while an answer is open carries the turns so far; a new question after closing doesn't.
    const earlier = a.q && a.text && !busy ? followUpHistory(a.earlier, a.q, splitNext(a.text).text) : a.earlier;
    setA({ ...EMPTY, q, earlier });
    run({ task: "ask", input: q, page: pageContext(path) ?? undefined, history: earlier.length ? earlier : undefined }, (full, tools, proposals) => setA({ q, text: full, tools, proposals, earlier }));
  };
  const close = () => { stop(); setA(EMPTY); };

  // Ember's own page has its composer: a second box to ask in would only compete with it.
  if (path.startsWith("/copilot")) return null;
  return (
    <div>
      <GlobalSearch onAsk={ask} asking={busy} joined={!!a.q} />
      <AskAnswer a={a} busy={busy} error={error} remaining={remaining} onAsk={ask} onClose={close} />
    </div>
  );
}

// Ember's answer, hanging from the bar as one piece: what you said as a quiet line, Ember's reply
// beside its mark, the cards to approve, and its suggested next questions, one tap to ask.
function AskAnswer({ a, busy, error, remaining, onAsk, onClose }: { a: Answer; busy: boolean; error: string; remaining: number | null; onAsk: (q: string) => void; onClose: () => void }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [moving, startMoving] = useTransition();
  // "Continue in Ember": this card's conversation becomes a saved chat, opened on Ember's page, so it
  // carries on with everything said here. Without saved chats, Ember's page opens as before.
  const carryOn = () => startMoving(async () => {
    const turns = a.text ? followUpHistory(a.earlier, a.q, splitNext(a.text).text) : a.earlier;
    const r = turns.length ? await saveChat(null, turns).catch(() => null) : null;
    router.push(r?.id ? `/copilot?chat=${r.id}` : "/copilot");
  });
  const { text, next } = splitNext(a.text);
  const thinking = busy && !text && !a.tools.length;
  return (
    <AnimatePresence initial={false}>
      {a.q && (
        <motion.section
          aria-label="Ember's answer"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-b-lg border border-t-0 border-line bg-surface shadow-[var(--shadow-float)]"
        >
          {a.earlier.length > 0 && (
            <ol aria-label="Earlier in this conversation" className="flex flex-col gap-1 border-t border-dashed border-line px-3 pt-3 text-xs text-muted sm:px-4">
              {a.earlier.map((t, i) => <li key={i} className={t.role === "user" ? "truncate font-medium text-text-2" : "line-clamp-2 pl-3"} title={t.content}>{t.content}</li>)}
            </ol>
          )}
          <div className="flex items-start gap-3 border-t border-dashed border-line px-3 pt-3 pb-1 sm:px-4">
            <p className="min-w-0 flex-1 truncate pt-0.5 text-sm text-muted" title={a.q}>{a.q}</p>
            <button type="button" onClick={onClose} aria-label="Close Ember's answer" className="-mt-0.5 -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-faint transition hover:bg-hover hover:text-text"><X className="size-4" /></button>
          </div>
          <div className="flex gap-3 px-3 pb-4 sm:px-4" aria-live="polite" aria-busy={busy}>
            <Ember size={28} mood={thinking ? "thinking" : error ? "sleepy" : "idle"} className="mt-0.5" />
            <div className="min-w-0 flex-1 text-[15px] leading-relaxed whitespace-pre-wrap text-text">
              <Lookups tools={a.tools} live={busy} />
              {thinking && <p className="text-sm text-muted">Looking at this page…</p>}
              {text && <Rich text={text} />}
              {a.proposals.map((p) => <ProposalCard key={p.id} p={p} inline />)}
              {error && <p role="alert" className="text-sm text-text-2">{error}</p>}
              {!busy && next.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 whitespace-normal">
                  {next.map((n) => <button key={n} type="button" onClick={() => onAsk(n)} className="rounded-full border border-line px-3 py-1 text-left text-xs text-text-2 transition hover:border-line-strong hover:text-text">{n}</button>)}
                </div>
              )}
            </div>
          </div>
          {(!busy || remaining !== null) && (
            <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-xs sm:px-4">
              <button type="button" disabled={moving || busy} onClick={carryOn} className="font-medium text-text-2 underline-offset-4 hover:text-text hover:underline disabled:opacity-60">{moving ? "Opening…" : "Continue in Ember"}</button>
              {remaining !== null && <span className="ml-auto text-faint">{remaining} left today</span>}
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
