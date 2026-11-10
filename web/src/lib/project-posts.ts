import type { Post, PostProject } from "@/lib/forge";
import { dbFeatures } from "@/lib/db-features";
import type { createClient } from "@/lib/supabase/server";

type Sb = Awaited<ReturnType<typeof createClient>>;

// Loads the projects that project posts point at, keyed by id (like projectsByIds() in projects.js),
// with what the card shows under the post: the tools it's built with, its top specs, and its
// club-verified proof (row-level security decides which milestones the viewer may count).
export async function projectsForPosts(supabase: Sb, posts: Post[]): Promise<Record<string, PostProject>> {
  const ids = [...new Set(posts.map((p) => p.project_id).filter((id): id is string => !!id))];
  if (!ids.length) return {};
  const f = await dbFeatures();
  const [proj, specs, proof] = await Promise.all([
    supabase.from("projects").select(`id, title, status, year, private, updated_at${f.projectTools ? ", tools" : ""}`).in("id", ids),
    f.projectSpecs ? supabase.from("project_details").select("project_id, specs").in("project_id", ids) : Promise.resolve({ data: [] }),
    f.milestones ? supabase.from("milestones").select("project_id, community_name").eq("status", "verified").in("project_id", ids).limit(500) : Promise.resolve({ data: [] }),
  ]);
  const specsBy = new Map(((specs.data ?? []) as { project_id: string; specs: { label: string; value: string }[] | null }[]).map((d) => [d.project_id, (d.specs ?? []).filter((s) => s.label && s.value).slice(0, 3)]));
  const proofBy = new Map<string, { n: number; clubs: string[] }>();
  for (const m of (proof.data ?? []) as { project_id: string; community_name: string }[]) {
    const cur = proofBy.get(m.project_id) ?? { n: 0, clubs: [] };
    cur.n++;
    if (m.community_name && !cur.clubs.includes(m.community_name)) cur.clubs.push(m.community_name);
    proofBy.set(m.project_id, cur);
  }
  return Object.fromEntries(((proj.data ?? []) as unknown as (PostProject & { tools?: string[] })[]).map((p) => [p.id, {
    ...p,
    tools: (p.tools ?? []).slice(0, 4),
    specs: specsBy.get(p.id) ?? [],
    verified: proofBy.get(p.id) ?? { n: 0, clubs: [] },
  }]));
}
