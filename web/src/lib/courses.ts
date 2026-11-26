"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { rubricFromForm } from "@/lib/course-math";

// Brazework Courses' actions (supabase/courses.sql). Row-level security and the database's functions
// decide who may do each (course staff write the course; students hand in their own work; grades are
// written and released only by staff); these pass the words along and refresh the course pages.
export type CourseState = { ok: boolean; message: string; id?: string };

const said = (e: { code?: string; message?: string }) => (["P0001", "42501"].includes(e.code ?? "") ? e.message ?? friendlyError(e) : /row-level security/i.test(e.message ?? "") ? "Only the class's professor or teaching assistants can change the course." : friendlyError(e));
const str = (f: FormData, k: string, max = 20000) => String(f.get(k) ?? "").trim().slice(0, max);
const refresh = (cid: string, aid?: string) => {
  revalidatePath(`/c/${cid}/course`);
  if (aid) revalidatePath(`/c/${cid}/course/a/${aid}`);
  revalidatePath("/school");
};
async function viewer() {
  const v = await getViewer();
  return v.user ? v : null;
}

export async function addModule(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80);
  const title = str(form, "title", 120);
  if (!title) return { ok: false, message: "Give the module a name, like Week 1: Requirements." };
  const { count } = await v.supabase.from("course_modules").select("id", { count: "exact", head: true }).eq("community_id", cid);
  const { error } = await v.supabase.from("course_modules").insert({ community_id: cid, title, position: count ?? 0, published: form.get("published") === "on" });
  if (error) return { ok: false, message: said(error) };
  refresh(cid);
  return { ok: true, message: "Module added." };
}

export async function addItem(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80), module_id = str(form, "module_id", 80), kind = str(form, "kind", 10);
  const title = str(form, "title", 160);
  if (!title) return { ok: false, message: "Give it a title." };
  const row: Record<string, unknown> = { community_id: cid, module_id, kind, title };
  if (kind === "page") row.body = str(form, "body");
  else if (kind === "link") {
    const url = str(form, "url", 500);
    row.url = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  } else if (kind === "file") { row.path = str(form, "path", 300); row.size = Number(form.get("size")) || null; }
  else return { ok: false, message: "Choose a page, a link or a file." };
  const { count } = await v.supabase.from("course_items").select("id", { count: "exact", head: true }).eq("module_id", module_id);
  const { error } = await v.supabase.from("course_items").insert({ ...row, position: count ?? 0 });
  if (error) return { ok: false, message: said(error) };
  refresh(cid);
  return { ok: true, message: "Added." };
}

export async function saveAssignment(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80);
  const title = str(form, "title", 160);
  if (!title) return { ok: false, message: "Give the assignment a title." };
  const submit_as = ["file", "link", "text", "milestone"].filter((k) => form.get(`as_${k}`) === "on");
  if (!submit_as.length) return { ok: false, message: "Choose at least one way to hand it in." };
  const due = str(form, "due_iso", 40);
  const rubric = rubricFromForm(form);
  const points = Number(str(form, "points", 10) || "100");
  const row = {
    community_id: cid,
    module_id: str(form, "module_id", 80) || null,
    title,
    instructions: str(form, "instructions"),
    due_at: due && !Number.isNaN(Date.parse(due)) ? new Date(due).toISOString() : null,
    points: Number.isFinite(points) && points >= 0 ? points : 100,
    group_work: form.get("group_work") === "on",
    submit_as,
    rubric,
    published: form.get("published") === "on",
  };
  const { data, error } = await v.supabase.from("assignments").insert(row).select("id").single();
  if (error) return { ok: false, message: said(error) };
  refresh(cid);
  return { ok: true, message: row.published ? "Assignment posted. The class has been told." : "Saved as a draft. Publish it when you're ready.", id: data.id as string };
}

