import { ABET_OUTCOMES } from "@/lib/course-math";
import { evidenceCsv } from "@/lib/school-roster";
import { getViewer } from "@/lib/supabase/server";

// GET /school/outcomes: attainment by ABET student outcome and course as a CSV, for the self-study
// (supabase/courses-b.sql school_outcomes). Aggregates only, and only for courses with 3 or more
// students assessed on an outcome; never a student's name or grade. School admins only; anyone else 403.
const COLUMNS: [string, string][] = [
  ["outcome", "ABET outcome"], ["course", "Course"], ["term", "Term"], ["students", "Students assessed"],
  ["average", "Average attainment (%)"], ["meeting", "Meeting 70% or more (%)"],
];

export async function GET() {
  const { supabase, user } = await getViewer();
  if (!user) return new Response("Log in first.", { status: 401 });
  const school = (await supabase.rpc("my_school")).data as { domain?: string } | null;
  if (!school?.domain) return new Response("Sign in with your school email.", { status: 403 });
  const { data, error } = await supabase.rpc("school_outcomes", { p_domain: school.domain });
  if (error) return new Response(error.code === "42501" ? "Only your school's admins can export outcomes." : "The export didn't work. Try again.", { status: error.code === "42501" ? 403 : 500 });
  const rows = ((data ?? []) as { outcome: string; course: string; term: string; students: number; average: number; meeting: number }[])
    .map((r) => ({ ...r, outcome: ABET_OUTCOMES.find((o) => o.id === r.outcome)?.label ?? r.outcome, students: String(r.students), average: String(r.average), meeting: String(r.meeting) }));
  const csv = evidenceCsv(rows as unknown as Record<string, string | null>[], COLUMNS);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="brazework-abet-outcomes-${school.domain}-${day}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
