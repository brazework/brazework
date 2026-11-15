"use client";
import { BadgeCheck, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { confirmedBy } from "@/lib/study";
import { setStudyLead } from "@/lib/study-actions";

type Person = { uid: string; first: string; last: string; n: number; mine: boolean };

// A study group's "Who led it?": members confirm the people who ran its sessions, and each confirmation
// goes on that person's profile as proof (supabase/study-groups.sql). Members see a Confirm button on
// everyone but themselves; others see who was confirmed.
export function StudyLeads({ cid, me, member, people }: { cid: string; me: string; member: boolean; people: Person[] }) {
  const [rows, setRows] = useState(people);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();
  const shown = member ? rows : rows.filter((p) => p.n > 0);
  if (!shown.length) return null;
  const toggle = (p: Person) => {
    setBusy(p.uid);
    setMsg("");
    start(async () => {
      const r = await setStudyLead(cid, p.uid, !p.mine);
      setBusy(null);
      setMsg(r.message);
      if (r.ok) setRows((all) => all.map((x) => (x.uid === p.uid ? { ...x, mine: !p.mine, n: x.n + (p.mine ? -1 : 1) } : x)));
    });
  };
  return (
    <section aria-label="Who led it" className="mt-4 rounded-3xl border border-line bg-surface p-4">
      <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Who led it?</h2>
      {member && <p className="mt-1 text-sm text-text-2">Confirm the people who ran sessions. It goes on their profile as proof.</p>}
      <ul className="mt-3 flex flex-col gap-1">
        {[...shown].sort((a, b) => b.n - a.n).map((p) => (
          <li key={p.uid} className="flex items-center gap-3 rounded-2xl px-2 py-1.5">
            <Link href={`/u/${p.uid}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{`${p.first} ${p.last}`.trim() || "A member"}</Link>
            {p.n > 0 && <span className="inline-flex items-center gap-1 text-xs text-muted"><BadgeCheck className="size-3.5 text-ok" /> {confirmedBy(p.n)}</span>}
            {member && p.uid !== me && (
              <button type="button" onClick={() => toggle(p)} disabled={busy === p.uid} aria-pressed={p.mine}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-xs font-medium transition hover:bg-hover aria-pressed:border-text aria-pressed:bg-raised">
                {busy === p.uid ? <Loader2 className="size-3.5 animate-spin" /> : p.mine ? <Check className="size-3.5" /> : null}
                {p.mine ? "Confirmed" : "Confirm they led"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {msg && <p role="status" className="mt-2 text-xs text-muted">{msg}</p>}
    </section>
  );
}