/** Publish or unpublish a module or an assignment (publishing an assignment tells the class). */
export async function setPublished(table: "course_modules" | "assignments", id: string, cid: string, published: boolean): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const { data, error } = await v.supabase.from(table).update({ published }).eq("id", id).select("id");
  if (error) return { ok: false, message: said(error) };
  if (!data?.length) return { ok: false, message: "Only the class's professor or teaching assistants can change the course." };
  refresh(cid, table === "assignments" ? id : undefined);
  return { ok: true, message: published ? "Published." : "Hidden from students." };
}

export async function removeCourseThing(table: "course_modules" | "course_items" | "assignments" | "course_announcements", id: string, cid: string): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const { data, error } = await v.supabase.from(table).delete().eq("id", id).select("id");
  if (error) return { ok: false, message: said(error) };
  if (!data?.length) return { ok: false, message: "Only the class's professor or teaching assistants can change the course." };
  refresh(cid);
  return { ok: true, message: "Removed." };
}

export async function announce(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80);
  const title = str(form, "title", 160), body = str(form, "body", 10000);
  if (!title || !body) return { ok: false, message: "Give the announcement a title and a message." };
  const { error } = await v.supabase.from("course_announcements").insert({ community_id: cid, author_id: v.user!.id, title, body });
  if (error) return { ok: false, message: said(error) };
  refresh(cid);
  return { ok: true, message: "Announced. Everyone in the class has been told." };
}

export async function submitAssignment(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80), aid = str(form, "aid", 80);
  const url = str(form, "url", 500);
  const { data, error } = await v.supabase.rpc("submit_assignment", {
    p_aid: aid,
    p_body: str(form, "body"),
    p_url: url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : null,
    p_file_path: str(form, "file_path", 300) || null,
    p_file_name: str(form, "file_name", 200) || null,
    p_milestone: str(form, "milestone_id", 80) || null,
    p_project: str(form, "project_id", 80) || null,
  });
  if (error) return { ok: false, message: said(error) };
  refresh(cid, aid);
  return { ok: true, message: "Handed in. You can replace it until your grade is out.", id: data as string };
}

export async function gradeStudents(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80), aid = str(form, "aid", 80);
  const uids = String(form.get("uids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const rubric: Record<string, number> = {};
  for (const [k, val] of form.entries()) {
    if (!k.startsWith("rubric_")) continue;
    const t = String(val).trim();
    if (t === "") continue;
    const n = Number(t);
    if (!Number.isFinite(n)) return { ok: false, message: "Rubric scores must be numbers." };
    rubric[k.slice("rubric_".length)] = n;
  }
  const scoreText = str(form, "score", 10);
  const score = scoreText === "" ? null : Number(scoreText);
  if (!Object.keys(rubric).length && (score == null || !Number.isFinite(score))) return { ok: false, message: "Give a score, or score the rubric's rows." };
  const release = form.get("release") === "on";
  const { error } = await v.supabase.rpc("grade_students", { p_aid: aid, p_uids: uids, p_score: Object.keys(rubric).length ? null : score, p_rubric: rubric, p_feedback: str(form, "feedback", 10000), p_release: release });
  if (error) return { ok: false, message: said(error) };
  // Grading a milestone submission can verify the milestone too: the graded work joins the record.
  const ms = str(form, "verify_milestone", 80);
  if (ms && form.get("verify") === "on") {
    const r = await v.supabase.rpc("review_milestone", { p_id: ms, p_verify: true, p_note: str(form, "feedback", 500) });
    if (r.error) { refresh(cid, aid); return { ok: false, message: `Graded, but the milestone wasn't verified: ${said(r.error)}` }; }
  }
  refresh(cid, aid);
  return { ok: true, message: release ? "Graded and released." : "Graded. Release it when you're ready." };
}

export async function releaseGrades(cid: string, aid: string): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const { data, error } = await v.supabase.rpc("release_grades", { p_aid: aid });
  if (error) return { ok: false, message: said(error) };
  refresh(cid, aid);
  const n = data as number;
  return { ok: true, message: n ? `${n} ${n === 1 ? "grade" : "grades"} released. Each student has been told.` : "Every grade is already out." };
}
