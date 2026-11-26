// Brazework Courses (supabase/courses.sql): the arithmetic the course pages share. When work is due
// and whether it came in late, a rubric read from the assignment form, the gradebook (each student's
// scores, total and percentage) and its CSV for the registrar. Pure, and tested
// (tests/course-math.test.ts).

export type RubricRow = { id: string; criterion: string; points: number; outcome?: string };
export type CourseAssignment = { id: string; title: string; points: number; due_at: string | null; published: boolean; group_work?: boolean };
export type CourseGrade = { assignment_id: string; uid: string; score: number | null; released: boolean };
export type CourseSubmission = { assignment_id: string; uid: string; project_id?: string | null; submitted_at: string };
export type Student = { uid: string; name: string; email?: string };

// ABET's seven student outcomes (Criterion 3), short names for the rubric's outcome menu.
export const ABET_OUTCOMES: { id: string; label: string }[] = [
  { id: "1", label: "1 · Solve complex engineering problems" },
  { id: "2", label: "2 · Design to meet needs" },
  { id: "3", label: "3 · Communicate effectively" },
  { id: "4", label: "4 · Ethics and professional responsibility" },
  { id: "5", label: "5 · Teamwork" },
  { id: "6", label: "6 · Experiment, analyze, conclude" },
  { id: "7", label: "7 · Learn new things" },
];

/** Came in after the due date (never late without one). */
export function isLate(submittedAt: string | null | undefined, dueAt: string | null | undefined): boolean {
  if (!submittedAt || !dueAt) return false;
  return new Date(submittedAt).getTime() > new Date(dueAt).getTime();
}

/** "Due in 3 days", "Due tomorrow", "Due today", "Was due 2 days ago", or "No due date". */
export function dueText(dueAt: string | null | undefined, now: number): string {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt).getTime();
  const day = 86_400_000;
  const startOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOf(due) - startOf(now)) / day);
  if (due < now) return days === 0 ? "Was due today" : days === -1 ? "Was due yesterday" : `Was due ${-days} days ago`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return days < 14 ? `Due in ${days} days` : `Due ${new Date(due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** The rubric rows from the assignment form (criterion_N, points_N, outcome_N), skipping empty rows. */
export function rubricFromForm(form: FormData, max = 20): RubricRow[] {
  const rows: RubricRow[] = [];
  for (let i = 0; i < max; i++) {
    const criterion = String(form.get(`criterion_${i}`) ?? "").trim();
    if (!criterion) continue;
    const points = Number(String(form.get(`points_${i}`) ?? "").trim());
    const outcome = String(form.get(`outcome_${i}`) ?? "").trim();
    rows.push({ id: `r${i + 1}`, criterion: criterion.slice(0, 200), points: Number.isFinite(points) && points >= 0 ? points : 0, ...(/^[1-7]$/.test(outcome) ? { outcome } : {}) });
  }
  return rows;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export type GradebookRow = { uid: string; name: string; email?: string; cells: { assignment_id: string; score: number | null; released: boolean; submitted: boolean; late: boolean }[]; earned: number; possible: number; percent: number | null };

/**
 * One row per student, one cell per published assignment. The total counts only graded work, so a
 * student's percentage is how they're doing on what's been graded so far (what a gradebook shows).
 * Group work: a group's submission counts for each teammate it was graded for.
 */
export function gradebook(students: Student[], assignments: CourseAssignment[], grades: CourseGrade[], submissions: CourseSubmission[], teams: Map<string, string[]> = new Map()): GradebookRow[] {
  const published = assignments.filter((a) => a.published);
  const g = new Map(grades.map((x) => [`${x.assignment_id}|${x.uid}`, x]));
  const s = new Map<string, CourseSubmission>();
  for (const x of submissions) {
    s.set(`${x.assignment_id}|${x.uid}`, x);
    for (const mate of (x.project_id && teams.get(x.project_id)) || []) if (!s.has(`${x.assignment_id}|${mate}`)) s.set(`${x.assignment_id}|${mate}`, x);
  }
  return students.map((st) => {
    let earned = 0, possible = 0;
    const cells = published.map((a) => {
      const gr = g.get(`${a.id}|${st.uid}`);
      const sub = s.get(`${a.id}|${st.uid}`);
      if (gr && gr.score != null) { earned += gr.score; possible += a.points; }
      return { assignment_id: a.id, score: gr?.score ?? null, released: !!gr?.released, submitted: !!sub, late: isLate(sub?.submitted_at, a.due_at) };
    });
    return { uid: st.uid, name: st.name, email: st.email, cells, earned: round1(earned), possible: round1(possible), percent: possible > 0 ? round1((earned / possible) * 100) : null };
  });
}

const csvCell = (v: string | number | null | undefined) => {
  const t = v == null ? "" : String(v);
  // Quote anything with a comma, quote or newline; neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(t) ? `'${t}` : t;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The gradebook as CSV: Student, Email, each assignment (out of its points), Total, Percent. */
export function gradesCsv(rows: GradebookRow[], assignments: CourseAssignment[]): string {
  const published = assignments.filter((a) => a.published);
  const head = ["Student", "Email", ...published.map((a) => `${a.title} (${a.points})`), "Total", "Percent"];
  const lines = rows.map((r) => [r.name, r.email ?? "", ...r.cells.map((c) => c.score), `${r.earned}/${r.possible}`, r.percent == null ? "" : r.percent]);
  return [head, ...lines].map((l) => l.map(csvCell).join(",")).join("\n") + "\n";
}
