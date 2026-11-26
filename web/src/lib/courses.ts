"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { rubricFromForm } from "@/lib/course-math";
import type { Proposal } from "@/lib/copilot-agent";

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
  const isQuiz = form.get("kind") === "quiz";
  let questions: unknown[] = [];
  if (isQuiz) {
    try { questions = JSON.parse(String(form.get("quiz_json") ?? "[]")); } catch { questions = []; }
    if (!Array.isArray(questions) || !questions.length) return { ok: false, message: "Add at least one question." };
  }
  const submit_as = isQuiz ? ["text"] : ["file", "link", "text", "milestone"].filter((k) => form.get(`as_${k}`) === "on");
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
    group_work: !isQuiz && form.get("group_work") === "on",
    submit_as,
    rubric: isQuiz ? [] : rubric,
    published: form.get("published") === "on",
    ...(form.get("peer_eval") === "on" && !isQuiz ? { peer_eval: true } : {}),
    ...(isQuiz ? { show_score: form.get("show_score") === "on" } : {}),
  };
  // A quiz is saved as a draft first, so the class is told only once its questions are in.
  const { data, error } = await v.supabase.from("assignments").insert({ ...row, published: isQuiz ? false : row.published }).select("id").single();
  if (error) return { ok: false, message: said(error) };
  if (isQuiz) {
    const q = await v.supabase.rpc("set_quiz", { p_aid: data.id, p_questions: questions });
    if (q.error) { await v.supabase.from("assignments").delete().eq("id", data.id); return { ok: false, message: said(q.error) }; }
    if (row.published) await v.supabase.from("assignments").update({ published: true }).eq("id", data.id);
  }
  refresh(cid);
  return { ok: true, message: row.published ? `${isQuiz ? "Quiz" : "Assignment"} posted. The class has been told.` : "Saved as a draft. Publish it when you're ready.", id: data.id as string };
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

// ---------- Phase B (supabase/courses-b.sql) ----------

export async function takeQuiz(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80), aid = str(form, "aid", 80);
  let answers: Record<string, unknown> = {};
  try { answers = JSON.parse(String(form.get("answers") ?? "{}")); } catch { return { ok: false, message: "Those answers look wrong. Try again." }; }
  const { data, error } = await v.supabase.rpc("submit_quiz", { p_aid: aid, p_answers: answers });
  if (error) return { ok: false, message: said(error) };
  refresh(cid, aid);
  return { ok: true, message: data == null ? "Handed in. Your score comes when your professor releases it." : `Handed in. You scored ${data}.` };
}

export async function setExtension(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80), aid = str(form, "aid", 80), uid = str(form, "uid", 40);
  const due = str(form, "due_iso", 40);
  if (!uid) return { ok: false, message: "Choose the student." };
  const { error } = await v.supabase.rpc("set_extension", { p_aid: aid, p_uid: uid, p_due_at: due ? new Date(due).toISOString() : null });
  if (error) return { ok: false, message: said(error) };
  refresh(cid, aid);
  return { ok: true, message: due ? "Extension given. Their due date has moved." : "Extension removed." };
}

export async function setAccommodation(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80), uid = str(form, "uid", 40);
  if (!uid) return { ok: false, message: "Choose the student." };
  const days = Math.round(Number(str(form, "extra_days", 4) || "0")), pct = Math.round(Number(str(form, "extra_time_pct", 4) || "0"));
  if (!Number.isFinite(days) || !Number.isFinite(pct)) return { ok: false, message: "Use whole numbers." };
  const { error } = await v.supabase.rpc("set_accommodation", { p_cid: cid, p_uid: uid, p_extra_days: days, p_extra_time_pct: pct, p_note: str(form, "note", 500) });
  if (error) return { ok: false, message: said(error) };
  refresh(cid);
  return { ok: true, message: days || pct ? "Accommodation saved. Due dates move for this student on every assignment." : "Accommodation removed." };
}

export async function openSession(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80);
  const minutes = Math.round(Number(str(form, "minutes", 4) || "15"));
  const { data, error } = await v.supabase.rpc("open_session", { p_cid: cid, p_title: str(form, "title", 120), p_minutes: minutes });
  if (error) return { ok: false, message: said(error) };
  revalidatePath(`/c/${cid}/course`);
  return { ok: true, message: minutes ? `Check-in is open for ${minutes} minutes.` : "Session added. Mark attendance below.", id: data as string };
}

