"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { changeSchoolEmail } from "@/lib/settings";
import { submitWithoutReset } from "@/lib/submit";

export function SchoolEmailForm({ eligible }: { eligible: boolean }) {
  const [state, action, pending] = useActionState(changeSchoolEmail, { ok: false, message: "" });
  const [email, setEmail] = useState("");
  return (
    <section id="school-email" className="mt-5 scroll-mt-[calc(var(--m-top)+6.5rem)] md:scroll-mt-28 lg:scroll-mt-8 border-t border-line pt-5">
      <h3 className="font-medium">School email</h3>
      {eligible ? (
        <p className="mt-1 text-sm text-muted">Your sign-in email is your school email, so you&apos;re placed in your school and its classes.</p>
      ) : (
        <form onSubmit={submitWithoutReset(action)} className="mt-2 grid max-w-md gap-3">
          <p className="text-sm text-muted">Confirm your school address to be placed in your school and its classes. Your profile and work stay with you when it becomes your sign-in email.</p>
          <Field label="School email">
            <input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="outline" disabled={pending}>{pending ? "Sending…" : "Switch to school email"}</Button>
            <Link id="request-school" href={`/request-school?email=${encodeURIComponent(email)}`} className="text-sm text-muted underline underline-offset-4">Request your school</Link>
          </div>
          {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-ok" : "text-sm text-danger"}>{state.message}</p>}
        </form>
      )}
    </section>
  );
}
