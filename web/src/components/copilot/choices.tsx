// No "use client" of its own: it's only used inside client components (the bar, Torch's page).
import { emberCreditCost } from "@/lib/ember-credits";

// Answers Torch offered as buttons (offer_choices; docs/superpowers/specs/2026-11-26-ember-follow-through-design.md,
// part 2), under its question on Torch's page and in the Ask Torch bar. Tapping one sends it as the
// member's answer; typing something else works too, and the buttons go away either way. They stand out
// more than the quiet follow-up chips, which don't show while Torch is waiting on an answer.
export function ChoiceButtons({ options, onPick, disabled = false, typeHint = "type your own answer" }: { options: string[]; onPick: (o: string) => void; disabled?: boolean; typeHint?: string }) {
  return (
    <div role="group" aria-label="Answer Torch" className="mt-3 whitespace-normal">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" disabled={disabled} onClick={() => onPick(o)} className="min-h-10 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-left text-sm font-medium text-text shadow-[var(--shadow)] transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:opacity-50">
            {o}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">Tap one, or {typeHint} · {emberCreditCost("ask")}</p>
    </div>
  );
}
