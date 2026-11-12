"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { TOPICS, cn } from "@/lib/forge";
import { completeOnboarding, type OnboardState } from "./actions";
import { submitWithoutReset } from "@/lib/submit";
import { gradYearOptions } from "@/lib/profile-meta";

export function OnboardingForm({ firstName, student, askGradYear = false }: { firstName: string; student: boolean; askGradYear?: boolean }) {
  const [state, action, pending] = useActionState<OnboardState, FormData>(completeOnboarding, { message: "" });
  const [field, setField] = useState<string>(TOPICS[0].name);
  const [picked, setPicked] = useState<string[]>([]);
  const [headline, setHeadline] = useState("");
  const need = Math.max(0, 3 - picked.length);
  const toggle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const group = TOPICS.find((t) => t.name === field) ?? TOPICS[0];

  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-8">
      <div>
        <div className="text-[11px] font-medium tracking-[0.06em] text-accent uppercase">Step 3 of 3</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Welcome{firstName ? `, ${firstName}` : ""}. <span className="text-shine">What do you build?</span>
        </h1>
      </div>

      {askGradYear && (
        <Field label="When do you graduate?" optional hint="Companies looking for interns filter by class year. You can change it in Settings.">
          <select name="grad_year" defaultValue="" className={inputCls}>
            <option value="">Not sure yet</option>
            {gradYearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
      )}

      <Field label={student ? "Your major" : "Your profession"} optional count={headline.length} max={200} hint="Shown under your name. You can change it any time.">
        <input name="headline" maxLength={200} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={student ? "e.g. Mechanical Engineering, junior" : "e.g. Embedded Engineer at a robotics startup"} className={inputCls} />
      </Field>

      <div>
        <div id="ob-field-label" className="mb-3 text-sm font-medium text-text-2">Your field <span className="font-normal text-faint">(it also shows its interests below)</span></div>
        <input type="hidden" name="field" value={field} />
        <div role="radiogroup" aria-labelledby="ob-field-label" className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button key={t.name} type="button" role="radio" aria-checked={field === t.name} onClick={() => setField(t.name)} className="relative rounded-lg border border-line px-4 py-2 text-sm text-muted transition aria-checked:border-transparent aria-checked:text-on-accent">
              {field === t.name && <motion.span layoutId="ob-field" className="absolute inset-0 rounded-full bg-accent" />}
              <span className="relative">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between text-sm">
          <span className="font-medium text-text-2">Interests <span className="text-faint">(pick at least 3, from any field)</span></span>
          <span className={cn("font-mono tabular-nums", picked.length >= 3 ? "text-ok" : "text-faint")}>{picked.length} picked</span>
        </div>
        {picked.map((t) => <input key={t} type="hidden" name="interests" value={t} />)}
        <AnimatePresence mode="wait">
          <motion.div key={group.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-wrap gap-2">
            {group.topics.map((t) => {
              const on = picked.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => toggle(t)} className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm transition", on ? "border-accent bg-accent/10 text-accent" : "border-line text-text-2 hover:border-line-strong")}>
                  {on && <Check className="size-3.5" />} {t}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
        {picked.some((t) => !(group.topics as readonly string[]).includes(t)) && (
          <p className="mt-3 text-xs text-faint">Also picked: {picked.filter((t) => !(group.topics as readonly string[]).includes(t)).join(", ")}</p>
        )}
      </div>

      {state.message && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending || need > 0}>
          {pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Setting up your feed…" : "Enter Brazework"}
        </Button>
        <span aria-live="polite" className={cn("text-sm", need ? "text-muted" : "text-ok")}>{need ? `Pick ${need} more interest${need === 1 ? "" : "s"} to continue` : "You're all set"}</span>
      </div>
    </form>
  );
}
