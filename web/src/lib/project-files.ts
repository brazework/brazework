"use server";
import { revalidatePath } from "next/cache";
import { dbFeatures } from "@/lib/db-features";
import { friendlyError } from "@/lib/forge";
import { cleanUrl, githubRepo, kindOfFile } from "@/lib/project-file-types";
import { getViewer } from "@/lib/supabase/server";

// Files and links attached to project updates (supabase/project-files.sql, project-update-files.sql).
// Files go from the browser straight to the private "project-files" bucket; these record them
// against the update they came with, and remove them. Row-level security decides who may do each.

export type FileState = { ok: boolean; message: string };

const BUCKET = "project-files";
const done = (projectId: string) => revalidatePath(`/projects/${projectId}`);
// The update a file belongs to, once step 39 has run.
const withPost = async (postId?: string) => (postId && (await dbFeatures()).updateFiles ? { post_id: postId } : {});

// After the browser uploaded a file to "<project id>/<random>.<ext>", record it.
export async function recordProjectFile(projectId: string, path: string, name: string, size: number, postId?: string): Promise<FileState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const cleanName = name.trim().slice(0, 200) || "File";
  if (!kindOfFile(cleanName) || !path.startsWith(`${projectId}/`)) return { ok: false, message: "That file type can't be added." };
  const { error } = await supabase.from("project_files").insert({ project_id: projectId, kind: "file", name: cleanName, path, size: Math.max(0, Math.round(size)), ...(await withPost(postId)) });
  if (error) {
    // Don't leave an orphaned upload behind.
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, message: friendlyError(error) };
  }
  done(projectId);
  return { ok: true, message: "Added." };
}

// A link: a GitHub repo, a CAD share, a Drive folder, a demo. GitHub links are named after the repo.
export async function addProjectLink(projectId: string, raw: string, postId?: string): Promise<FileState> {
  const url = cleanUrl(raw);
  if (!url) return { ok: false, message: "That doesn't look like a link. Paste a full address, like github.com/you/repo." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const u = new URL(url);
  const name = (githubRepo(url) || u.host.replace(/^www\./, "") + u.pathname.replace(/\/$/, "")).slice(0, 200);
  const { error } = await supabase.from("project_files").insert({ project_id: projectId, kind: "link", name, url, ...(await withPost(postId)) });
  if (error) return { ok: false, message: friendlyError(error) };
  done(projectId);
  return { ok: true, message: "Link added." };
}

export async function removeProjectFile(projectId: string, id: number): Promise<FileState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("project_files").delete().eq("id", id).eq("project_id", projectId).select("path");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "Only the person who added it, or the project's owner, can remove it." };
  const path = (data[0] as { path: string | null }).path;
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  done(projectId);
  return { ok: true, message: "Removed." };
}

// A fresh short-lived link to open or download one file (the bucket is private).
export async function projectFileLink(projectId: string, id: number, download = false): Promise<{ ok: boolean; url?: string; message?: string }> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data } = await supabase.from("project_files").select("path, name").eq("id", id).eq("project_id", projectId).maybeSingle();
  const row = data as { path: string | null; name: string } | null;
  if (!row?.path) return { ok: false, message: "That file isn't available." };
  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.path, 60 * 10, download ? { download: row.name } : undefined);
  if (error || !signed) return { ok: false, message: "That file couldn't be opened. Try again." };
  return { ok: true, url: signed.signedUrl };
}
