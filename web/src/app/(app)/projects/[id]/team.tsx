"use client";
import { Loader2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { addTeammate, removeTeammate } from "@/lib/project-team";

type Person = { id: string; first: string; last: string; headline?: string };

// The project's team, after the owner. The owner adds people from their clubs and removes anyone;
// a teammate can leave. Teammates never verify the project's milestones.
export function TeamList({ projectId, team, candidates, own, me }: { projectId: string; team: Person[]; candidates: Person[]; own: boolean; me: string }) {
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? "" : r.message); if (r.ok) setPick(""); });
  const left = candidates.filter((c) => !team.some((t) => t.id === c.id));
  return (
    <div className="mt-3 flex flex-col gap-2" aria-label="Team">
      {team.map((t) => (
        <div key={t.id} className="flex items-center gap-3">
          <Link href={`/u/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar first={t.first} last={t.last} size={32} />
            <span className="min-w-0"><span className="block truncate text-sm font-medium hover:underline">{`${t.first} ${t.last}`.trim()}</span>{t.headline && <span className="block truncate text-xs text-muted">{t.headline}</span>}</span>
          </Link>
          {(own || t.id === me) && (
            <button type="button" disabled={pending} onClick={() => run(() => removeTeammate(projectId, t.id))} aria-label={t.id === me ? "Leave the team" : `Remove ${t.first}`} title={t.id === me ? "Leave the team" : "Remove"} className="grid size-7 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-text">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {own && (
        left.length ? (
          <div className="mt-1 flex items-center gap-2">
            <select id="team-add" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add a teammate" className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 text-sm">
              <option value="">Add a teammate…</option>
              {left.map((c) => <option key={c.id} value={c.id}>{`${c.first} ${c.last}`.trim()}</option>)}
            </select>
            <button type="button" disabled={!pick || pending} onClick={() => run(() => addTeammate(projectId, pick))} aria-label="Add teammate" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent disabled:opacity-40">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            </button>
          </div>
        ) : <p className="text-xs text-faint">Teammates come from your clubs. Join one to add them.</p>
      )}
      {own && <p className="text-[11px] text-faint">Teammates can&apos;t verify this project&apos;s milestones.</p>}
      {msg && <p role="alert" className="text-xs text-danger">{msg}</p>}
    </div>
  );
}
