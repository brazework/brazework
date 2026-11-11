"use server";
import { OPEN_TO, cleanLinks, type ProfileLink } from "@/lib/profile-meta";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_TOPICS, friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { dbFeatures } from "@/lib/db-features";

// Projects on profiles (public/js/projects.js + supabase/projects.sql). Everyone sees a project's
// card; the write-up and link stay hidden from others while it's private (row-level security).

export type ProjectState = { ok: boolean; message: string };

const schema = z
  .object({
    id: z.string().max(64).optional().default(""),
    title: z.string().trim().min(1, "Give your project a title.").max(120),
    summary: z.string().trim().min(1, "Add a one-paragraph summary.").max(600),
    status: z.enum(["in_progress", "completed"]),
    year: z.string().optional().default(""),
    tags: z.array(z.string().refine((t) => ALL_TOPICS.includes(t))).max(3, "Pick up to 3 topics."),
    private: z.boolean(),
    details: z.string().trim().max(5000).default(""),
    link: z.string().trim().max(300).default(""),
    tools: z.array(z.string().trim().min(1).max(40).refine((t) => !/[<>]/.test(t))).max(12, "Pick up to 12 tools.").default([]),
    specs: z.array(z.object({ label: z.string().trim().min(1).max(40, "Spec names are up to 40 characters."), value: z.string().trim().min(1).max(80, "Spec values are up to 80 characters.") })).max(16, "Up to 16 specs.").default([]),
  })
  .refine((v) => v.link === "" || /^https?:\/\/\S+$/i.test(v.link), { message: "Links must start with http:// or https://", path: ["link"] });

export async function saveProject(_: ProjectState, form: FormData): Promise<ProjectState> {
  const parsed = schema.safeParse({
    id: form.get("id") ?? "",
    title: form.get("title"),
    summary: form.get("summary"),
    status: form.get("status"),
    year: form.get("year") ?? "",
    tags: form.getAll("tags"),
    private: form.get("private") === "on",
    details: form.get("details") ?? "",
    link: form.get("link") ?? "",
    tools: [...new Set(form.getAll("tools").map(String))],
    // Specs come as matching label/value rows; a row with either side empty is dropped.
    specs: form.getAll("spec_label").map((l, i) => ({ label: String(l).trim(), value: String(form.getAll("spec_value")[i] ?? "").trim() })).filter((r) => r.label && r.value),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to save." };
  const year = v.status === "completed" && /^\d{4}$/.test(v.year) ? Number(v.year) : null;
  // "Built with" is saved once supabase/project-stack.sql is applied.
  const row = { title: v.title, summary: v.summary, status: v.status, year, tags: v.tags, private: v.private, ...((await dbFeatures()).projectTools && { tools: v.tools }) };
  const q = v.id ? supabase.from("projects").update(row).eq("id", v.id).select("id") : supabase.from("projects").insert(row).select("id");
  const { data, error } = await q;
  if (error) return { ok: false, message: friendlyError(error) };
  const id = data?.[0]?.id as string | undefined;
  if (!id) return { ok: false, message: "You don't have permission to do that." };
  const d = { details: v.details, link: v.link, ...((await dbFeatures()).projectSpecs && { specs: v.specs }) };
  const upd = v.id ? await supabase.from("project_details").update(d).eq("project_id", id).select("project_id") : { data: [] };
  if (!upd.data?.length) {
    const { error: e2 } = await supabase.from("project_details").insert({ project_id: id, ...d });
    if (e2) return { ok: false, message: friendlyError(e2) };
  }
  revalidatePath(`/u/${user.id}`);
  revalidatePath(`/projects/${id}`);
  return { ok: true, message: v.id ? "Project saved." : "Project added." };
}

// "What are you building this semester?" (Linear FIX-71): one answer starts your first project, so
// nobody faces a blank form. The answer is its title (and summary); everything else can come later.
export async function startProject(text: string): Promise<ProjectState & { id?: string }> {
  const answer = String(text ?? "").replace(/\s+/g, " ").trim();
  if (answer.length < 3) return { ok: false, message: "Say what you're building, in a few words." };
  if (answer.length > 300) return { ok: false, message: "Keep it short: a sentence is plenty." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to save." };
  const title = answer.length <= 120 ? answer : `${answer.slice(0, 117).replace(/\s+\S*$/, "")}...`;
  const { data, error } = await supabase.from("projects").insert({ title, summary: answer, status: "in_progress", year: null, tags: [], private: false }).select("id");
  if (error) return { ok: false, message: friendlyError(error) };
  const id = data?.[0]?.id as string | undefined;
  if (!id) return { ok: false, message: "You don't have permission to do that." };
  await supabase.from("project_details").insert({ project_id: id, details: "", link: "" });
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/feed");
  return { ok: true, message: "Project started.", id };
}

export async function deleteProject(id: string): Promise<ProjectState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/feed");
  return { ok: true, message: "" };
}

export async function setProjectPrivate(id: string, value: boolean): Promise<ProjectState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("projects").update({ private: value }).eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "" };
}

