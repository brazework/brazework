"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { cleanUrl, githubRepo, kindOfFile } from "@/lib/project-file-types";
import { getViewer } from "@/lib/supabase/server";

// Files, 3D models and links on any post that isn't a project update (supabase/post-files.sql): on the
// home feed or in a club, added from Edit. The browser uploads to the private "post-files" bucket under
// "<post id>/<random>.<ext>"; these record and remove them. The database lets only the post's author
// add, and the uploader remove.
export type FileState = { ok: boolean; message: string };

const BUCKET = "post-files";
const done = (postId: string) => { revalidatePath("/feed"); revalidatePath(`/post/${postId}`); revalidatePath("/c", "layout"); };

export async function recordPostFile(postId: string, path: string, name: string, size: number): Promise<FileState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const cleanName = name.trim().slice(0, 200) || "File";
  if (!kindOfFile(cleanName) || !path.startsWith(`${postId}/`)) return { ok: false, message: "That file type can't be added." };
  const { error } = await supabase.from("post_files").insert({ post_id: postId, kind: "file", name: cleanName, path, size: Math.max(0, Math.round(size)) });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, message: error.code === "42501" || error.code === "P0001" ? error.message : friendlyError(error) };
  }
  done(postId);
  return { ok: true, message: "Added." };
}

export async function addPostLink(postId: string, raw: string): Promise<FileState> {
  const url = cleanUrl(raw);
  if (!url) return { ok: false, message: "That doesn't look like a link. Paste a full address, like github.com/you/repo." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const u = new URL(url);
  const name = (githubRepo(url) || u.host.replace(/^www\./, "") + u.pathname.replace(/\/$/, "")).slice(0, 200);
  const { error } = await supabase.from("post_files").insert({ post_id: postId, kind: "link", name, url });
  if (error) return { ok: false, message: friendlyError(error) };
  done(postId);
  return { ok: true, message: "Link added." };
}

export async function removePostFile(id: number): Promise<FileState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("post_files").delete().eq("id", id).select("path, post_id");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "Only the person who added it can remove it." };
  const row = data[0] as { path: string | null; post_id: string };
  if (row.path) await supabase.storage.from(BUCKET).remove([row.path]);
  done(row.post_id);
  return { ok: true, message: "Removed." };
}

// Everything attached to one post, as its card shows it: a project update's files (project_files) and
// any other post's (post_files). Read as the member, so the same rules apply. Used right after Edit adds
// files, so the card's viewers appear without waiting for the feed to reload.
export async function postAttachments(postId: string): Promise<{ id: number; kind: "file" | "link"; name: string; size: number | null; url: string | null; added_by: string; created_at: string; post_id: string | null; source: "project" | "post" }[]> {
  const { supabase, user } = await getViewer();
  if (!user || typeof postId !== "string" || postId.length > 64) return [];
  const cols = "id, kind, name, size, url, added_by, created_at, post_id";
  const [pr, po] = await Promise.all([
    supabase.from("project_files").select(cols).eq("post_id", postId).order("created_at"),
    supabase.from("post_files").select(cols).eq("post_id", postId).order("created_at"),
  ]);
  type Row = { id: number; kind: "file" | "link"; name: string; size: number | null; url: string | null; added_by: string; created_at: string; post_id: string | null };
  return [...((pr.data ?? []) as Row[]).map((r) => ({ ...r, source: "project" as const })), ...((po.data ?? []) as Row[]).map((r) => ({ ...r, source: "post" as const }))];
}
