import { BadgeCheck, ClipboardCheck, FolderGit2, UserRoundX } from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { classBoard, type BoardMilestone, type BoardProject } from "@/lib/class-board";

// A class at a glance (supabase/school-portal.sql), at the top of the class page.
// - Faculty: every project group in one table (who's on it, what's verified, what waits on you, when
//   it last moved), the students with no project yet, and how much of the roster has joined.
// - A student: their own project in this class (verified, waiting) or where to start one.
// Row-level security decides what each sees: faculty read every class project and its non-draft
// milestones; a student reads their own.
export async function ClassBoard({ cid, faculty }: { cid: string; faculty: boolean }) {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const [pr, ms, mem, ros] = await Promise.all([
    supabase.from("projects").select("id, title, owner_id, updated_at").eq("community_id", cid).order("updated_at", { ascending: false }).limit(200),
    supabase.from("milestones").select("project_id, owner_id, status").eq("community_id", cid).neq("status", "draft").limit(2000),
    supabase.from("community_members").select("uid, role, profiles(first_name, last_name)").eq("community_id", cid).limit(1000),
    faculty ? supabase.from("class_roster").select("email", { count: "exact", head: true }).eq("community_id", cid) : Promise.resolve({ count: null }),
  ]);
  const projects = (pr.data ?? []) as BoardProject[];
  const { data: team } = projects.length ? await supabase.from("project_members").select("project_id, uid").in("project_id", projects.map((p) => p.id)).limit(2000) : { data: [] };
  type Member = { uid: string; role: string; profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null };
  const members = ((mem.data ?? []) as unknown as Member[]).map((m) => { const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles; return { uid: m.uid, role: m.role, name: p ? `${p.first_name} ${p.last_name}`.trim() : "A student" }; });
  const board = classBoard(projects, (ms.data ?? []) as BoardMilestone[], (team ?? []) as { project_id: string; uid: string }[], members);
  const nameOf = new Map(members.map((m) => [m.uid, m.name]));

  if (!faculty) {
    const mine = board.rows.filter((r) => r.team.includes(user.id));
    return (
      <section aria-label="Your work in this class" className="mt-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Your work in this class</h2>
        {mine.length ? (
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {mine.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <Link href={`/projects/${r.id}`} className="min-w-0 truncate font-medium hover:underline">{r.title}</Link>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="size-3.5" aria-hidden="true" /> {r.verified} verified</span>
                  {r.waiting > 0 && <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="block size-3 rounded-full border-2 border-dashed border-wait" /> {r.waiting} waiting for your professor</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-muted">You&apos;re not on a project in this class yet. <a href="#projects" className="font-medium text-text underline underline-offset-4">Start your group&apos;s project</a>, or ask a teammate to add you to theirs. Then log milestones with their proof, and your professor verifies them.</p>
        )}
      </section>
    );
  }

  const joined = members.filter((m) => !["owner", "admin", "moderator"].includes(m.role)).length;
  const roster = ros.count ?? joined;
  return (
    <section aria-label="Class board" className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold">Class board</h2>
        <p className="text-xs text-muted">{joined} of {Math.max(roster, joined)} on the roster have joined · {board.rows.length} {board.rows.length === 1 ? "project" : "projects"} · {board.verified} verified</p>
      </div>
      {board.waiting > 0 && (
        <Link href={`/c/${cid}/manage?tab=verify`} className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-wait bg-surface px-4 py-3 text-sm transition hover:bg-hover">
          <span className="inline-flex items-center gap-2 font-medium"><ClipboardCheck className="size-4" aria-hidden="true" /> {board.waiting} {board.waiting === 1 ? "milestone is" : "milestones are"} waiting for you to verify</span>
          <span className="shrink-0 text-muted">Review</span>
        </Link>
      )}
      {board.rows.length ? (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th className="px-4 py-2.5 font-medium">Project</th><th className="px-4 py-2.5 font-medium">Group</th><th className="px-4 py-2.5 text-right font-medium">Verified</th><th className="px-4 py-2.5 text-right font-medium">Waiting</th><th className="px-4 py-2.5 text-right font-medium">Last update</th></tr></thead>
            <tbody>
              {board.rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5"><Link href={`/projects/${r.id}`} className="font-medium hover:underline">{r.title}</Link></td>
                  <td className="px-4 py-2.5 text-text-2">{r.team.map((u) => nameOf.get(u) ?? "A student").join(", ")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.verified}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.waiting > 0 ? <Link href={`/c/${cid}/manage?tab=verify`} className="font-medium underline underline-offset-4">{r.waiting}</Link> : <span className="text-faint">0</span>}</td>
                  <td suppressHydrationWarning className="px-4 py-2.5 text-right whitespace-nowrap text-muted">{timeAgo(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm text-muted"><FolderGit2 className="size-4 shrink-0" aria-hidden="true" /> No projects yet. Students start their group&apos;s project from this page; you can start one and add a group too.</p>
      )}
      {board.unassigned.length > 0 && (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted"><UserRoundX className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span><span className="font-medium text-text-2">Not on a project yet ({board.unassigned.length}):</span> {board.unassigned.map((u) => nameOf.get(u) ?? "A student").join(", ")}</span></p>
      )}
    </section>
  );
}
