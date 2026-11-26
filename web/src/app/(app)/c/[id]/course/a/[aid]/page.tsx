import type { Metadata } from "next";
import { BadgeCheck, CalendarClock, FileText, Link2, Paperclip, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/app/page-ui";
import { ABET_OUTCOMES, dueText, isLate, type RubricRow } from "@/lib/course-math";
import { rank } from "@/lib/communities";
import { requestTime, timeAgo } from "@/lib/forge";
import { signedUrls } from "@/lib/signed-urls";
import { loadCommunity } from "../../../data";
import { Fold, GradeForm, PublishToggle, ReleaseButton, RemoveButton, SubmitForm, type Handin } from "../../course-client";

// One assignment (supabase/courses.sql). A student reads it, hands in their work (or their group's),
// and sees their grade and feedback once it's released. Staff see every hand-in (and who hasn't),
// grade each student or group against the rubric, verify a milestone as they grade it, and release.
export const metadata: Metadata = { title: "Assignment" };

type Assignment = { id: string; community_id: string; title: string; instructions: string; due_at: string | null; points: number; group_work: boolean; submit_as: string[]; rubric: RubricRow[]; published: boolean };
type Submission = { id: string; uid: string; project_id: string | null; body: string; url: string | null; file_path: string | null; file_name: string | null; milestone_id: string | null; submitted_at: string };
type Grade = { uid: string; score: number | null; rubric_scores: Record<string, number>; feedback: string; released: boolean; graded_at: string };
type Milestone = { id: string; title: string; status: string; project_id: string };

export default function AssignmentPage({ params }: PageProps<"/c/[id]/course/a/[aid]">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-4xl">
      <Suspense fallback={<><Skeleton className="h-24" /><Skeleton className="mt-6 h-72" /></>}>
        <AssignmentView params={params} />
      </Suspense>
    </div>
  );
}

const outcomeLabel = (id?: string) => ABET_OUTCOMES.find((o) => o.id === id)?.label;

function HandinView({ s, fileHref, milestone }: { s: Submission; fileHref?: string; milestone?: Milestone }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {milestone && (
        <Link href={`/projects/${milestone.project_id}`} className="inline-flex items-center gap-1.5 font-medium hover:underline">
          {milestone.status === "verified" ? <BadgeCheck className="size-4 text-ok" aria-hidden="true" /> : <span aria-hidden="true" className="block size-3.5 rounded-full border-2 border-dashed border-wait" />}
          {milestone.title}<span className="font-normal text-muted">{milestone.status === "verified" ? " · verified" : " · milestone"}</span>
        </Link>
      )}
      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1.5 font-medium hover:underline"><Link2 className="size-4 shrink-0 text-text-2" aria-hidden="true" /><span className="truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span></a>}
      {s.file_path && (fileHref
        ? <a href={fileHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:underline"><Paperclip className="size-4 text-text-2" aria-hidden="true" /> {s.file_name || "The file"}</a>
        : <span className="inline-flex items-center gap-1.5 text-muted"><Paperclip className="size-4" aria-hidden="true" /> {s.file_name || "A file"}</span>)}
      {s.body && <div className="flex flex-col gap-2 rounded-lg bg-surface-2 px-3 py-2.5 leading-relaxed text-text-2">{s.body.split(/\n{2,}/).map((p, k) => <p key={k} className="whitespace-pre-line">{p}</p>)}</div>}
    </div>
  );
}

