"use client";

import { ArrowRight, Briefcase, Check, GraduationCap, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { SignupSteps } from "@/components/signup-steps";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { submitWithoutReset } from "@/lib/submit";
import { finishSignup, type FinishState } from "./actions";

const CHOICES = [
  { id: "student", label: "Student", hint: "Coursework, research, clubs, or personal projects.", icon: GraduationCap },
  { id: "professional", label: "Professional", hint: "Work, freelance, or independent projects.", icon: Briefcase },
] as const;

export function FinishSignupForm({ email, provider, firstName, lastName }: { email: string; provider?: string; firstName: string; lastName: string }) {
  const [state, action, pending] = useActionState<FinishState, FormData>(finishSignup, { message: "" });
  const [type, setType] = useState<(typeof CHOICES)[number]["id"] | "">("");

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-6">
        <SignupSteps at="about" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About you</h1>
          <p className="mt-2 break-words text-sm text-muted">
            {provider ? `Signed in with ${provider} as ` : "Signed in as "}
            <span className="font-medium text-text">{email}</span>
          </p>
        </div>
        <input type="hidden" name="accountType" value={type} />
        <fieldset className="grid gap-2 sm:grid-cols-2 sm:gap-3">
          <legend className="mb-2 text-sm font-medium text-text-2">How will you use Brazework?</legend>
          {CHOICES.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={type === id}
              onClick={() => setType(id)}
              className={cn("flex items-start gap-3 rounded-2xl border p-3.5 text-left transition", type === id ? "border-accent bg-accent/[0.07]" : "border-line hover:border-line-strong")}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2">
                <Icon className="size-4 text-text-2" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1"><span className="block font-medium">{label}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted">{hint}</span></span>
              {type === id && <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />}
            </button>
          ))}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input name="firstName" autoComplete="given-name" maxLength={80} required defaultValue={firstName} className={inputCls} /></Field>
          <Field label="Last name"><input name="lastName" autoComplete="family-name" maxLength={80} required defaultValue={lastName} className={inputCls} /></Field>
        </div>
        <Field label="Birthday" hint="Kept private. You must be at least 18 to join.">
          <input name="birthday" type="date" autoComplete="bday" required className={inputCls} />
        </Field>
        {state.message && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{state.message}</p>}
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:items-end">
          <Button type="submit" size="lg" disabled={pending || !type}>
            {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <>Continue <ArrowRight className="size-4" aria-hidden="true" /></>}
          </Button>
        </div>
      </form>
      <form action="/auth/signout" method="post">
        <button type="submit" className="text-sm text-muted underline underline-offset-4 hover:text-text">Use a different account</button>
      </form>
    </div>
  );
}
