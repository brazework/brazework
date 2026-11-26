"use client";
import { emberCreditCost } from "@/lib/ember-credits";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Lookups } from "@/app/(app)/copilot/copilot-client";
import { EmberReply, Thinking } from "@/components/copilot/reply";
import { useCopilot } from "@/components/copilot/use-copilot";
import { Ember } from "@/components/ember/ember";
import { GlobalSearch } from "@/components/search/global-search";
import type { Proposal, Segment } from "@/lib/copilot-agent";
import { saveChat, type SavedMsg } from "@/lib/copilot-chats";
import { splitNext } from "@/lib/copilot-text";
import { TORCH_ASK, barHistory, carryOnSteps, followsAfter, pageContext, pickedFrom, type BarTurn } from "@/lib/ember-bar";
import { ChoiceButtons } from "@/components/copilot/choices";
import { CARD_LABEL, cardsOf, type CardOutcome, type OfferedChoice } from "@/lib/ember-thread";

// The Ask Torch bar, at the top of every signed-in page (the flow redesign,
// docs/superpowers/specs/2026-11-19-app-flow-redesign-design.md). One bar: type to search people and
// clubs as before, or press Enter to ask Torch, or tell it what you did. It knows the page it's on (a
// project, club or event), and Torch's answer opens out of the bar itself, with its approve cards right
// there, not on another screen. Nothing is saved until the member presses a card's button.
//
// The bar keeps its thread (docs/superpowers/specs/2026-11-26-ember-follow-through-design.md): a
// follow-up goes to Torch with the exchange above it and with what happened to each card, until the
// bar is closed or the member moves to another page. From the second turn the exchange is kept as one
// of their Torch chats (where chats are kept at all), so "Keep going on Torch's page" opens it there.

// `choice`: answers Torch offered as buttons, with the one tapped once the member answers.
// `follow`: Torch carried on by itself after a yes (`q` is empty when a confirmed card set it going).
type Turn = { id: number; q: string; text: string; tools: string[]; proposals: Proposal[]; segments: Segment[]; choice?: OfferedChoice; follow?: boolean };
type Done = Record<string, CardOutcome>;

const toBar = (t: Turn, done: Done): BarTurn => ({ q: t.q, text: splitNext(t.text).text, cards: cardsOf(t.proposals, done), ...(t.choice ? { choice: t.choice } : {}), ...(t.follow ? { follow: true } : {}) });
// The exchange as a saved chat: labels and outcomes, never a live card (lib/copilot-chats.ts).
const toSaved = (turns: Turn[], done: Done): SavedMsg[] => turns.filter((t) => splitNext(t.text).text.trim()).flatMap((t): SavedMsg[] => [
  { role: "user", content: t.q, ...(t.follow ? { follow: true } : {}) },
  { role: "assistant", content: splitNext(t.text).text, tools: t.tools, cards: t.proposals.map((p) => CARD_LABEL[p.kind]), outcomes: cardsOf(t.proposals, done), ...(t.choice ? { choice: t.choice } : {}) },
]);