async function AssignmentView({ params }: { params: PageProps<"/c/[id]/course/a/[aid]">["params"] }) {
  const { id, aid } = await params;
  const { supabase, user, community: c, me } = await loadCommunity(id);
  if (!c || c.type !== "class") notFound();
  if (!me) redirect(`/c/${id}`);
  const { data } = await supabase.from("assignments").select("id, community_id, title, instructions, due_at, points, group_work, submit_as, rubric, published").eq("id", aid).eq("community_id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Assignment;
  const staff = rank(me.role) >= 3;
  const now = requestTime();

  const [subs, grs] = await Promise.all([
    supabase.from("submissions").select("id, uid, project_id, body, url, file_path, file_name, milestone_id, submitted_at").eq("assignment_id", aid).order("submitted_at", { ascending: false }).limit(2000),
    supabase.from("grades").select("uid, score, rubric_scores, feedback, released, graded_at").eq("assignment_id", aid).limit(2000),
  ]);
  const submissions = (subs.data ?? []) as Submission[];
  const grades = (grs.data ?? []) as Grade[];
  const msIds = [...new Set(submissions.map((s) => s.milestone_id).filter(Boolean) as string[])];
  const [msRes, files] = await Promise.all([
    msIds.length ? supabase.from("milestones").select("id, title, status, project_id").in("id", msIds) : Promise.resolve({ data: [] }),
    signedUrls(supabase, "course-files", submissions.map((s) => s.file_path).filter(Boolean) as string[]),
  ]);
  const milestones = new Map(((msRes.data ?? []) as Milestone[]).map((m) => [m.id, m]));

  const header = (
    <PageHeader title={a.title} back={{ href: `/c/${id}/course?tab=assignments`, label: c.course ? `${c.course} course` : "Course" }}
      subtitle={<span suppressHydrationWarning className="inline-flex flex-wrap items-center gap-x-1.5"><CalendarClock className="size-4" aria-hidden="true" /> {[dueText(a.due_at, now), a.due_at ? new Date(a.due_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null, `${a.points} points`, a.group_work ? "Group work" : null].filter(Boolean).join(" · ")}</span>}
      actions={staff ? <span className="flex items-center gap-1"><PublishToggle table="assignments" id={a.id} cid={id} published={a.published} /><RemoveButton table="assignments" id={a.id} cid={id} what="this assignment and its grades" /></span> : undefined} />
  );

  const brief = (
    <section aria-label="Instructions" className="glass-card rounded-2xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-text-2" aria-hidden="true" /> Instructions</h2>
      {a.instructions ? <div className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed text-text-2">{a.instructions.split(/\n{2,}/).map((p, k) => <p key={k} className="whitespace-pre-line">{p}</p>)}</div> : <p className="mt-2 text-sm text-muted">No instructions.</p>}
      <p className="mt-3 text-xs text-muted">Hand in: {a.submit_as.map((k) => ({ file: "a file", link: "a link", text: "text", milestone: "a project milestone" })[k] ?? k).join(", ")}{a.group_work ? " · one per project group" : ""}</p>
      {a.rubric.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th scope="col" className="px-3 py-2 font-medium">Rubric</th><th scope="col" className="px-3 py-2 font-medium">ABET outcome</th><th scope="col" className="px-3 py-2 text-right font-medium">Points</th></tr></thead>
            <tbody>{a.rubric.map((r) => <tr key={r.id} className="border-t border-line"><td className="px-3 py-2">{r.criterion}</td><td className="px-3 py-2 text-text-2">{outcomeLabel(r.outcome) ?? <span className="text-faint">–</span>}</td><td className="px-3 py-2 text-right tabular-nums">{r.points}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );

  // ---------- A student ----------
  if (!staff) {
    const mine = submissions[0] ?? null;  // RLS: yours, or your group's
    const g = grades.find((x) => x.uid === user.id) ?? null;  // RLS: only once released
    const [projs, team, myMs] = await Promise.all([
      supabase.from("projects").select("id, title, owner_id").eq("community_id", id).limit(200),
      supabase.from("project_members").select("project_id").eq("uid", user.id).limit(500),
      supabase.from("milestones").select("id, title, status, project_id, owner_id").eq("community_id", id).neq("status", "draft").order("created_at", { ascending: false }).limit(200),
    ]);
    const onTeam = new Set(((team.data ?? []) as { project_id: string }[]).map((t) => t.project_id));
    const myProjects = ((projs.data ?? []) as { id: string; title: string; owner_id: string }[]).filter((p) => p.owner_id === user.id || onTeam.has(p.id));
    const mineProjectIds = new Set(myProjects.map((p) => p.id));
    const myMilestones = ((myMs.data ?? []) as (Milestone & { owner_id: string })[]).filter((m) => m.owner_id === user.id || mineProjectIds.has(m.project_id));
    const handin: Handin | null = mine ? { body: mine.body, url: mine.url, file_name: mine.file_name, file_href: mine.file_path ? files.get(mine.file_path) ?? null : null, milestone_id: mine.milestone_id, project_id: mine.project_id, submitted_at: mine.submitted_at } : null;
    return (
      <>
        {header}
        <div className="mt-5 flex flex-col gap-4">
          {g && (
            <section aria-label="Your grade" className="glass-card rounded-2xl p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold tracking-tight">Your grade</h2>
                <p className="text-2xl font-semibold tabular-nums">{g.score ?? "–"}<span className="text-base font-normal text-muted"> / {a.points}</span></p>
              </div>
              {a.rubric.length > 0 && (
                <ul className="mt-3 divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)] text-sm">
                  {a.rubric.map((r) => <li key={r.id} className="flex justify-between gap-3 py-2"><span>{r.criterion}</span><span className="tabular-nums">{g.rubric_scores?.[r.id] ?? "–"} / {r.points}</span></li>)}
                </ul>
              )}
              {g.feedback && <div className="mt-3 flex flex-col gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-text-2">{g.feedback.split(/\n{2,}/).map((p, k) => <p key={k} className="whitespace-pre-line">{p}</p>)}</div>}
              <p className="mt-3 text-xs text-faint">Private to you and the class&apos;s staff.</p>
            </section>
          )}
          {brief}
          <section aria-label="Your work" className="flex flex-col gap-3">
            {mine && (
              <div className="glass-card rounded-2xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold tracking-tight">{a.group_work ? "Your group's work" : "Your work"}</h2>
                  <p suppressHydrationWarning className={`text-xs ${isLate(mine.submitted_at, a.due_at) ? "text-danger" : "text-muted"}`}>Handed in {timeAgo(mine.submitted_at)}{isLate(mine.submitted_at, a.due_at) ? ", after the due date" : ""}</p>
                </div>
                <div className="mt-3"><HandinView s={mine} fileHref={mine.file_path ? files.get(mine.file_path) : undefined} milestone={mine.milestone_id ? milestones.get(mine.milestone_id) : undefined} /></div>
              </div>
            )}
            <SubmitForm cid={id} aid={aid} uid={user.id} submitAs={a.submit_as} groupWork={a.group_work} projects={myProjects.map((p) => ({ id: p.id, title: p.title }))} milestones={myMilestones.map((m) => ({ id: m.id, title: m.title, status: m.status }))} current={handin} locked={!!g} />
          </section>
        </div>
      </>
    );
  }

  // ---------- Staff ----------
  const { data: st } = await supabase.rpc("course_students", { p_cid: id });
  const students = ((st ?? []) as { uid: string; first_name: string; last_name: string }[]).map((s) => ({ uid: s.uid, name: `${s.first_name} ${s.last_name}`.trim() || "A student" }));
  const nameOf = new Map(students.map((s) => [s.uid, s.name]));
  const gradeOf = new Map(grades.map((g) => [g.uid, g]));
  // Who each hand-in is for: a group's whole team (group work) or the one student.
  let teams = new Map<string, string[]>();
  if (a.group_work) {
    const pids = [...new Set(submissions.map((s) => s.project_id).filter(Boolean) as string[])];
    if (pids.length) {
      const [pr, tm] = await Promise.all([
        supabase.from("projects").select("id, title, owner_id").in("id", pids),
        supabase.from("project_members").select("project_id, uid").in("project_id", pids).limit(2000),
      ]);
      teams = new Map(((pr.data ?? []) as { id: string; owner_id: string }[]).map((p) => [p.id, [p.owner_id]]));
      for (const t of (tm.data ?? []) as { project_id: string; uid: string }[]) if (!teams.get(t.project_id)?.includes(t.uid)) teams.get(t.project_id)?.push(t.uid);
    }
  }
  const rows = submissions.map((s) => {
    const uids = (a.group_work && s.project_id ? teams.get(s.project_id) ?? [s.uid] : [s.uid]).filter((u) => nameOf.has(u));
    return { s, uids: uids.length ? uids : [s.uid] };
  });
  const covered = new Set(rows.flatMap((r) => r.uids));
  const missing = students.filter((x) => !covered.has(x.uid));
  const unreleased = grades.filter((g) => !g.released).length;
  const toGrade = rows.filter((r) => !r.uids.every((u) => gradeOf.has(u))).length;

  return (
    <>
      {header}
      <div className="mt-5 flex flex-col gap-4">
        <section aria-label="Where it stands" className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span><span className="font-semibold tabular-nums">{rows.length}</span> <span className="text-muted">{a.group_work ? "groups handed in" : "handed in"}</span></span>
            <span><span className="font-semibold tabular-nums">{toGrade}</span> <span className="text-muted">to grade</span></span>
            <span><span className="font-semibold tabular-nums">{missing.length}</span> <span className="text-muted">not handed in</span></span>
          </p>
          <ReleaseButton cid={id} aid={aid} waiting={unreleased} />
        </section>
        {brief}
        <section aria-label="Hand-ins" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Hand-ins</h2>
          {rows.length === 0 && <p className="rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm text-muted">Nothing handed in yet.</p>}
          {rows.map(({ s, uids }) => {
            const g = gradeOf.get(uids[0]) ?? null;
            const who = uids.map((u) => nameOf.get(u) ?? "A student").join(", ");
            const ms = s.milestone_id ? milestones.get(s.milestone_id) : undefined;
            return (
              <article key={s.id} className="glass-card rounded-2xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 font-semibold">{uids.length > 1 && <Users className="size-4 text-text-2" aria-hidden="true" />}{who}</h3>
                  <p suppressHydrationWarning className="text-xs text-muted">
                    <span className={isLate(s.submitted_at, a.due_at) ? "text-danger" : ""}>{isLate(s.submitted_at, a.due_at) ? "Late · " : ""}{timeAgo(s.submitted_at)}</span>
                    {g && <span className="ml-2 font-medium text-text">{g.score ?? "–"} / {a.points}{g.released ? "" : " · not released"}</span>}
                  </p>
                </div>
                <div className="mt-3"><HandinView s={s} fileHref={s.file_path ? files.get(s.file_path) : undefined} milestone={ms} /></div>
                <Fold className="mt-4 border-t border-line pt-3" label={g ? "Change the grade" : "Grade"} openAtFirst={!g}>
                  <div className="mt-3"><GradeForm cid={id} aid={aid} uids={uids} who={who} rubric={a.rubric} points={a.points} current={g} milestoneId={ms && ms.status !== "verified" ? ms.id : null} /></div>
                </Fold>
              </article>
            );
          })}
        </section>
        {missing.length > 0 && (
          <section aria-label="Not handed in" className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-semibold">Not handed in ({missing.length})</h2>
            <ul className="mt-2 divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">
              {missing.map((x) => {
                const g = gradeOf.get(x.uid) ?? null;
                return (
                  <li key={x.uid} className="py-2.5">
                    <details>
                      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm"><span className="font-medium">{x.name}</span><span className="text-xs text-muted">{g ? `${g.score ?? "–"} / ${a.points}${g.released ? "" : " · not released"}` : a.due_at && new Date(a.due_at).getTime() < now ? "Missing" : "Not yet"}</span></summary>
                      <div className="mt-3"><GradeForm cid={id} aid={aid} uids={[x.uid]} who={x.name} rubric={a.rubric} points={a.points} current={g} milestoneId={null} /></div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