// A feed post about your project. Its topics come from the project.
export async function shareProject(id: string, body: string): Promise<ProjectState & { postId?: string }> {
  const text = body.trim();
  if (!text) return { ok: false, message: "Write something about it first." };
  if (text.length > 3000) return { ok: false, message: "Posts can be up to 3,000 characters." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data: pr } = await supabase.from("projects").select("tags").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!pr) return { ok: false, message: "That project couldn't be found." };
  const { data: post, error } = await supabase.from("posts").insert({ body: text, project_id: id, kind: "project", tags: ((pr.tags as string[]) ?? []).slice(0, 3) }).select("id").single();
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/feed");
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "Posted. It's in your followers' feeds too.", postId: (post as { id: string }).id };
}

export async function updateProfileBasics(_: ProjectState, form: FormData): Promise<ProjectState> {
  const headline = String(form.get("headline") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  if (headline.length > 200) return { ok: false, message: "Headlines can be up to 200 characters." };
  if (bio.length > 2000) return { ok: false, message: "Bios can be up to 2,000 characters." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("profiles").update({ headline, bio }).eq("id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/feed");
  return { ok: true, message: "Saved." };
}

// Open to, links and location (supabase/profile-extras.sql).
export async function saveProfileExtras(_: ProjectState, form: FormData): Promise<ProjectState> {
  if (!(await dbFeatures()).profileExtras) return { ok: false, message: "This isn't turned on yet." };
  const openTo = form.getAll("openTo").map(String).filter((o) => OPEN_TO.some((x) => x.id === o)).slice(0, 4);
  const location = String(form.get("location") ?? "").replace(/[<>]/g, "").trim().slice(0, 80);
  let links: ProfileLink[] | null = null;
  try { links = cleanLinks(JSON.parse(String(form.get("links") ?? "[]"))); } catch {}
  if (!links) return { ok: false, message: "Links must start with https:// (up to five)." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("profiles").update({ open_to: openTo, location, links }).eq("id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "Saved." };
}

// Profile photo or cover banner (supabase/media.sql). The path must be in your own folder; the
// database checks it again. The old file is removed so replaced photos don't pile up.
export async function setProfileMedia(kind: "avatar" | "cover", path: string): Promise<ProjectState> {
  const { supabase, user, profile } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  if (path && !new RegExp(`^${user.id}/[A-Za-z0-9._-]+$`).test(path)) return { ok: false, message: "That file couldn't be used." };
  const column = kind === "avatar" ? "avatar_path" : "cover_path";
  const old = (kind === "avatar" ? profile?.avatar_path : profile?.cover_path) ?? "";
  const { error } = await supabase.from("profiles").update({ [column]: path }).eq("id", user.id);
  if (error) return { ok: false, message: error.code === "42703" ? "Photos aren't turned on yet." : friendlyError(error) };
  if (old && old !== path) await supabase.storage.from("media").remove([old]).catch(() => {});
  revalidatePath("/", "layout");
  return { ok: true, message: "" };
}
