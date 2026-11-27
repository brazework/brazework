import { getViewer } from "@/lib/supabase/server";
import { evidenceCsv } from "@/lib/school-roster";

// GET /school/evidence: the school's accreditation evidence as a CSV (supabase/school-portal.sql
// school_evidence): every verified milestone in its classes and verified clubs, with the student, the
// class or club, the term, who verified it and the evidence. The database lets only the school's admins
// read it; anyone else gets 403.
const COLUMNS: [string, string][] = [
  ["student", "Student"], ["project", "Project"], ["milestone", "Milestone"], ["detail", "Detail"],
  ["setting", "Class or club"], ["term", "Term"], ["verified_by", "Verified by"], ["verifier_role", "Verifier's role"],
  ["verified_on", "Verified on"], ["evidence", "Evidence"], ["milestone_id", "Brazework milestone"],
];

export async function GET() {
  const { supabase, user } = await getViewer();
  if (!user) return new Response("Log in first.", { status: 401 });
  const school = (await supabase.rpc("my_school")).data as { domain?: string } | null;
  if (!school?.domain) return new Response("Sign in with your school email.", { status: 403 });
  const { data, error } = await supabase.rpc("school_evidence", { p_domain: school.domain });
  if (error) return new Response(error.code === "42501" ? "Only your school's admins can export evidence." : "The export didn't work. Try again.", { status: error.code === "42501" ? 403 : 500 });
  const csv = evidenceCsv((data ?? []) as Record<string, string | null>[], COLUMNS);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="brazework-evidence-${school.domain}-${day}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
