"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_TOPICS, friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

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
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const v = parsed.data;
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to save." };
  const year = v.status === "completed" && /^\d{4}$/.test(v.year) ? Number(v.year) : null;
  const row = { title: v.title, summary: v.summary, status: v.status, year, tags: v.tags, private: v.private };
  const q = v.id ? supabase.from("projects").update(row).eq("id", v.id).select("id") : supabase.from("projects").insert(row).select("id");
  const { data, error } = await q;
  if (error) return { ok: false, message: friendlyError(error) };
  const id = data?.[0]?.id as string | undefined;
  if (!id) return { ok: false, message: "You don't have permission to do that." };
  const d = { details: v.details, link: v.link };
  const upd = v.id ? await supabase.from("project_details").update(d).eq("project_id", id).select("project_id") : { data: [] };
  if (!upd.data?.length) {
    const { error: e2 } = await supabase.from("project_details").insert({ project_id: id, ...d });
    if (e2) return { ok: false, message: friendlyError(e2) };
  }
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: v.id ? "Project saved." : "Project added." };
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
export async function shareProject(id: string, body: string): Promise<ProjectState> {
  const text = body.trim();
  if (!text) return { ok: false, message: "Write something about it first." };
  if (text.length > 3000) return { ok: false, message: "Posts can be up to 3,000 characters." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data: pr } = await supabase.from("projects").select("tags").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!pr) return { ok: false, message: "That project couldn't be found." };
  const { error } = await supabase.from("posts").insert({ body: text, project_id: id, kind: "project", tags: ((pr.tags as string[]) ?? []).slice(0, 3) });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/feed");
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "Shared to your feed." };
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
