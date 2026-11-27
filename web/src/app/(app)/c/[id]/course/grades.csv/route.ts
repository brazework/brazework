import { gradebook, gradesCsv, type CourseAssignment, type CourseGrade, type CourseSubmission } from "@/lib/course-math";
import { getViewer } from "@/lib/supabase/server";

// The gradebook as CSV for the registrar (Brazework Courses). Only the class's staff get it: the
// database refuses course_students to anyone else, and row-level security limits grades to staff.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  if (!user) return new Response("Log in first.", { status: 401 });
  const st = await supabase.rpc("course_students", { p_cid: id });
  if (st.error) return new Response("Only the class's professor or teaching assistants can export its grades.", { status: 403 });
  const [c, asg, grs, subs, pr] = await Promise.all([
    supabase.from("communities").select("course, term").eq("id", id).maybeSingle(),
    supabase.from("assignments").select("id, title, points, due_at, published").eq("community_id", id).order("due_at", { ascending: true, nullsFirst: false }).limit(300),
    supabase.from("grades").select("assignment_id, uid, score, released").eq("community_id", id).limit(10000),
    supabase.from("submissions").select("assignment_id, uid, project_id, submitted_at").eq("community_id", id).limit(10000),
    supabase.from("projects").select("id, owner_id").eq("community_id", id).limit(500),
  ]);
  const projects = (pr.data ?? []) as { id: string; owner_id: string }[];
  const { data: team } = projects.length ? await supabase.from("project_members").select("project_id, uid").in("project_id", projects.map((p) => p.id)).limit(5000) : { data: [] };
  const teams = new Map<string, string[]>(projects.map((p) => [p.id, [p.owner_id]]));
  for (const t of (team ?? []) as { project_id: string; uid: string }[]) teams.get(t.project_id)?.push(t.uid);
  const students = ((st.data ?? []) as { uid: string; first_name: string; last_name: string; email: string | null }[]).map((s) => ({ uid: s.uid, name: `${s.first_name} ${s.last_name}`.trim(), email: s.email ?? undefined }));
  const assignments = (asg.data ?? []) as CourseAssignment[];
  const csv = gradesCsv(gradebook(students, assignments, (grs.data ?? []) as CourseGrade[], (subs.data ?? []) as CourseSubmission[], teams), assignments);
  const name = [c.data?.course, c.data?.term, "grades"].filter(Boolean).join(" ").replace(/[^A-Za-z0-9 -]/g, "").replace(/\s+/g, "-") || "grades";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "private, no-store" } });
}