export async function markAttendance(cid: string, sid: string, uid: string, status: string): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const { error } = await v.supabase.rpc("mark_attendance", { p_sid: sid, p_uid: uid, p_status: status });
  if (error) return { ok: false, message: said(error) };
  revalidatePath(`/c/${cid}/course`);
  return { ok: true, message: "Saved." };
}

export async function closeSession(cid: string, sid: string): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const { error } = await v.supabase.rpc("close_session", { p_sid: sid });
  if (error) return { ok: false, message: said(error) };
  revalidatePath(`/c/${cid}/course`);
  return { ok: true, message: "Check-in closed." };
}

export async function checkIn(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const code = str(form, "code", 12);
  if (!code) return { ok: false, message: "Type the code on the screen." };
  const { data, error } = await v.supabase.rpc("check_in", { p_code: code });
  if (error) return { ok: false, message: said(error) };
  revalidatePath("/school");
  return { ok: true, message: `You're checked in to ${data as string}.` };
}

export async function peerReview(_: CourseState, form: FormData): Promise<CourseState> {
  const v = await viewer(); if (!v) return { ok: false, message: "Log in again." };
  const cid = str(form, "cid", 80), aid = str(form, "aid", 80);
  const rated = [...form.keys()].filter((k) => k.startsWith("score_"));
  if (!rated.length) return { ok: false, message: "Rate each teammate from 1 to 5." };
  for (const k of rated) {
    const uid = k.slice("score_".length);
    const score = Number(form.get(k));
    if (!score) return { ok: false, message: "Rate each teammate from 1 to 5." };
    const { error } = await v.supabase.rpc("submit_peer_review", { p_aid: aid, p_reviewee: uid, p_score: score, p_comment: str(form, `comment_${uid}`, 2000) });
    if (error) return { ok: false, message: said(error) };
  }
  refresh(cid, aid);
  return { ok: true, message: "Thanks. Only your professor sees your ratings." };
}

// ---------- Torch's course cards (components/copilot/proposal-card.tsx) ----------
// The professor confirms a card Torch drafted; these run the same checks as the course forms.
type P<K extends string> = Extract<Proposal, { kind: K }>;
const none: CourseState = { ok: false, message: "" };

export async function torchQuiz(p: P<"quiz">): Promise<CourseState> {
  const f = new FormData();
  f.set("cid", p.class_id); f.set("kind", "quiz"); f.set("title", p.title); f.set("instructions", p.instructions ?? "");
  f.set("due_iso", p.closes_at ?? ""); f.set("quiz_json", JSON.stringify(p.questions));
  if (p.show_score) f.set("show_score", "on");
  if (p.publish) f.set("published", "on");
  return saveAssignment(none, f);
}

export async function torchAssignment(p: P<"assignment">): Promise<CourseState> {
  const f = new FormData();
  f.set("cid", p.class_id); f.set("kind", "assignment"); f.set("title", p.title); f.set("instructions", p.instructions ?? "");
  f.set("due_iso", p.due_at ?? ""); f.set("points", String(p.points ?? 100));
  for (const k of p.submit_as) f.set(`as_${k}`, "on");
  p.rubric.forEach((r, i) => { f.set(`criterion_${i}`, r.criterion); f.set(`points_${i}`, String(r.points)); if (r.outcome) f.set(`outcome_${i}`, r.outcome); });
  if (p.group_work) f.set("group_work", "on");
  if (p.peer_eval) f.set("peer_eval", "on");
  if (p.publish) f.set("published", "on");
  return saveAssignment(none, f);
}

export async function torchAnnouncement(p: P<"announcement">): Promise<CourseState> {
  const f = new FormData();
  f.set("cid", p.class_id); f.set("title", p.title); f.set("body", p.body);
  return announce(none, f);
}

export async function torchExtension(p: P<"extension">): Promise<CourseState> {
  const f = new FormData();
  f.set("cid", p.class_id); f.set("aid", p.assignment_id); f.set("uid", p.person_id); f.set("due_iso", p.due_at);
  return setExtension(none, f);
}

export async function torchAttendance(p: P<"attendance">): Promise<CourseState> {
  const f = new FormData();
  f.set("cid", p.class_id); f.set("title", p.title ?? ""); f.set("minutes", String(p.minutes || 15));
  return openSession(none, f);
}
