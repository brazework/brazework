"use client";
import { ArrowUp, ShieldCheck, Square, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/forge";

// Ember's composer (app/(app)/copilot): one box that says what Ember can do. You type in it, and the
// row under the text is the things Ember does for you, one tap each (lib/ember-actions.ts): some ask
// right away, others start the sentence and wait for you to finish it. The send button sits in the
// same row. Ember never acts from here: every step comes back as a card the member confirms.

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
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(value); }}
        className={cn("rounded-2xl border border-line bg-surface transition focus-within:border-line-strong", hero ? "shadow-[var(--shadow)]" : "glass")}
      >
        <label htmlFor="copilot-input" className="sr-only">Ask Ember</label>
        <textarea
          id="copilot-input"
          ref={box}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(value); } }}
          rows={hero ? 2 : 1}
          maxLength={4000}
          autoFocus={hero}
          placeholder={hero ? "Ask Ember, or say what you did" : "Reply to Ember"}
          style={{ outline: "none" }}
          className="block max-h-[200px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[16px] leading-relaxed placeholder:text-faint sm:text-[15px]"
        />
        <div className="flex items-end gap-2 p-2">
          {actions.length > 0 ? (
            <ul aria-label="Things Ember can do" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {actions.map((a) => (
                <li key={a.id}>
                  <button type="button" disabled={busy} onClick={() => pick(a)} aria-pressed={a.finish ? value.startsWith(a.text) : undefined}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-medium whitespace-nowrap text-text-2 transition hover:border-line-strong hover:text-text active:scale-[0.97] disabled:opacity-50 aria-pressed:border-text aria-pressed:text-text">
                    <a.icon className="size-3.5 text-muted" aria-hidden="true" /> {a.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="min-w-0 flex-1 self-center truncate pl-2 text-xs text-faint">{remaining !== null ? `${remaining} left today` : "Enter to send, Shift + Enter for a new line"}</span>
          )}
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Stop" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-text transition hover:bg-hover"><Square className="size-3.5 fill-current" /></button>
          ) : (
            <button type="submit" disabled={!value.trim()} aria-label="Send" className="grid size-9 shrink-0 place-items-center rounded-lg bg-text text-surface transition active:scale-95 disabled:opacity-30"><ArrowUp className="size-[18px]" /></button>
          )}
        </div>
      </form>
      {started ? (
        <p role="status" className="mt-2 px-1 text-xs text-muted">{started.finish}</p>
      ) : (
        // Plain disclosure, every time: what Ember is and what it can do on its own (nothing).
        <p className="mt-2 flex items-start justify-center gap-1.5 px-1 text-center text-[11px] text-faint">
          <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>Ember only acts when you confirm a card. It&apos;s AI and can be wrong.{saving ? " Chats are private to you and kept 180 days." : ""} <Link href="/settings#ember" className="underline underline-offset-2 hover:text-text">Privacy</Link></span>
        </p>
      )}
    </div>
  );
}
