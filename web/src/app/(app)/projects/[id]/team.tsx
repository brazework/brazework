"use client";
import { Eye, Globe2, Loader2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/forge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar, selectPillCls } from "@/components/ui";
import { setProjectPrivate } from "@/lib/projects";
import { addTeammate, removeTeammate, setTeamRole, type TeamRole } from "@/lib/project-team";

type Person = { id: string; first: string; last: string; headline?: string; role?: TeamRole };
const ROLE_LABEL: Record<TeamRole, string> = { admin: "Admin", member: "Teammate", viewer: "Viewer" };

// Who's on the project, after the owner: admins and teammates (who build it) and, for the people
// managing it, viewers (who can see it while it's private). The owner and admins add people from
// their clubs and remove them; the owner also makes admins. Anyone can leave. People on a project
// never verify its milestones.
export function TeamList({ projectId, people, candidates, manage, isOwner, roles, me }: { projectId: string; people: Person[]; candidates: Person[]; manage: boolean; isOwner: boolean; roles: boolean; me: string }) {
  const [pick, setPick] = useState("");
  const [as, setAs] = useState<TeamRole>("member");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => { const r = await fn(); setMsg({ ok: r.ok, text: r.message }); if (r.ok) setPick(""); });
  const left = candidates.filter((c) => !people.some((t) => t.id === c.id));
  const builders = people.filter((t) => t.role !== "viewer");
  const viewers = people.filter((t) => t.role === "viewer");
  // What you may change about someone: the owner anyone; an admin teammates and viewers.
  const canTouch = (t: Person) => manage && (isOwner || t.role !== "admin");

  const row = (t: Person) => (
    <div key={t.id} className="flex items-center gap-3">
      <Link href={`/u/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar first={t.first} last={t.last} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium hover:underline">{`${t.first} ${t.last}`.trim()}{t.id === me && <span className="font-normal text-faint"> (you)</span>}</span>
          {roles && !canTouch(t) && t.role !== "member" ? <span className="block truncate text-xs text-muted">{ROLE_LABEL[t.role ?? "member"]}</span> : t.headline && <span className="block truncate text-xs text-muted">{t.headline}</span>}
        </span>
      </Link>
      {roles && canTouch(t) && (
        <select value={t.role ?? "member"} disabled={pending} onChange={(e) => run(() => setTeamRole(projectId, t.id, e.target.value as TeamRole))} aria-label={`Role for ${t.first}`} className={cn(selectPillCls, "w-auto shrink-0 text-xs")}>
          {isOwner && <option value="admin">Admin</option>}
          <option value="member">Teammate</option>
          <option value="viewer">Viewer</option>
        </select>
      )}
      {(canTouch(t) || t.id === me) && (
        <button type="button" disabled={pending} onClick={() => { if (t.id !== me || confirm("Leave this project?")) run(() => removeTeammate(projectId, t.id)); }} aria-label={t.id === me ? "Leave the project" : `Remove ${t.first}`} title={t.id === me ? "Leave" : "Remove"} className="grid size-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-hover hover:text-text">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="mt-3 flex flex-col gap-2" aria-label="Team">
      {builders.map(row)}
      {manage && viewers.length > 0 && (
        <>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted"><Eye className="size-3.5" /> Can view</p>
          {viewers.map(row)}
        </>
      )}
      {!manage && viewers.some((v) => v.id === me) && <p className="text-xs text-muted">You can view this project.</p>}
      {manage && (
        left.length ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <select id="team-add" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add someone" className={cn(selectPillCls, "min-w-0 flex-1")}>
              <option value="">Add someone…</option>
              {left.map((c) => <option key={c.id} value={c.id}>{`${c.first} ${c.last}`.trim()}</option>)}
            </select>
            {roles && (
              <select value={as} onChange={(e) => setAs(e.target.value as TeamRole)} aria-label="Add as" className={cn(selectPillCls, "w-auto shrink-0")}>
                <option value="member">as a teammate</option>
                <option value="viewer">as a viewer</option>
                {isOwner && <option value="admin">as an admin</option>}
              </select>
            )}
            <button type="button" disabled={!pick || pending} onClick={() => run(() => addTeammate(projectId, pick, as))} aria-label={as === "viewer" ? "Add viewer" : as === "admin" ? "Add admin" : "Add teammate"} className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-on-accent disabled:opacity-40">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            </button>
          </div>
        ) : <p className="text-xs text-faint">You add people from your clubs. Join one to add them.</p>
      )}
      {manage && roles && <p className="text-[11px] text-faint">Teammates and admins post updates and log milestones; admins also manage the team; viewers only look. No one on the project can verify its milestones.</p>}
      {manage && !roles && <p className="text-[11px] text-faint">Teammates can&apos;t verify this project&apos;s milestones.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("text-xs", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}

// On a private project, for its owner: "finished? make it public" shows all of it at once.
export function MakePublic({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button type="button" disabled={pending} onClick={() => { if (confirm("Make this project public? Its updates, write-up, files and verified milestones will show to everyone.")) start(async () => { const r = await setProjectPrivate(projectId, false); if (r.ok) router.refresh(); else setError(r.message); }); }}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm font-medium transition hover:bg-hover">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />} Make public
      </button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </>
  );
}
