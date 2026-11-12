"use client";
import { BadgeCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { answerVouch } from "@/lib/vouches";

// The two questions that make a vouch mean something (what you saw, how you know their work), then
// vouch or decline. What they write is shown on the member's record with their name and domain.
export function AnswerForm({ token, domain }: { token: string; domain: string }) {
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [f, setF] = useState({ name: "", title: "", saw: "", knowsFrom: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const send = (vouch: boolean) => start(async () => setDone(await answerVouch({ token, vouch, ...f })));

  if (done?.ok) return <p role="status" className="mt-6 flex items-start gap-2 rounded-xl border border-line bg-surface-2/60 p-4 text-sm"><BadgeCheck className="mt-0.5 size-4 shrink-0" /> {done.message}</p>;
  const field = "mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-line-strong";
  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); send(true); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Your name<input required minLength={2} maxLength={80} autoComplete="name" value={f.name} onChange={set("name")} className={field} /></label>
        <label className="text-sm font-medium">Your role <span className="font-normal text-faint">(optional)</span><input maxLength={80} placeholder="e.g. Assistant Professor" autoComplete="organization-title" value={f.title} onChange={set("title")} className={field} /></label>
      </div>
      <label className="text-sm font-medium">What did you see them do?
        <textarea required minLength={20} maxLength={600} rows={3} placeholder="e.g. I watched the calibration run in the lab; the readings matched the reference." value={f.saw} onChange={set("saw")} className={field} />
      </label>
      <label className="text-sm font-medium">How do you know their work?
        <input required minLength={3} maxLength={300} placeholder="e.g. I'm their research advisor" value={f.knowsFrom} onChange={set("knowsFrom")} className={field} />
      </label>
      <p className="text-xs text-faint">Shown on their record as your name, role and <b className="font-medium">{domain}</b>, with what you wrote.</p>
      {done && !done.ok && <p role="alert" className="text-sm text-danger">{done.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}><BadgeCheck className="size-4" /> Vouch</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => send(false)}>I can&apos;t vouch for this</Button>
      </div>
    </form>
  );
}
