"use client";

import { useActionState, useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { moveToPersonalEmail } from "@/lib/settings";
import { submitWithoutReset } from "@/lib/submit";

// Graduating: shown while you sign in with a school email (lib/graduate-email.ts).
export function PersonalEmailForm({ student }: { student: boolean }) {
  const [state, action, pending] = useActionState(moveToPersonalEmail, { ok: false, message: "" });
  const [email, setEmail] = useState("");
  return (
    <section id="personal-email" className="mt-5 scroll-mt-[calc(var(--m-top)+6.5rem)] md:scroll-mt-28 lg:scroll-mt-8 border-t border-line pt-5">
      <h3 className="font-medium">Graduating?</h3>
      <form onSubmit={submitWithoutReset(action)} className="mt-2 grid max-w-md gap-3">
        <p className="text-sm text-muted">Move your sign-in to a personal email before your school one stops working. Your profile, projects, verified work and past classes stay with you. Your school&apos;s page and this term&apos;s classes leave your sidebar.</p>
        <Field label="Personal email">
          <input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        {student && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="working" defaultChecked className="size-4 accent-[var(--text)]" />
            Switch my account to Working too
          </label>
        )}
        <div><Button type="submit" variant="outline" disabled={pending}>{pending ? "Sending…" : "Move to personal email"}</Button></div>
        {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-ok" : "text-sm text-danger"}>{state.message}</p>}
      </form>
    </section>
  );
}
