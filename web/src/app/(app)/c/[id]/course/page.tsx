import type { Metadata } from "next";
import { BadgeCheck, ClipboardList, Download, FileText, GraduationCap, Link2, Megaphone, Paperclip, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Skeleton, Tabs } from "@/components/app/page-ui";
import { dbFeatures } from "@/lib/db-features";
import { dueText, gradebook, isLate, type CourseAssignment, type CourseGrade, type CourseSubmission } from "@/lib/course-math";
import { rank } from "@/lib/communities";
import { requestTime, timeAgo } from "@/lib/forge";
import { signedUrls } from "@/lib/signed-urls";
import { loadCommunity } from "../data";
import { AccommodationForm, AddItemForm, AddModuleForm, AnnounceForm, AssignmentForm, AttendancePicker, CheckInForm, CloseSessionButton, OpenSessionForm, PublishToggle, RemoveButton } from "./course-client";
import { ABET_OUTCOMES } from "@/lib/course-math";

// Brazework Courses (supabase/courses.sql): a class's course. Modules of pages, links and files;
// assignments with due dates, rubrics and hand-ins (including project milestones); private grades;
// announcements. Staff (the class's faculty and teaching assistants) build and grade it; students see
// what's published, hand in their work and read their released grades. Row-level security decides
// what each sees; this page never widens it.
export const metadata: Metadata = { title: "Course" };

type Tab = "modules" | "assignments" | "attendance" | "grades" | "announcements";
type Module = { id: string; title: string; position: number; published: boolean };
type Item = { id: string; module_id: string; kind: "page" | "link" | "file"; title: string; body: string; url: string | null; path: string | null; position: number };
type Assignment = CourseAssignment & { module_id: string | null; group_work: boolean; submit_as: string[]; kind?: string };
type Announcement = { id: string; title: string; body: string; created_at: string; author_id: string; profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null };

