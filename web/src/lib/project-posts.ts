import type { Post, PostProject } from "@/lib/forge";
import type { createClient } from "@/lib/supabase/server";

type Sb = Awaited<ReturnType<typeof createClient>>;

// Loads the projects that project posts point at, keyed by id (like projectsByIds() in projects.js).
export async function projectsForPosts(supabase: Sb, posts: Post[]): Promise<Record<string, PostProject>> {
  const ids = [...new Set(posts.map((p) => p.project_id).filter((id): id is string => !!id))];
  if (!ids.length) return {};
  const { data } = await supabase.from("projects").select("id, title, status, year, private, updated_at").in("id", ids);
  return Object.fromEntries(((data ?? []) as PostProject[]).map((p) => [p.id, p]));
}
