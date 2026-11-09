"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, Check, Lightbulb, Sparkles, Square, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Lookups, Rich } from "@/app/(app)/copilot/copilot-client";
import { useCopilot } from "@/components/copilot/use-copilot";
import { cn } from "@/lib/forge";
import type { Guide, GuideStep } from "@/lib/guide";
import type { Proposal } from "@/lib/copilot-agent";
import { ProposalCard } from "@/components/copilot/proposal-card";

// A tip for the page you're on: what this page is for, and the one thing worth doing here.
function tipFor(path: string): { page: string; tip: string; href?: string; cta?: string } {
  if (path.startsWith("/feed")) return { page: "the feed", tip: "Share what you're building, or what you're stuck on. Rough notes? Copilot in the composer turns them into a post." };
  if (path.startsWith("/u/") || path.startsWith("/profile")) return { page: "a profile", tip: "On your projects, add a milestone and ask your club to verify it. Verified milestones show with your club's name.", href: "/profile#projects", cta: "Your projects" };
  if (path.startsWith("/c/") && path.includes("/manage")) return { page: "club management", tip: "The Verify tab lists milestones members asked the club to vouch for. Verify only what the club saw happen." };
  if (path.startsWith("/c/")) return { page: "a club page", tip: "Post here to reach just this club. Club events and verified milestones are what bring members back." };
  if (path.startsWith("/communities")) return { page: "communities", tip: "Search by field or topic, join with one tap, or start the club your field is missing.", href: "/communities?tab=create", cta: "Start a club" };
  if (path.startsWith("/events")) return { page: "events", tip: "RSVP to save your spot and add it to your calendar. Club events show up next to company ones." };
  if (path.startsWith("/network")) return { page: "your network", tip: "Follow people to see their posts in Following. Connect with people you've actually built with." };
  if (path.startsWith("/messages")) return { page: "messages", tip: "Messages from people you're not connected with arrive as requests. You decide who gets through." };
  if (path.startsWith("/settings")) return { page: "settings", tip: "Your headline and interests decide what For you shows and who finds you." };
  if (path.startsWith("/post/")) return { page: "a post", tip: "Comments are where builders help each other. Ask a specific question, or share what worked for you." };
  if (path.startsWith("/saved")) return { page: "your saved posts", tip: "Saved posts are private to you. Save the build logs and write-ups you want to come back to." };
  if (path.startsWith("/notifications")) return { page: "notifications", tip: "Milestone requests from your club members show here. Review them under the club's Manage → Verify." };
  if (path.startsWith("/search")) return { page: "search", tip: "People and clubs that share your interests come first. Press / anywhere to search." };
  if (path.startsWith("/analytics")) return { page: "your analytics", tip: "Only you can see these. Verified milestones and a clear headline are what lift profile views." };
  return { page: "Forge", tip: "Every step below makes your profile easier to find and your work easier to trust." };
}

function Ring({ done, total, size = 56 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - (total ? done / total : 1))} className="transition-[stroke-dashoffset] duration-700" />
    </svg>
  );
}

