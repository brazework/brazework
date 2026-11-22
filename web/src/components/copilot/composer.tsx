"use client";
import { emberCreditCost } from "@/lib/ember-credits";
import { ArrowUp, Check, ChevronDown, ShieldCheck, Sparkles, Square, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";

// Ember's composer (app/(app)/copilot): a roomy box to type in, with one row of controls along its
// bottom edge (Linear FIX-219): "Asks first" (how Ember works: every step comes back as a card the
// member confirms), what Ember reads when you ask, and send. On a new chat the things Ember does for
// you sit above the box, one tap each (lib/ember-actions.ts): some ask right away, others start the
// sentence and wait for you to finish it. On a phone the row keeps to one line: the labels shorten
// and the hint goes. Ember never acts from here.

export type ComposerAction = { id: string; label: string; icon: LucideIcon; text: string; finish?: string };

export function EmberComposer({ value, onChange, onSend, onStop, busy, actions = [], hero = false, saving = false, remaining = null }: {
  value: string; onChange: (v: string) => void; onSend: (text: string) => void; onStop: () => void; busy: boolean;
  /** The one-tap things Ember does. Shown on a new chat; a conversation shows Ember's own next steps instead. */
  actions?: ComposerAction[];
  /** A new chat: the box is the page's main thing (taller, focused, with the actions). */
  hero?: boolean; saving?: boolean; remaining?: number | null;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  // Grows with what's typed, up to about eight lines, then scrolls.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);
  // An action that starts a sentence shows what to add, in the placeholder's place.
  const started = actions.find((a) => a.finish && value === a.text);
  const pick = (a: ComposerAction) => {
    if (!a.finish) { onSend(a.text); return; }
    onChange(a.text);
    const el = box.current;
    if (el) { el.focus(); requestAnimationFrame(() => el.setSelectionRange(a.text.length, a.text.length)); }
  };
  return (
    <div>
      {/* A new chat: the things Ember does, one tap each, above the box. */}
      {actions.length > 0 && (
        // On a phone they're one row you swipe along (eight would stack four deep above the box and
        // push it down the screen); from a tablet up there's room to wrap.
        <ul aria-label="Things Ember can do" className="no-scrollbar -mx-4 mb-2.5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {actions.map((a) => (
            <li key={a.id} className="shrink-0">
              <button type="button" disabled={busy} onClick={() => pick(a)} aria-pressed={a.finish ? value.startsWith(a.text) : undefined}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium whitespace-nowrap text-text-2 transition hover:border-line-strong hover:text-text active:scale-[0.97] disabled:opacity-50 aria-pressed:border-text aria-pressed:text-text">
                <a.icon className="size-3.5 text-muted" aria-hidden="true" /> {a.label}{!a.finish && <span className="text-xs text-muted">· {emberCreditCost("ask")}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(value); }}
        // A hairline box with a soft second edge around it, so it reads as the place to type on any
        // background; the edge darkens while you're in it.
        className={cn("rounded-[1.25rem] border border-line-strong bg-surface shadow-[0_0_0_4px_color-mix(in_oklab,var(--text)_5%,transparent)] transition focus-within:border-[color-mix(in_oklab,var(--text)_55%,transparent)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--text)_9%,transparent)]", !hero && "glass")}
      >
        <label htmlFor="copilot-input" className="sr-only">Ask Ember</label>
        <textarea
          id="copilot-input"
          ref={box}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(value); } }}
          rows={hero ? 3 : 1}
          maxLength={4000}
          autoFocus={hero}
          placeholder={hero ? "Ask Ember, or say what you did" : "Reply to Ember"}
          style={{ outline: "none" }}
          className={cn("block max-h-[200px] w-full resize-none bg-transparent px-4 pb-1 leading-relaxed placeholder:text-faint sm:px-5", hero ? "pt-4 text-[17px]" : "pt-3.5 text-[16px] sm:text-[15px]")}
        />
        {/* The row along the bottom of the box: how Ember works, what it reads, and send. */}
        <div className="flex items-center gap-2 px-2.5 pt-1 pb-2.5 sm:px-3 sm:pb-3">
          <Link href="/settings#ember" title="Ember prepares each step as a card. Nothing is saved or sent until you confirm it."
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line px-2.5 text-[13px] font-medium text-text-2 transition hover:border-line-strong hover:text-text sm:px-3">
            <ShieldCheck className="size-4 text-muted" aria-hidden="true" /> Asks first
          </Link>
          <Reads />
          <span className="ml-auto shrink-0 text-xs text-muted">{emberCreditCost("ask")}</span>
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Stop" className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl border border-line text-text transition hover:bg-hover sm:ml-0"><Square className="size-3.5 fill-current" /></button>
          ) : (
            <button type="submit" disabled={!value.trim()} aria-label="Send" className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl bg-text text-surface transition active:scale-95 disabled:opacity-30 sm:ml-0"><ArrowUp className="size-[18px]" /></button>
          )}
        </div>
      </form>
      {remaining !== null && <p className="mt-2 px-1 text-right text-xs text-muted">{remaining} credits left today</p>}
      {started ? (
        <p role="status" className="mt-2.5 px-1 text-xs text-muted">{started.finish}</p>
      ) : (
        // Plain disclosure, every time: what Ember is and what it can do on its own (nothing).
        <p className="mt-2.5 flex items-start gap-1.5 px-1 text-xs text-faint">
          <Sparkles className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>Ember only acts when you confirm a card. It&apos;s AI and can be wrong.{saving ? " Chats are private to you and kept 180 days." : ""} <Link href="/settings#ember" className="underline underline-offset-2 hover:text-text">Privacy</Link></span>
        </p>
      )}
    </div>
  );
}

// What Ember reads when you ask, as a control in the box's row: closed, it names the main thing (your
// record); open, it lists the rest. Only what its tools really look up (lib/copilot-tools.ts), and
// what it never does. Opens upward, so it isn't cut off by the bottom of the screen in a chat.
const READS = ["Your profile, projects and record", "What's signed, what's waiting and who you've asked", "Your clubs and their events", "People and clubs on Brazework", "Your notifications"];
function Reads() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={wrap} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="ember-reads"
        className="inline-flex h-9 max-w-full items-center gap-2 rounded-xl border border-line px-2.5 text-[13px] font-medium text-text-2 transition hover:border-line-strong hover:text-text aria-expanded:border-text aria-expanded:text-text sm:px-3">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-ok" />
        <span className="truncate">Your record<span className="hidden font-normal text-muted sm:inline"> · clubs · events</span></span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div id="ember-reads" role="group" aria-label="What Ember reads" className="absolute bottom-full left-0 z-30 mb-2 w-[min(19rem,calc(100vw-3rem))] rounded-2xl border border-line-strong bg-surface p-4 shadow-[var(--shadow-float)]">
          <p className="text-sm font-semibold">What Ember reads when you ask</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px] leading-snug text-text-2">
            {READS.map((r) => <li key={r} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />{r}</li>)}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">It never signs or verifies work. Only people do.</p>
        </div>
      )}
    </div>
  );
}
