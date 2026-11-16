"use client";
import { Check, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { registerOrgInterest, type OrgInterestState } from "@/app/actions/org-interest";
import { Button, Field, inputCls } from "@/components/ui";
import { submitWithoutReset } from "@/lib/submit";
import { H2 } from "./sections";

// The founding clubs form: a club (or a company) leaves its name and the founders get in touch.
const TYPES = [{ id: "club", label: "Club or study group" }, { id: "company", label: "Company" }] as const;

export function Organizations() {
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("club");
  const [state, action, pending] = useActionState<OrgInterestState, FormData>(registerOrgInterest, { ok: false, message: "" });

  return (
    <section id="founding" className="scroll-mt-20 pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid grid-cols-1 gap-10 rounded-[1.25rem] border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <h2 className={H2}>Be one of the first clubs on Brazework.</h2>
            <ul className="mt-7 flex flex-col gap-3 text-[15px] text-text-2">
              {["We set your club up with you, personally.", "Your requests shape what we build next.", "Free for your club and every member."].map((x) => <li key={x} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-ok" />{x}</li>)}
            </ul>
            <p className="mt-7 text-sm text-muted">Hiring or sponsoring? Pick Company in the form and we&apos;ll set up a pilot with you.</p>
          </div>

          {state.ok ? (
            <div role="status" className="flex min-h-[22rem] flex-col justify-center">
              <span className="grid size-10 place-items-center rounded-full bg-ok text-white dark:text-[#06240f]"><Check className="size-5" strokeWidth={3} /></span>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">Thanks, {state.contact}.</h3>
              <p className="mt-2 max-w-sm text-muted">We&apos;ve noted {state.name}&apos;s interest and will reach out personally. Early partners get set up by the founders.</p>
            </div>
          ) : (
            <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
              <h3 className="text-xl font-semibold tracking-tight">Apply to be a founding club</h3>
              <input type="hidden" name="type" value={type} />
              <div role="group" aria-label="Organization type" className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className="h-9 rounded-lg border border-line px-4 text-sm text-text-2 transition hover:border-line-strong aria-pressed:border-transparent aria-pressed:bg-accent aria-pressed:text-on-accent">
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={type === "club" ? "Club name" : "Company name"}><input name="name" maxLength={120} autoComplete="organization" className={inputCls} required /></Field>
                <Field label="Your name"><input name="contact" maxLength={80} autoComplete="name" className={inputCls} required /></Field>
                <Field label={type === "company" ? "Work email" : "School email"}><input name="email" type="email" maxLength={120} autoComplete="email" className={inputCls} required /></Field>
                <Field label="Your role"><input name="role" maxLength={60} placeholder={type === "club" ? "e.g. President" : "e.g. University recruiter"} className={inputCls} /></Field>
              </div>
              <p role="status" className="min-h-5 text-sm text-danger">{state.message}</p>
              <Button type="submit" size="lg" disabled={pending} className="self-start">
                {pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Sending…" : "Register interest"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