export function AskBar() {
  const path = usePathname();
  const router = useRouter();
  const { run, busy, error, remaining, stop } = useCopilot();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [done, setDone] = useState<Done>({});
  const [chatId, setChatId] = useState<string | null>(null);
  // A card can be answered while the next reply streams, so the newest outcomes are read from a ref.
  const doneNow = useRef(done);
  useEffect(() => { doneNow.current = done; }, [done]);
  const turnId = useRef(0);
  // A new page starts clean (and stops an answer still typing for the old one).
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setTurns([]); setDone({}); setChatId(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), [path]);

  // Torch carries on after a yes (the spec's part 3), as on its own page: free, up to 3 after each ask.
  // Each confirmed card with a next step, numbered so the effect carries on once per card.
  const [pendingFollow, setPendingFollow] = useState<{ id: string; n: number } | null>(null);
  const followed = useRef(0);
  const [follows, setFollows] = useState(0);
  const [carryPaid, setCarryPaid] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  // `tapped`: one of the answers Torch offered, so the turn that offered them records which.
  // `carry`: a free follow turn: after a confirmed card (no words) or a tapped answer.
  const ask = async (text: string, tapped?: string, carry = false) => {
    const q = text.trim();
    if (!q && !carry) return;
    const was = turns;
    // Only exchanges that got an answer carry on; one that failed gives way to the new question.
    const answered = turns.filter((t) => splitNext(t.text).text.trim());
    const before = answered.map((t, i) => (i === answered.length - 1 && t.choice ? { ...t, choice: pickedFrom(t.choice, tapped) } : t));
    let last: Turn = { id: ++turnId.current, q, text: "", tools: [], proposals: [], segments: [], ...(carry ? { follow: true } : {}) };
    setTurns([...before, last]);
    setCarryPaid([]);
    setNotice("");
    let refused = false;
    const out = await run({ task: "ask", input: q, page: pageContext(path) ?? undefined, history: barHistory(before.map((t) => toBar(t, doneNow.current))), choices: true, ...(carry ? { follow: true } : {}) }, (full, tools, proposals, segments, choice) => {
      last = { ...last, text: full, tools, proposals, segments, ...(choice ? { choice: { options: choice.options } } : {}) };
      setTurns([...before, last]);
    }, { onRefused: () => { refused = true; } });
    if (refused) {
      // No free follow-up left: back as it was, and the next step is offered for a credit.
      setTurns(was);
      setFollows(0);
      const lastTurn = was.at(-1);
      if (!q && lastTurn) setCarryPaid(carryOnSteps(cardsOf(lastTurn.proposals, doneNow.current)));
      else setNotice("Torch's free follow-ups for that question are used up, so answering now takes a credit.");
      return;
    }
    if (out !== null) setFollows((f) => followsAfter(f, carry, false));
    // One question and its answer aren't kept, as before; a real exchange is.
    if (out === null || !before.length) return;
    const r = await saveChat(chatId, toSaved([...before, last], doneNow.current)).catch(() => null);
    if (r?.id) setChatId(r.id);
  };
  const close = () => { stop(); setTurns([]); setDone({}); setChatId(null); setCarryPaid([]); setNotice(""); };
  const onOutcome = (id: string, o: CardOutcome, settled: boolean) => {
    doneNow.current = { ...doneNow.current, [id]: o };
    setDone((d) => ({ ...d, [id]: o }));
    if (settled && o.state === "confirmed" && o.then) setPendingFollow((p) => ({ id, n: (p?.n ?? 0) + 1 }));
  };
  // A card was confirmed with a next step: carry on, if it's in the newest answer and nothing is running.
  useEffect(() => {
    if (!pendingFollow || pendingFollow.n === followed.current) return;
    const { id, n } = pendingFollow;
    if (busy || !turns.at(-1)?.proposals.some((p) => p.id === id)) return;
    // Marked when it's sent, not when it's scheduled: in development React runs an effect twice.
    const t = setTimeout(() => { followed.current = n; void ask("", undefined, true); }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFollow]);

  // A card on the page asked Torch something (lib/ember-bar.ts askTorch): ask it here, and bring the
  // bar into view so the answer and its cards open where the member can see them.
  const askNow = useRef(ask);
  useEffect(() => { askNow.current = ask; });
  useEffect(() => {
    const on = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      if (typeof q !== "string" || !q.trim()) return;
      // On Torch's own page the bar is hidden: ask there instead.
      if (window.location.pathname.startsWith("/copilot")) { router.push(`/copilot?q=${encodeURIComponent(q)}`); return; }
      window.scrollTo({ top: 0, behavior: "smooth" });
      void askNow.current(q);
    };
    window.addEventListener(TORCH_ASK, on);
    return () => window.removeEventListener(TORCH_ASK, on);
  }, [router]);

  // Torch's own page has its composer: a second box to ask in would only compete with it.
  if (path.startsWith("/copilot")) return null;
  return (
    <div>
      <GlobalSearch onAsk={(q) => void ask(q)} asking={busy} joined={turns.length > 0} />
      <AskAnswer turns={turns} busy={busy} error={error} remaining={remaining} chatId={chatId} follows={follows} carryPaid={carryPaid} notice={notice} onAsk={(q, tapped, carry) => void ask(q, tapped, carry)} onClose={close} onOutcome={onOutcome} />
    </div>
  );
}

