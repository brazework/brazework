"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUp, BadgeCheck, CalendarDays, Compass, GitBranch, Megaphone, PenLine, RotateCcw, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Lookups, Rich } from "@/app/(app)/copilot/copilot-client";
import { ProposalCard } from "@/components/copilot/proposal-card";
import { useCopilot } from "@/components/copilot/use-copilot";
import type { Proposal } from "@/lib/copilot-agent";
import { cn } from "@/lib/forge";

type Action = { icon: typeof Sparkles; label: string; ask?: string; prefill?: string; href: string };

// Short enough to fit on one line on a phone.
const EXAMPLES = [
  "Post my static fire result…",
  "Import github.com/you/rover…",
  "Which robotics clubs fit me?",
  "What's on this week for me?",
  "What should I build next?",
];

// Types the example prompts into the placeholder, one after another.
function useTypedPlaceholder(on: boolean) {
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

// The top of the feed: Copilot as the front door. Ask anything or tap an action; answers, the
// lookups behind them and confirm cards appear right here. Without Copilot, the actions still
// work as shortcuts.
export function FeedCopilot({ first, copilot, next, club }: { first: string; copilot: boolean; next?: { label: string; href: string } | null; club?: { id: string; name: string } | null }) {
  const ai = useCopilot();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ text: string; tools: string[]; proposals: Proposal[] }>({ text: "", tools: [], proposals: [] });
  const [soon, setSoon] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const placeholder = useTypedPlaceholder(!input && !focused && !q);

  const actions: Action[] = [
    { icon: PenLine, label: "Turn notes into a post", prefill: "Turn these notes into a post: ", href: "#composer" },
    { icon: GitBranch, label: "Import a GitHub repo", prefill: "Add my GitHub repo to my profile: github.com/", href: "/profile#projects" },
    { icon: Compass, label: "Find clubs for me", ask: "Which clubs on Forge fit me best, and why?", href: "/communities?tab=discover" },
    { icon: CalendarDays, label: "What's on this week", ask: "What's coming up on Forge in the next 7 days that fits me?", href: "/events" },
    { icon: BadgeCheck, label: "Get a milestone verified", ask: "Help me pick one of my milestones to ask my club to verify, then draft it.", href: "/profile#projects" },
    ...(club ? [{ icon: Megaphone, label: `This week's update for ${club.name}`, ask: `Use club_report for club ${club.id}, then draft this week's update for ${club.name} with propose_club_post. Use only the report's numbers.`, href: `/c/${club.id}/manage?tab=report` }] : []),
  ];

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || ai.busy) return;
    if (!copilot) { setSoon(true); return; }
    setQ(t);
    setInput("");
    setAnswer({ text: "", tools: [], proposals: [] });
    await ai.run({ task: "ask", input: t }, (full, tools, proposals) => setAnswer({ text: full, tools, proposals }));
  };
  const pick = (a: Action) => {
    if (!copilot) return;
    if (a.ask) void ask(a.ask);
    else if (a.prefill) { setInput(a.prefill); requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(a.prefill!.length, a.prefill!.length); }); }
  };

  return (
    <section aria-label="Forge Copilot" className="ai-border relative isolate overflow-hidden rounded-3xl p-4 shadow-[0_20px_50px_-30px_var(--accent)] sm:p-5">
      {/* Soft moving light behind everything. */}
      <div className="bg-accent-grad ai-aurora pointer-events-none absolute -top-28 -right-20 -z-10 size-80 rounded-full blur-3xl" aria-hidden="true" />
      <div className="bg-accent-grad ai-aurora-2 pointer-events-none absolute -bottom-32 -left-24 -z-10 size-72 rounded-full blur-3xl" aria-hidden="true" />

      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className="bg-accent-grad grid size-6 place-items-center rounded-lg text-on-accent"><Sparkles className="size-3.5" /></span>
        Forge Copilot
        {next && <Link href={next.href} className="ml-auto inline-flex items-center gap-1 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[11px] text-text-2 transition hover:border-line-strong">Next: {next.label} <ArrowRight className="size-3" /></Link>}
      </div>
      <h1 className="mt-2.5 text-[clamp(1.3rem,2.4vw,1.75rem)] leading-tight font-semibold tracking-tight">
        Hey {first}, <span className="text-grad">what are you building today?</span>
      </h1>

      <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className={cn("mt-3 flex items-end gap-2 rounded-2xl border bg-surface/90 p-2 shadow-sm backdrop-blur transition", focused ? "border-line-strong shadow-[0_10px_30px_-12px_var(--accent)]" : "border-line")}>
        <Sparkles className="mt-3 ml-2 size-5 shrink-0 text-accent" aria-hidden="true" />
        <label htmlFor="feed-ask" className="sr-only">Ask Copilot or tell it what to do</label>
        <textarea
          id="feed-ask"
          ref={box}
          value={input}
          rows={1}
          maxLength={4000}
          onChange={(e) => { setInput(e.target.value); setSoon(false); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
          placeholder={placeholder || "Ask Copilot or tell it what to do"}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-faint"
        />
        {ai.busy ? (
          <button type="button" onClick={ai.stop} aria-label="Stop" className="grid size-11 shrink-0 place-items-center rounded-xl border border-line"><Square className="size-4 fill-current" /></button>
        ) : (
          <button type="submit" disabled={!input.trim()} aria-label="Ask Copilot" className="bg-accent-grad grid size-11 shrink-0 place-items-center rounded-xl text-on-accent shadow-[0_8px_20px_-10px_var(--accent)] transition hover:-translate-y-px active:scale-90 disabled:opacity-40"><ArrowUp className="size-5" /></button>
        )}
      </form>

      <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {actions.map((a, i) => {
          const cls = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface/80 px-3 py-1.5 text-xs font-medium text-text-2 backdrop-blur transition hover:-translate-y-px hover:border-line-strong hover:text-text active:scale-95";
          const inner = <><a.icon className="size-3.5 text-accent" /> {a.label}</>;
          return (
            <motion.span key={a.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="shrink-0">
              {copilot ? <button type="button" onClick={() => pick(a)} className={cls}>{inner}</button> : <Link href={a.href} className={cls}>{inner}</Link>}
            </motion.span>
          );
        })}
      </div>
      {soon && <p className="mt-2 text-xs text-muted">Copilot is switching on soon. Until then, the shortcuts above take you to the right place.</p>}

      <AnimatePresence initial={false}>
        {q && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden" aria-live="polite">
            <div className="mt-4 rounded-2xl border border-line bg-surface/90 p-4 backdrop-blur">
              <p className="text-xs text-muted">You asked: <span className="text-text-2">{q}</span></p>
              <div className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">
                <Lookups tools={answer.tools} live={ai.busy} />
                {answer.text ? <Rich text={answer.text} /> : !answer.tools.length && ai.busy && <span className="inline-flex gap-1" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.span key={d} className="size-2 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }} />)}</span>}
                {answer.proposals.map((p) => <ProposalCard key={p.id} p={p} />)}
              </div>
              {ai.error && <p role="alert" className="mt-2 text-sm text-danger">{ai.error}</p>}
              <div className="mt-3 flex items-center gap-3 text-xs">
                <Link href="/copilot" className="inline-flex items-center gap-1 font-medium text-text hover:underline">Continue in Copilot <ArrowRight className="size-3.5" /></Link>
                <button type="button" onClick={() => { ai.stop(); setQ(""); setAnswer({ text: "", tools: [], proposals: [] }); }} className="inline-flex items-center gap-1 text-muted hover:text-text"><RotateCcw className="size-3.5" /> Clear</button>
                {ai.remaining !== null && <span className="ml-auto text-faint">{ai.remaining} left today</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
