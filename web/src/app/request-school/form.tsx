"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useTransition, useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { decideSchool, requestSchool, type SchoolState } from "@/lib/schools";
import { submitWithoutReset } from "@/lib/submit";

const init: SchoolState = { ok: false, message: "" };

export function RequestSchoolForm({ domain }: { domain: string }) {
  const [s, action, pending] = useActionState(requestSchool, init);
  if (s.ok) return (
    <div className="flex flex-col items-start gap-4">
      <p role="status" className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-text-2">{s.message}</p>
      <Link href="/signup" className="text-sm font-medium underline">Back to sign up</Link>
    </div>
  );
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-col gap-4">
      <Field label="Your school's email domain" hint="The part after @ in your school email, like hartford.edu."><input id="school-domain" name="domain" defaultValue={domain} required maxLength={120} className={inputCls} /></Field>
      <Field label="School name"><input id="school-name" name="school" required maxLength={160} className={inputCls} placeholder="University of Hartford" /></Field>
      <Field label="How to reach you" optional hint="So we can tell you when it's added."><input name="contact" maxLength={200} className={inputCls} placeholder="Your school email" /></Field>
      {s.message && <p role="alert" className="text-sm text-danger">{s.message}</p>}
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Request my school</Button>
    </form>
  );
}

export function SchoolDecision({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<SchoolState>(init);
  const run = (add: boolean) => start(async () => setMsg(await decideSchool(id, add)));
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run(true)} className="h-8 rounded-full bg-accent px-3 text-xs font-medium text-on-accent disabled:opacity-50">Add school</button>
      <button type="button" disabled={pending} onClick={() => run(false)} className="h-8 rounded-full border border-line px-3 text-xs hover:bg-hover disabled:opacity-50">Dismiss</button>
      {msg.message && !msg.ok && <span role="alert" className={cn("text-xs text-danger")}>{msg.message}</span>}
    </span>
  );
}
