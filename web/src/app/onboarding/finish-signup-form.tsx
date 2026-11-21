"use client";
import { Briefcase, GraduationCap, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { SignupSteps } from "@/components/signup-steps";
import { Button, Field, inputCls } from "@/components/ui";
import { ACADEMIC_RE, cn } from "@/lib/forge";
import { LINKEDIN_PLACEHOLDER, LINKEDIN_PRIVATE } from "@/lib/linkedin";
import { submitWithoutReset } from "@/lib/submit";
import { finishSignup, type FinishState } from "./actions";

// "About you": the second step for everyone, however they signed up (email and password, or Google,
// GitHub or LinkedIn). Student or professional, name, birthday. The database holds these to the
// sign-up rules (finish_signup()); names start from the provider's when there is one.
// askLinkedin: a professional is offered a LinkedIn profile link, optional here; they need it later
// to ask someone to sign (supabase/linkedin-required.sql has run; Linear FIX-214). Students aren't asked.
export function FinishSignupForm({ email, provider, firstName, lastName, askLinkedin = false }: { email: string; provider?: string; firstName: string; lastName: string; askLinkedin?: boolean }) {
  const [state, action, pending] = useActionState<FinishState, FormData>(finishSignup, { message: "" });
  const [type, setType] = useState<"student" | "professional" | "">("");
  // An academic address is certain; a listed school without one (school_domains) is only known to
  // the database, so a non-academic email is a heads-up, not a block.
  const notAcademic = type === "student" && !ACADEMIC_RE.test(email);
  const choices = [
    { id: "student", label: "Student", hint: "At a college or university. Your club verifies your work.", icon: GraduationCap },
    { id: "professional", label: "Professional", hint: "Employed, freelancing or building on your own.", icon: Briefcase },
  ] as const;

  return (
    <div className="flex max-w-md flex-col gap-5">
      <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-5">
        <SignupSteps at="about" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">About you</h1>
          <p className="mt-2 text-muted">
            {provider ? <>Signed in with {provider} as </> : <>Signed in as </>}
            <span className="text-text">{email}</span>. A few quick things, then your first build.
          </p>
        </div>
        <input type="hidden" name="accountType" value={type} />
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-medium text-text-2">How will you use Brazework?</legend>
          {choices.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={type === c.id}
              onClick={() => setType(c.id)}
              className={cn("relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition", type === c.id ? "border-accent bg-accent/[0.07]" : "border-line hover:border-line-strong")}
            >
              <c.icon className={cn("size-5", type === c.id ? "text-accent" : "text-faint")} />
              <span className="mt-1 font-medium">{c.label}</span>
              <span className="text-xs text-muted">{c.hint}</span>
            </button>
          ))}
        </fieldset>
        {notAcademic && !state.school && (
          <p className="-mt-2 text-xs text-muted">
            Student accounts use a university email. <span className="text-text">{email}</span> doesn&apos;t look like one; if your school uses its own domain, continue and we&apos;ll check.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input name="firstName" autoComplete="given-name" maxLength={80} defaultValue={firstName} className={inputCls} /></Field>
          <Field label="Last name"><input name="lastName" autoComplete="family-name" maxLength={80} defaultValue={lastName} className={inputCls} /></Field>
        </div>
        <Field label="Birthday" hint="Private, never shown. Brazework is for people 18 and older."><input name="birthday" type="date" autoComplete="bday" className={inputCls} /></Field>
        {askLinkedin && type === "professional" && (
          <Field label="LinkedIn profile" optional hint={`You'll need it to ask someone to sign your work. ${LINKEDIN_PRIVATE}`}>
            <input name="linkedin" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} placeholder={LINKEDIN_PLACEHOLDER} className={inputCls} />
          </Field>
        )}
        {state.message && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{state.message}</p>}
        {state.school && (
          <p className="-mt-2 text-sm text-muted">
            {email} isn&apos;t a university email we know. Choose Professional, or log out and sign up with your school email. School not recognized?{" "}
            <Link id="request-school" href={`/request-school?email=${encodeURIComponent(email)}`} className="text-accent hover:underline">Request your school</Link>
          </p>
        )}
        {!type && <p className="-mb-2 text-xs text-muted">Choose <b className="font-medium text-text-2">Student</b> or <b className="font-medium text-text-2">Professional</b> above to continue.</p>}
        <Button type="submit" size="lg" disabled={pending || !type}>{pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Saving…" : "Continue"}</Button>
      </form>
      <form action="/auth/signout" method="post">
        <p className="text-sm text-faint">Not the right account? <button type="submit" className="text-accent hover:underline">Log out and start over</button></p>
      </form>
    </div>
  );
}
