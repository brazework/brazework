"use client";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { inputCls } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { handOffRole } from "../../../communities/actions";

// End of term: pass your officer role to a successor. You stay in the club as a member; the club,
// members, history and integrations carry over unchanged.
export function HandOff({ cid, role, candidates }: { cid: string; role: string; candidates: { uid: string; name: string; role: string }[] }) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const who = candidates.find((c) => c.uid === to);
  return (
    <div className="max-w-xl rounded-3xl border border-line bg-surface p-6">
      <div className="flex items-center gap-2 font-semibold"><ArrowRightLeft className="size-4" /> Hand off your role</div>
      <p className="mt-2 text-sm text-muted">
        Graduating or stepping down? Pick who takes over as <b className="font-medium text-text-2">{role}</b>. You&apos;ll stay in the club as a member,
        and everything carries over: members, posts, events, verified work and integrations.
      </p>
      {candidates.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Your successor needs to be in the club first. Invite them, then come back.</p>
      ) : (
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => {
          e.preventDefault();
          if (!who || !confirm(`Make ${who.name} the club's ${role}? You'll become a member.`)) return;
          start(async () => {
            const r = await handOffRole(cid, to, note);
            setMsg({ ok: r.ok, text: r.message });
            // You're not an officer any more: back to the club, where you're a member.
            if (r.ok) router.push(`/c/${cid}`);
          });
        }}>
          <label className="text-sm font-medium" htmlFor="handoff-to">Successor</label>
          <select id="handoff-to" value={to} onChange={(e) => setTo(e.target.value)} required className={inputCls}>
            <option value="">Choose a member</option>
            {candidates.map((c) => <option key={c.uid} value={c.uid}>{c.name} ({c.role})</option>)}
          </select>
          <label className="text-sm font-medium" htmlFor="handoff-note">Note for the club (optional)</label>
          <input id="handoff-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Graduating in May; Josh runs it next year" className={inputCls} />
          {msg && <p role="status" className={msg.ok ? "text-sm text-ok" : "text-sm text-danger"}>{msg.text}</p>}
          <button type="submit" disabled={!to || pending || msg?.ok} className="bg-accent-grad inline-flex h-11 items-center justify-center gap-2 self-start rounded-full px-5 text-sm font-semibold text-on-accent disabled:opacity-50">
            {pending && <Loader2 className="size-4 animate-spin" />} Hand off
          </button>
        </form>
      )}
    </div>
  );
}