export default function CoursePage({ params, searchParams }: PageProps<"/c/[id]/course">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-4xl">
      <Suspense fallback={<><Skeleton className="h-24" /><Skeleton className="mt-6 h-72" /></>}>
        <Course params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

async function Course({ params, searchParams }: { params: PageProps<"/c/[id]/course">["params"]; searchParams: PageProps<"/c/[id]/course">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, community: c, me } = await loadCommunity(id);
  if (!c || c.type !== "class") notFound();
  if (!me) redirect(`/c/${id}`);
  const f = await dbFeatures();
  const header = (
    <PageHeader title={c.name} back={{ href: `/c/${id}`, label: "Class" }}
      subtitle={<span className="inline-flex items-center gap-1.5"><GraduationCap className="size-4" aria-hidden="true" /> {[c.term, "Course"].filter(Boolean).join(" · ")}</span>} />
  );
  if (!f.courses) return <>{header}<EmptyState title="Courses are on their way" body="Modules, assignments and grades for this class arrive with the next update." /></>;

  const staff = rank(me.role) >= 3;
  const tab: Tab = (["assignments", "attendance", "grades", "announcements"] as const).find((t) => t === sp.tab && (t !== "attendance" || f.coursesB)) ?? "modules";
  const now = requestTime();
  const [mods, items, asg, ann, subs, grs] = await Promise.all([
    supabase.from("course_modules").select("id, title, position, published").eq("community_id", id).order("position").limit(200),
    supabase.from("course_items").select("id, module_id, kind, title, body, url, path, position").eq("community_id", id).order("position").limit(1000),
    supabase.from("assignments").select(`id, title, points, due_at, published, module_id, group_work, submit_as${f.coursesB ? ", kind" : ""}`).eq("community_id", id).order("due_at", { ascending: true, nullsFirst: false }).limit(300),
    supabase.from("course_announcements").select("id, title, body, created_at, author_id, profiles!course_announcements_author_id_fkey(first_name, last_name)").eq("community_id", id).order("created_at", { ascending: false }).limit(tab === "announcements" ? 100 : 1),
    supabase.from("submissions").select("assignment_id, uid, project_id, submitted_at").eq("community_id", id).limit(5000),
    supabase.from("grades").select("assignment_id, uid, score, released").eq("community_id", id).limit(5000),
  ]);
  const modules = (mods.data ?? []) as Module[];
  const allItems = (items.data ?? []) as Item[];
  const assignments = (asg.data ?? []) as unknown as Assignment[];
  const announcements = (ann.data ?? []) as unknown as Announcement[];
  const submissions = (subs.data ?? []) as CourseSubmission[];
  const grades = (grs.data ?? []) as CourseGrade[];
  const files = await signedUrls(supabase, "course-files", allItems.filter((i) => i.kind === "file" && i.path).map((i) => i.path!));

  // Where a student stands on one assignment: graded, handed in (late or not), missing, or open.
  const myStatus = (a: Assignment) => {
    const g = grades.find((x) => x.assignment_id === a.id && x.uid === user.id && x.released);
    if (g && g.score != null) return { text: `${g.score} / ${a.points}`, tone: "text-ok" };
    const s = submissions.find((x) => x.assignment_id === a.id);
    if (s) return { text: isLate(s.submitted_at, a.due_at) ? "Handed in late" : "Handed in", tone: "text-text-2" };
    if (a.due_at && new Date(a.due_at).getTime() < now) return { text: "Missing", tone: "text-danger" };
    return { text: "To do", tone: "text-muted" };
  };
  const students = staff ? Math.max(c.member_count - 1, 0) : 0;
  const staffStatus = (a: Assignment) => {
    const n = new Set(submissions.filter((s) => s.assignment_id === a.id).map((s) => s.project_id ?? s.uid)).size;
    const graded = grades.filter((g) => g.assignment_id === a.id).length;
    const out = grades.filter((g) => g.assignment_id === a.id && g.released).length;
    return `${n} handed in · ${graded} graded${graded > out ? ` · ${graded - out} not released` : ""}`;
  };

  const AssignmentRow = ({ a }: { a: Assignment }) => {
    const st = staff ? null : myStatus(a);
    return (
      <li className="flex items-center gap-3 py-2.5">
        <ClipboardList className="size-4 shrink-0 text-text-2" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Link href={`/c/${id}/course/a/${a.id}`} className="block truncate text-sm font-medium hover:underline">{a.title}</Link>
          <p suppressHydrationWarning className="truncate text-xs text-muted">{[a.kind === "quiz" ? "Quiz" : null, dueText(a.due_at, now), `${a.points} points`, a.group_work ? "Group work" : null, staff ? staffStatus(a) : null].filter(Boolean).join(" · ")}</p>
        </div>
        {st && <span className={`shrink-0 text-xs font-medium ${st.tone}`}>{st.text}</span>}
        {staff && <PublishToggle table="assignments" id={a.id} cid={id} published={a.published} />}
      </li>
    );
  };

  const latest = announcements[0];
  return (
    <>
      {header}
      <Tabs active={tab} tabs={[
        { id: "modules", label: "Modules", href: `/c/${id}/course` },
        { id: "assignments", label: "Assignments", href: `/c/${id}/course?tab=assignments`, count: assignments.filter((a) => a.published).length },
        { id: "grades", label: staff ? "Gradebook" : "Grades", href: `/c/${id}/course?tab=grades` },
        ...(f.coursesB ? [{ id: "attendance", label: "Attendance", href: `/c/${id}/course?tab=attendance` }] : []),
        { id: "announcements", label: "Announcements", href: `/c/${id}/course?tab=announcements` },
      ]} />

      {tab === "modules" && (
        <div className="mt-5 flex flex-col gap-4">
          {latest && (
            <Link href={`/c/${id}/course?tab=announcements`} className="glass-card flex items-start gap-3 rounded-2xl px-5 py-4 transition hover:bg-hover">
              <Megaphone className="mt-0.5 size-4 shrink-0 text-text-2" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{latest.title}</span>
                <span className="line-clamp-2 text-sm text-text-2">{latest.body}</span>
                <span suppressHydrationWarning className="mt-1 block text-xs text-muted">{[one(latest.profiles) && `${one(latest.profiles)!.first_name} ${one(latest.profiles)!.last_name}`, timeAgo(latest.created_at)].filter(Boolean).join(" · ")}</span>
              </span>
            </Link>
          )}
          {staff && <div className="flex flex-wrap gap-2"><AddModuleForm cid={id} /></div>}
          {modules.length === 0 && (
            <EmptyState title={staff ? "Build the course" : "Nothing posted yet"} body={staff ? "Add a module for each week or unit, then pages, links, files and assignments in it. Students see a module once it's published." : "Your professor hasn't published any modules yet. Assignments and announcements show up here as they post them."} />
          )}
          {modules.map((m) => {
            const mi = allItems.filter((i) => i.module_id === m.id);
            const ma = assignments.filter((a) => a.module_id === m.id && (staff || a.published));
            return (
              <section key={m.id} aria-label={m.title} className="glass-card rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold tracking-tight">{m.title}</h2>
                  {staff && <span className="flex items-center gap-1"><PublishToggle table="course_modules" id={m.id} cid={id} published={m.published} /><RemoveButton table="course_modules" id={m.id} cid={id} what={`the module ${m.title}`} /></span>}
                </div>
                {mi.length + ma.length > 0 ? (
                  <ul className="mt-2 divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">
                    {mi.map((i) => (
                      <li key={i.id} className="flex items-start gap-3 py-2.5">
                        {i.kind === "page" ? <FileText className="mt-0.5 size-4 shrink-0 text-text-2" aria-hidden="true" /> : i.kind === "link" ? <Link2 className="mt-0.5 size-4 shrink-0 text-text-2" aria-hidden="true" /> : <Paperclip className="mt-0.5 size-4 shrink-0 text-text-2" aria-hidden="true" />}
                        <div className="min-w-0 flex-1">
                          {i.kind === "page" ? (
                            <details className="group">
                              <summary className="cursor-pointer list-none text-sm font-medium hover:underline">{i.title}</summary>
                              <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-text-2">{i.body.split(/\n{2,}/).map((p, k) => <p key={k} className="whitespace-pre-line">{p}</p>)}</div>
                            </details>
                          ) : i.kind === "link" ? (
                            <a href={i.url!} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-medium hover:underline">{i.title}<span className="ml-2 text-xs font-normal text-muted">{i.url!.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</span></a>
                          ) : files.get(i.path!) ? (
                            <a href={files.get(i.path!)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">{i.title}<span className="ml-2 text-xs font-normal text-muted uppercase">{i.path!.split(".").pop()}</span></a>
                          ) : <span className="text-sm font-medium">{i.title}</span>}
                        </div>
                        {staff && <RemoveButton table="course_items" id={i.id} cid={id} what={i.title} />}
                      </li>
                    ))}
                    {ma.map((a) => <AssignmentRow key={a.id} a={a} />)}
                  </ul>
                ) : <p className="mt-2 text-sm text-muted">{staff ? "Empty. Add pages, links, files or an assignment." : "Nothing here yet."}</p>}
                {staff && <div className="mt-3"><AddItemForm cid={id} moduleId={m.id} /></div>}
              </section>
            );
          })}
        </div>
      )}

      {tab === "assignments" && (
        <div className="mt-5 flex flex-col gap-4">
          {staff && <div className="flex flex-wrap gap-2"><AssignmentForm cid={id} modules={modules.map((m) => ({ id: m.id, title: m.title }))} /></div>}
          {assignments.length ? (
            <section aria-label="Assignments" className="glass-card rounded-2xl px-5 py-2">
              <ul className="divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">{assignments.map((a) => <AssignmentRow key={a.id} a={a} />)}</ul>
            </section>
          ) : <EmptyState title="No assignments yet" body={staff ? "Post one with a due date, points and a rubric. Students can hand in files, links, text or a milestone from their class project." : "Your professor hasn't posted any yet."} />}
        </div>
      )}

      {tab === "attendance" && <Suspense fallback={<Skeleton className="mt-5 h-64" />}><Attendance cid={id} staff={staff} uid={user.id} now={now} /></Suspense>}
      {tab === "grades" && (staff
        ? <Suspense fallback={<Skeleton className="mt-5 h-64" />}><Gradebook cid={id} assignments={assignments} grades={grades} submissions={submissions} now={now} phaseB={f.coursesB} /></Suspense>
        : <MyGrades cid={id} assignments={assignments.filter((a) => a.published)} grades={grades.filter((g) => g.uid === user.id && g.released)} />)}

      {tab === "announcements" && (
        <div className="mt-5 flex flex-col gap-4">
          {staff && <div className="flex flex-wrap gap-2"><AnnounceForm cid={id} /></div>}
          {announcements.length ? announcements.map((a) => (
            <article key={a.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold tracking-tight">{a.title}</h2>
                {staff && <RemoveButton table="course_announcements" id={a.id} cid={id} what={`the announcement ${a.title}`} />}
              </div>
              <p suppressHydrationWarning className="mt-0.5 text-xs text-muted">{[one(a.profiles) && `${one(a.profiles)!.first_name} ${one(a.profiles)!.last_name}`, timeAgo(a.created_at)].filter(Boolean).join(" · ")}</p>
              <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-text-2">{a.body.split(/\n{2,}/).map((p, k) => <p key={k} className="whitespace-pre-line">{p}</p>)}</div>
            </article>
          )) : <EmptyState title="No announcements" body={staff ? "Announce something and everyone in the class gets a notification." : "Your professor's announcements show up here, and in your notifications."} />}
        </div>
      )}
      {staff && <p className="mt-6 flex items-center gap-1.5 text-xs text-faint"><Users className="size-3.5" aria-hidden="true" /> {students} {students === 1 ? "student" : "students"} · Grades are private: each student sees only their own, once you release it. Your school sees counts, never a grade.</p>}
    </>
  );
}

function MyGrades({ cid, assignments, grades }: { cid: string; assignments: Assignment[]; grades: CourseGrade[] }) {
  const graded = assignments.map((a) => ({ a, g: grades.find((x) => x.assignment_id === a.id) })).filter((x) => x.g && x.g.score != null);
  const earned = graded.reduce((s, x) => s + (x.g!.score ?? 0), 0);
  const possible = graded.reduce((s, x) => s + x.a.points, 0);
  if (!graded.length) return <div className="mt-5"><EmptyState title="No grades yet" body="Your grades show up here once your professor releases them. Only you and the class's staff ever see them." /></div>;
  return (
    <section aria-label="Your grades" className="glass-card mt-5 rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold tracking-tight">Your grades</h2>
        <p className="text-sm text-text-2"><span className="text-2xl font-semibold text-text tabular-nums">{Math.round((earned / Math.max(possible, 1)) * 1000) / 10}%</span> on {graded.length} graded</p>
      </div>
      <ul className="mt-3 divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">
        {graded.map(({ a, g }) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <Link href={`/c/${cid}/course/a/${a.id}`} className="min-w-0 truncate font-medium hover:underline">{a.title}</Link>
            <span className="shrink-0 font-medium tabular-nums">{g!.score} / {a.points}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><BadgeCheck className="size-3.5" aria-hidden="true" /> Private to you and the class&apos;s staff. Never on your profile.</p>
    </section>
  );
}

async function Gradebook({ cid, assignments, grades, submissions, now, phaseB }: { cid: string; assignments: Assignment[]; grades: CourseGrade[]; submissions: CourseSubmission[]; now: number; phaseB: boolean }) {
  const { supabase } = await loadCommunity(cid);
  const [st, pr, extRes, accRes, outRes] = await Promise.all([
    supabase.rpc("course_students", { p_cid: cid }),
    supabase.from("projects").select("id, owner_id").eq("community_id", cid).limit(500),
    phaseB ? supabase.from("assignment_extensions").select("assignment_id, uid, due_at").eq("community_id", cid) : Promise.resolve({ data: [] }),
    phaseB ? supabase.from("course_accommodations").select("uid, extra_days, extra_time_pct, note").eq("community_id", cid) : Promise.resolve({ data: [] }),
    phaseB ? supabase.rpc("course_outcomes", { p_cid: cid }) : Promise.resolve({ data: [] }),
  ]);
  const exts = new Map(((extRes.data ?? []) as { assignment_id: string; uid: string; due_at: string }[]).map((e) => [`${e.assignment_id}|${e.uid}`, e.due_at]));
  const accs = (accRes.data ?? []) as { uid: string; extra_days: number; extra_time_pct: number; note: string }[];
  const extra = new Map(accs.map((a) => [a.uid, a.extra_days]));
  const outcomes = (outRes.data ?? []) as { outcome: string; students: number; average: number; meeting: number }[];
  // Missing means past this student's own due date (an extension or an accommodation moves it).
  const pastDueFor = (a: Assignment, u: string) => { const d = exts.get(`${a.id}|${u}`) ?? (a.due_at ? new Date(new Date(a.due_at).getTime() + (extra.get(u) ?? 0) * 86_400_000).toISOString() : null); return !!d && new Date(d).getTime() < now; };
  const projects = (pr.data ?? []) as { id: string; owner_id: string }[];
  const { data: team } = projects.length ? await supabase.from("project_members").select("project_id, uid").in("project_id", projects.map((p) => p.id)).limit(5000) : { data: [] };
  const teams = new Map<string, string[]>(projects.map((p) => [p.id, [p.owner_id]]));
  for (const t of (team ?? []) as { project_id: string; uid: string }[]) teams.get(t.project_id)?.push(t.uid);
  const students = ((st.data ?? []) as { uid: string; first_name: string; last_name: string; email: string | null }[]).map((s) => ({ uid: s.uid, name: `${s.first_name} ${s.last_name}`.trim(), email: s.email ?? undefined }));
  const published = assignments.filter((a) => a.published);
  const rows = gradebook(students, assignments, grades, submissions, teams);
  const byId = new Map(published.map((a) => [a.id, a]));
  const anyHeld = grades.some((g) => !g.released);
  if (!students.length) return <div className="mt-5"><EmptyState title="No students yet" body="Students join from the roster with their school email. Set the roster from the class page." /></div>;
  return (
    <>
    <section aria-label="Gradebook" className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{students.length} {students.length === 1 ? "student" : "students"} · {published.length} {published.length === 1 ? "assignment" : "assignments"}. Totals count graded work only.</p>
        <a href={`/c/${cid}/course/grades.csv`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium transition hover:border-line-strong hover:bg-hover"><Download className="size-4" aria-hidden="true" /> Export CSV</a>
      </div>
      <div className="glass-card mt-3 overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 bg-surface px-4 py-2.5 font-medium sm:static sm:bg-transparent">Student</th>
              {published.map((a) => <th key={a.id} scope="col" className="px-3 py-2.5 text-right font-medium whitespace-nowrap"><Link href={`/c/${cid}/course/a/${a.id}`} className="hover:text-text hover:underline">{a.title.length > 18 ? `${a.title.slice(0, 17)}…` : a.title}</Link><span className="block font-normal text-faint">/ {a.points}</span></th>)}
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 bg-surface px-4 py-2.5 text-left font-medium whitespace-nowrap sm:static sm:bg-transparent">{r.name}</th>
                {r.cells.map((c) => (
                  <td key={c.assignment_id} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                    {c.score != null ? <span className={c.released ? "" : "text-muted"} title={c.released ? "Released" : "Not released yet"}>{c.score}{!c.released && "*"}</span> : c.submitted ? <span className="text-xs text-text-2">{c.late ? "In, late" : "In"}</span> : pastDueFor(byId.get(c.assignment_id)!, r.uid) ? <span className="text-xs text-danger">Missing</span> : <span className="text-faint">–</span>}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.percent == null ? <span className="font-normal text-faint">–</span> : `${r.percent}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anyHeld && <p className="mt-2 text-xs text-faint">* Graded, not released to the student yet.</p>}
    </section>
      {phaseB && (
        <>
          <section aria-label="ABET outcomes" className="glass-card mt-6 rounded-2xl p-5">
            <h2 className="font-semibold tracking-tight">ABET outcomes</h2>
            <p className="mt-0.5 text-sm text-muted">From rubric rows tagged with an outcome, on released grades. Meeting means 70% or more.</p>
            {outcomes.length ? (
              <ul className="mt-3 flex flex-col gap-3">
                {outcomes.map((o) => (
                  <li key={o.outcome}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium">{ABET_OUTCOMES.find((x) => x.id === o.outcome)?.label ?? `Outcome ${o.outcome}`}</span><span className="text-text-2 tabular-nums">{o.meeting}% meeting · average {o.average}% · {o.students} {o.students === 1 ? "student" : "students"}</span></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text)_8%,transparent)]"><div className="h-full rounded-full bg-ok" style={{ width: `${Math.min(100, o.meeting)}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-muted">Tag rubric rows with an ABET outcome when you write an assignment. Once grades are released, attainment shows here and in your school&apos;s accreditation export.</p>}
          </section>
          <section aria-label="Accommodations" className="glass-card mt-4 rounded-2xl p-5">
            <h2 className="font-semibold tracking-tight">Accommodations</h2>
            <p className="mt-0.5 text-sm text-muted">Extra days move every due date for that student; quizzes stay open for them too. Only you and the student see it.</p>
            {accs.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-sm text-text-2">
                {accs.map((a) => <li key={a.uid}><span className="font-medium text-text">{students.find((x) => x.uid === a.uid)?.name ?? "A student"}</span> · {[a.extra_days ? `${a.extra_days} extra ${a.extra_days === 1 ? "day" : "days"}` : null, a.extra_time_pct ? `${a.extra_time_pct}% extra time` : null, a.note || null].filter(Boolean).join(" · ")}</li>)}
              </ul>
            )}
            <div className="mt-3"><AccommodationForm cid={cid} students={students.map((x) => ({ uid: x.uid, name: x.name }))} /></div>
          </section>
        </>
      )}
    </>
  );
}

// Attendance (supabase/courses-b.sql): staff open a session with a check-in code and mark the rest;
// a student checks in with the code and sees their own record.
async function Attendance({ cid, staff, uid, now }: { cid: string; staff: boolean; uid: string; now: number }) {
  const { supabase } = await loadCommunity(cid);
  const [sess, att] = await Promise.all([
    supabase.from("course_sessions").select("id, title, held_on, open_until, created_at").eq("community_id", cid).order("created_at", { ascending: false }).limit(100),
    supabase.from("attendance").select("session_id, uid, status").eq("community_id", cid).limit(10000),
  ]);
  const sessions = (sess.data ?? []) as { id: string; title: string; held_on: string; open_until: string | null; created_at: string }[];
  const marks = (att.data ?? []) as { session_id: string; uid: string; status: string }[];
  const dateOf = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const tone = (st?: string) => (st === "present" ? "text-ok" : st === "absent" ? "text-danger" : st ? "text-text-2" : "text-faint");
  if (!staff) {
    const mine = new Map(marks.filter((m) => m.uid === uid).map((m) => [m.session_id, m.status]));
    // A session counts once it's closed or you're marked; excused ones never count.
    const counted = sessions.filter((x) => mine.get(x.id) !== "excused" && (mine.has(x.id) || !x.open_until || new Date(x.open_until).getTime() <= now));
    const there = counted.filter((x) => ["present", "late"].includes(mine.get(x.id) ?? "")).length;
    return (
      <div className="mt-5 flex flex-col gap-4">
        <CheckInForm />
        {sessions.length ? (
          <section aria-label="Your attendance" className="glass-card rounded-2xl p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold tracking-tight">Your attendance</h2>
              <p className="text-sm text-text-2"><span className="text-2xl font-semibold text-text tabular-nums">{counted.length ? Math.round((there / counted.length) * 100) : 100}%</span> of {counted.length} {counted.length === 1 ? "session" : "sessions"}</p>
            </div>
            <ul className="mt-3 divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)] text-sm">
              {sessions.map((x) => <li key={x.id} className="flex justify-between gap-3 py-2"><span suppressHydrationWarning>{dateOf(x.held_on)}{x.title ? ` · ${x.title}` : ""}</span><span className={`font-medium capitalize ${tone(mine.get(x.id))}`}>{mine.get(x.id) ?? "Not marked"}</span></li>)}
            </ul>
          </section>
        ) : <EmptyState title="No sessions yet" body="When your professor takes attendance, type the code on the screen above to check in." />}
      </div>
    );
  }
  const [st, codes] = await Promise.all([supabase.rpc("course_students", { p_cid: cid }), supabase.rpc("course_session_codes", { p_cid: cid })]);
  const students = ((st.data ?? []) as { uid: string; first_name: string; last_name: string }[]).map((x) => ({ uid: x.uid, name: `${x.first_name} ${x.last_name}`.trim() || "A student" }));
  const codeOf = new Map(((codes.data ?? []) as { id: string; code: string }[]).map((c) => [c.id, c.code]));
  const latest = sessions[0];
  const open = latest?.open_until && new Date(latest.open_until).getTime() > now;
  const markOf = (sid: string, u: string) => marks.find((m) => m.session_id === sid && m.uid === u)?.status ?? null;
  const rate = (u: string) => { const c = sessions.filter((x) => markOf(x.id, u) !== "excused" && (markOf(x.id, u) || !x.open_until || new Date(x.open_until).getTime() <= now)); const t = c.filter((x) => ["present", "late"].includes(markOf(x.id, u) ?? "")).length; return c.length ? Math.round((t / c.length) * 100) : null; };
  return (
    <div className="mt-5 flex flex-col gap-4">
      <OpenSessionForm cid={cid} />
      {latest && (
        <section aria-label="This session" className="glass-card rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 suppressHydrationWarning className="font-semibold tracking-tight">{latest.title || "Session"} · {dateOf(latest.held_on)}</h2>
              <p suppressHydrationWarning className="mt-0.5 text-sm text-muted">{open ? `Check-in open until ${new Date(latest.open_until!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Put the code on the screen.` : "Check-in closed. Mark anyone below."} {marks.filter((m) => m.session_id === latest.id && ["present", "late"].includes(m.status)).length} of {students.length} here.</p>
            </div>
            {open && (
              <div className="flex flex-col items-end gap-2">
                <p aria-label="Check-in code" className="rounded-2xl bg-text px-5 py-3 font-mono text-3xl font-semibold tracking-[0.25em] text-bg">{codeOf.get(latest.id)}</p>
                <CloseSessionButton cid={cid} sid={latest.id} />
              </div>
            )}
          </div>
          <ul className="mt-4 divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)]">
            {students.map((x) => (
              <li key={x.uid} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm font-medium">{x.name}<span className="ml-2 text-xs font-normal text-muted tabular-nums">{rate(x.uid) == null ? "" : `${rate(x.uid)}% this term`}</span></span>
                <AttendancePicker cid={cid} sid={latest.id} uid={x.uid} name={x.name} status={markOf(latest.id, x.uid)} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {sessions.length > 1 && (
        <section aria-label="Past sessions" className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Past sessions</h2>
          <ul className="mt-2 divide-y divide-[color-mix(in_oklab,var(--border)_70%,transparent)] text-sm">
            {sessions.slice(1).map((x) => <li key={x.id} className="flex justify-between gap-3 py-2"><span suppressHydrationWarning>{dateOf(x.held_on)}{x.title ? ` · ${x.title}` : ""}</span><span className="text-text-2 tabular-nums">{marks.filter((m) => m.session_id === x.id && ["present", "late"].includes(m.status)).length} of {students.length}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
