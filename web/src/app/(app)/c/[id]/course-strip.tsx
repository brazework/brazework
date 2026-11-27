import { ArrowRight, ClipboardList, Megaphone } from "lucide-react";
import Link from "next/link";
import { dueText } from "@/lib/course-math";
import { dbFeatures } from "@/lib/db-features";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// The way into a class's course (Brazework Courses, supabase/courses.sql), at the top of the class
// page: what's due next and the latest announcement for a student; what waits to be graded for staff.
export async function CourseStrip({ cid, staff }: { cid: string; staff: boolean }) {
  const f = await dbFeatures();
  if (!f.courses) return null;
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const now = requestTime();
  const [asg, ann, subs, grs] = await Promise.all([
    supabase.from("assignments").select("id, title, due_at, published").eq("community_id", cid).order("due_at", { ascending: true, nullsFirst: false }).limit(300),
    supabase.from("course_announcements").select("title, created_at").eq("community_id", cid).order("created_at", { ascending: false }).limit(1),
    supabase.from("submissions").select("assignment_id, uid").eq("community_id", cid).limit(5000),
    staff ? supabase.from("grades").select("assignment_id, uid").eq("community_id", cid).limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const assignments = (asg.data ?? []) as { id: string; title: string; due_at: string | null; published: boolean }[];
  const handedIn = new Set(((subs.data ?? []) as { assignment_id: string }[]).map((s) => s.assignment_id));
  const graded = new Set(((grs.data ?? []) as { assignment_id: string; uid: string }[]).map((g) => `${g.assignment_id}|${g.uid}`));
  const toGrade = ((subs.data ?? []) as { assignment_id: string; uid: string }[]).filter((s) => !graded.has(`${s.assignment_id}|${s.uid}`)).length;
  const next = assignments.find((a) => a.published && !handedIn.has(a.id) && (!a.due_at || new Date(a.due_at).getTime() > now - 86_400_000));
  const latest = (ann.data ?? [])[0] as { title: string } | undefined;
  const line = staff
    ? assignments.length ? `${assignments.filter((a) => a.published).length} assignments posted${toGrade ? ` · ${toGrade} to grade` : ""}` : "Build the course: modules, assignments, grades"
    : next ? `${next.title} · ${dueText(next.due_at, now)}` : assignments.some((a) => a.published) ? "You're caught up" : "Modules, assignments and grades";
  return (
    <Link href={`/c/${cid}/course`} className="home-glass group mt-5 flex items-center gap-4 rounded-2xl px-5 py-4 transition ">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-text text-bg"><ClipboardList className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium tracking-wide text-muted uppercase">Course</span>
        <span suppressHydrationWarning className="block truncate font-semibold tracking-tight">{line}</span>
        {latest && <span className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-text-2"><Megaphone className="size-3.5 shrink-0" aria-hidden="true" /> {latest.title}</span>}
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-text-2 group-hover:text-text sm:inline-flex">{staff && toGrade ? "Grade" : "Open"} <ArrowRight className="size-4" aria-hidden="true" /></span>
    </Link>
  );
}
