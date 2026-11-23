import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttachedFile, Post } from "@/lib/forge";

// The files on a page of posts that came from feed_page() (which doesn't carry them): one read each for
// project updates' files (project_files) and other posts' (post_files, once post-files.sql has run),
// as the member, so the same rules apply. Works with the server's or the browser's client. A post gets
// post_files: [] when the step has run, which is how its card knows it can take files from Edit.
const COLS = "id, kind, name, size, url, added_by, created_at, post_id";

export async function withAttachments<T extends Post>(supabase: SupabaseClient, posts: T[]): Promise<T[]> {
  const ids = posts.map((p) => p.id);
  if (!ids.length) return posts;
  const [pr, po] = await Promise.all([
    supabase.from("project_files").select(COLS).in("post_id", ids).order("created_at"),
    supabase.from("post_files").select(COLS).in("post_id", ids).order("created_at"),
  ]);
  const group = (rows: AttachedFile[] | null) => (rows ?? []).reduce((m, f) => m.set(f.post_id ?? "", [...(m.get(f.post_id ?? "") ?? []), f]), new Map<string, AttachedFile[]>());
  const byProject = pr.error ? null : group(pr.data as AttachedFile[]);
  const byPost = po.error ? null : group(po.data as AttachedFile[]);
  return posts.map((p) => ({
    ...p,
    ...(byProject ? { project_files: byProject.get(p.id) ?? [] } : {}),
    ...(byPost ? { post_files: byPost.get(p.id) ?? [] } : {}),
  }));
}