export function GuideLauncher({ guide, copilot }: { guide: Guide; copilot: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"you" | string>("you");
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[] }[]>([]);
  const [input, setInput] = useState("");
  const ai = useCopilot();
  const answerEnd = useRef<HTMLDivElement>(null);
  // Keep the newest answer in view as it streams in.
  useEffect(() => { answerEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (path.startsWith("/copilot")) return null;
  const tip = tipFor(path);
  const memberDone = guide.member.filter((s) => s.done).length;
  const left = guide.member.length - memberDone + guide.clubs.reduce((n, c) => n + c.steps.filter((s) => !s.done).length, 0);
  const steps = tab === "you" ? guide.member : guide.clubs.find((c) => c.id === tab)?.steps ?? [];
  const next = steps.find((s) => !s.done);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || ai.busy) return;
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    const out = await ai.run({ task: "ask", input: tip.page === "Forge" ? text : `(I'm on ${tip.page} in Forge.) ${text}`, history: history.map(({ role, content }) => ({ role, content })) }, (full, tools, proposals) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full, tools, proposals }]));
    if (out === null) setMsgs((m) => (m.at(-1)?.content === "" ? m.slice(0, -2) : m));
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="forge-guide"
        aria-label={left ? `Open your guide, ${left} steps left` : "Open your guide"}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="bg-accent-grad fixed right-4 bottom-24 z-40 grid size-14 place-items-center rounded-full text-on-accent shadow-[0_14px_34px_-10px_var(--accent)] md:right-6 md:bottom-6"
      >
        <Ring done={memberDone} total={guide.member.length} />
        {open ? <X className="size-6" /> : <Sparkles className="size-6" />}
        {!open && left > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-bg bg-text px-1 text-[10px] font-bold text-bg tabular-nums">{left}</span>}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            id="forge-guide"
            aria-label="Your guide"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-x-3 bottom-40 z-40 flex max-h-[68dvh] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-24px_rgba(0,0,0,0.45)] md:inset-x-auto md:right-6 md:bottom-24 md:w-[400px] md:max-h-[78dvh]"
          >
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="bg-accent-grad grid size-9 place-items-center rounded-xl text-on-accent"><Sparkles className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Your guide</h2>
                <p className="text-xs text-muted">{left ? `${left} step${left === 1 ? "" : "s"} to a profile and club that get noticed` : "All set. Nice work."}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close guide" className="grid size-8 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="flex gap-3 rounded-2xl bg-surface-2 p-3.5 text-sm">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
                <div>
                  <p className="text-text-2">{tip.tip}</p>
                  {tip.href && <Link href={tip.href} onClick={() => setOpen(false)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-text hover:underline">{tip.cta} <ArrowRight className="size-3.5" /></Link>}
                </div>
              </div>

              {guide.clubs.length > 0 && (
                <div role="tablist" aria-label="Guides" className="no-scrollbar mt-4 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
                  {[{ id: "you", name: "You", steps: guide.member }, ...guide.clubs].map((g) => {
                    const d = g.steps.filter((s) => s.done).length;
                    return (
                      <button key={g.id} role="tab" aria-selected={tab === g.id} onClick={() => setTab(g.id)} className={cn("relative shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition", tab === g.id ? "text-on-accent" : "text-muted hover:text-text")}>
                        {tab === g.id && <motion.span layoutId="guide-tab" className="bg-accent-grad absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                        <span className="relative">{g.name} · {d}/{g.steps.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <ol className="mt-4 flex flex-col gap-1.5">
                {steps.map((s) => <StepRow key={s.id} s={s} current={next?.id === s.id} copilot={copilot} onAsk={(q) => void ask(q)} onGo={() => setOpen(false)} />)}
              </ol>

              {msgs.length > 0 && (
                <div className="mt-4 flex flex-col gap-2.5" aria-live="polite">
                  {msgs.map((m, i) => m.role === "user"
                    ? <p key={i} className="bg-accent-grad ml-8 self-end rounded-2xl rounded-br-md px-3 py-2 text-sm text-on-accent">{m.content}</p>
                    : <div key={i} className="mr-4 rounded-2xl rounded-tl-md border border-line px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-text-2"><Lookups tools={m.tools} live={ai.busy && i === msgs.length - 1} />{m.content ? <Rich text={m.content} /> : m.tools?.length ? null : <span className="text-faint">Thinking…</span>}{m.proposals?.map((p) => <ProposalCard key={p.id} p={p} />)}</div>)}
                  <Link href="/copilot" onClick={() => setOpen(false)} className="self-start text-xs text-muted hover:text-text">Continue in Copilot →</Link>
                  <div ref={answerEnd} />
                </div>
              )}
              {ai.error && <p role="alert" className="mt-2 text-xs text-danger">{ai.error}</p>}
            </div>

            {copilot ? (
              <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex items-end gap-2 border-t border-line p-3">
                <label htmlFor="guide-ask" className="sr-only">Ask Copilot about this page</label>
                <textarea id="guide-ask" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input); } }} rows={1} maxLength={1500} placeholder={`Ask Copilot about ${tip.page}`} className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-faint" />
                {ai.busy
                  ? <button type="button" onClick={ai.stop} aria-label="Stop" className="grid size-10 place-items-center rounded-full border border-line"><Square className="size-3.5 fill-current" /></button>
                  : <button type="submit" disabled={!input.trim()} aria-label="Ask" className="bg-accent-grad grid size-10 place-items-center rounded-full text-on-accent disabled:opacity-40"><ArrowUp className="size-4" /></button>}
              </form>
            ) : (
              <p className="border-t border-line px-5 py-3 text-xs text-faint">Copilot answers questions here once it&apos;s switched on.</p>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function StepRow({ s, current, copilot, onAsk, onGo }: { s: GuideStep; current: boolean; copilot: boolean; onAsk: (q: string) => void; onGo: () => void }) {
  return (
    <li className={cn("rounded-2xl transition", current && "border border-line-strong bg-surface-2/60 p-3")}>
      <div className={cn("flex items-center gap-3", !current && "px-3 py-1.5")}>
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 transition", s.done ? "border-transparent bg-ok text-white" : current ? "border-accent" : "border-line-strong")}>
          {s.done && <Check className="size-3.5" />}
        </span>
        <span className={cn("text-sm", s.done ? "text-faint line-through decoration-1" : current ? "font-semibold" : "text-text-2")}>{s.label}</span>
      </div>
      {current && (
        <div className="mt-2 pl-9">
          <p className="text-xs text-muted">{s.why}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link href={s.href} onClick={onGo} className="bg-accent-grad inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-on-accent">Go <ArrowRight className="size-3.5" /></Link>
            {copilot && s.ask && <button type="button" onClick={() => onAsk(s.ask!)} className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs font-medium text-text-2 hover:bg-hover"><Sparkles className="size-3.5" /> Ask Copilot</button>}
          </div>
        </div>
      )}
    </li>
  );
}