// Torch's answers, hanging from the bar as one piece: each thing you said as a quiet line, Torch's
// reply beside its mark with the cards to approve, and under the newest its suggested next questions,
// one tap to ask. A long exchange scrolls inside the panel, so the page under it stays put.
function AskAnswer({ turns, busy, error, remaining, chatId, follows, carryPaid, notice, onAsk, onClose, onOutcome }: { turns: Turn[]; busy: boolean; error: string; remaining: number | null; chatId: string | null; follows: number; carryPaid: string[]; notice: string; onAsk: (q: string, tapped?: string, carry?: boolean) => void; onClose: () => void; onOutcome: (id: string, o: CardOutcome, settled: boolean) => void }) {
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const newest = turns.at(-1)?.id;
  // A new question comes into view at the top of the panel, with its answer growing below it.
  useEffect(() => {
    const el = scroller.current;
    const row = el?.lastElementChild as HTMLElement | null;
    if (el && row) el.scrollTop = row.offsetTop;
  }, [newest]);
  return (
    <AnimatePresence initial={false}>
      {turns.length > 0 && (
        <motion.section
          aria-label="Torch's answer"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-b-lg border border-t-0 border-line bg-surface shadow-[var(--shadow-float)]"
        >
          <button type="button" onClick={onClose} aria-label="Close Torch's answer" className="absolute top-2 right-2 z-10 grid size-8 place-items-center rounded-md bg-surface text-faint transition hover:bg-hover hover:text-text"><X className="size-4" /></button>
          <div ref={scroller} className="relative max-h-[60dvh] overflow-y-auto overscroll-contain">
            {turns.map((t, i) => {
              const live = busy && i === turns.length - 1;
              const lastOne = i === turns.length - 1;
              const { text, next } = splitNext(t.text);
              const thinking = live && !text && !t.tools.length;
              return (
                <div key={t.id} className="border-t border-dashed border-line">
                  <p className="truncate px-3 pt-3 pr-12 pb-1 text-sm text-muted sm:px-4 sm:pr-12" title={t.q || undefined}>{t.follow && !t.q ? "Confirmed. Carrying on…" : t.q}</p>
                  <div className="flex gap-3 px-3 pb-4 sm:px-4" aria-live={lastOne ? "polite" : undefined} aria-busy={lastOne ? busy : undefined}>
                    <Ember size={28} mood={thinking ? "thinking" : lastOne && error ? "sleepy" : "idle"} className="mt-0.5" />
                    <div className="min-w-0 flex-1 text-[15px] leading-relaxed whitespace-pre-wrap text-text">
                      <Lookups tools={t.tools} live={live} />
                      {thinking && <p className="flex items-center gap-2 text-sm text-muted"><Thinking label="Looking at this page" /> Looking at this page…</p>}
                      {(t.text || t.proposals.length > 0) && <EmberReply text={t.text} proposals={t.proposals} segments={t.segments} live={live} inline cardProps={{ onOutcome }} />}
                      {lastOne && error && <p role="alert" className="text-sm text-text-2">{error}</p>}
                      {lastOne && !busy && t.choice && !t.choice.picked && <ChoiceButtons options={t.choice.options} onPick={(o) => onAsk(o, o, follows > 0)} typeHint="type your own in the bar" cost={follows > 0 ? emberCreditCost("follow") : emberCreditCost("ask")} />}
                      {lastOne && !busy && carryPaid.length > 0 && (
                        <button type="button" onClick={() => onAsk(`Carry on: ${carryPaid.join("; then ")}`)} className="mt-3 min-h-10 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-left text-sm font-medium whitespace-normal text-text transition hover:bg-hover active:scale-[0.98]">
                          Carry on: {carryPaid.join("; then ")} <span className="text-xs font-normal text-muted">· {emberCreditCost("ask")}</span>
                        </button>
                      )}
                      {lastOne && notice && <p className="mt-2 text-xs whitespace-normal text-muted">{notice}</p>}
                      {lastOne && !busy && !(t.choice && !t.choice.picked) && next.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 whitespace-normal">
                          {next.map((n) => <button key={n} type="button" onClick={() => onAsk(n)} className="rounded-full border border-line px-3 py-1 text-left text-xs text-text-2 transition hover:border-line-strong hover:text-text">{n} · {emberCreditCost("ask")}</button>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {(!busy || remaining !== null) && (
            <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-xs sm:px-4">
              <Link href={chatId ? `/copilot?chat=${chatId}` : "/copilot"} className="font-medium text-text-2 underline-offset-4 hover:text-text hover:underline">Keep going on Torch&apos;s page</Link>
              {remaining !== null && <span className="ml-auto text-faint">{remaining} credits left today</span>}
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
