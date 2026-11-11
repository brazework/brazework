import type { SupabaseClient } from "@supabase/supabase-js";
import { dbFeatures } from "@/lib/db-features";
import type { MediaItem } from "@/lib/media";
import { schematicFor } from "@/lib/schematic-field";

// "Your builds" on Home: your projects, newest activity first, each with how many milestones its
// club verified and a cover (the newest photo from its updates, or the drawing for its field).
export type Build = { id: string; title: string; status: "in_progress" | "completed"; updated_at: string; private: boolean; verified: number; cover: string | null; field: string };

export async function loadBuilds(supabase: SupabaseClient, me: string): Promise<Build[]> {
  const f = await dbFeatures();
  const { data } = await supabase.from("projects").select(`id, title, status, updated_at, private, tags${f.projectTools ? ", tools" : ""}`).eq("owner_id", me).order("updated_at", { ascending: false }).limit(8);
  const projects = (data ?? []) as unknown as { id: string; title: string; status: "in_progress" | "completed"; updated_at: string; private: boolean; tags: string[]; tools?: string[] }[];
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const [ms, posts] = await Promise.all([
    f.milestones ? supabase.from("milestones").select("project_id").eq("owner_id", me).eq("status", "verified").in("project_id", ids).limit(500) : Promise.resolve({ data: [] }),
    f.media ? supabase.from("posts").select("project_id, media").eq("author_id", me).in("project_id", ids).order("created_at", { ascending: false }).limit(80) : Promise.resolve({ data: [] }),
  ]);
  const verified = new Map<string, number>();
  for (const m of (ms.data ?? []) as { project_id: string }[]) verified.set(m.project_id, (verified.get(m.project_id) ?? 0) + 1);
  const cover = new Map<string, string>();
  for (const x of (posts.data ?? []) as { project_id: string; media: MediaItem[] | null }[]) {
    const img = (x.media ?? []).find((m) => m.type === "image");
    if (img && !cover.has(x.project_id)) cover.set(x.project_id, img.path);
  }
  return projects.map((p) => ({ id: p.id, title: p.title, status: p.status, updated_at: p.updated_at, private: p.private, verified: verified.get(p.id) ?? 0, cover: cover.get(p.id) ?? null, field: schematicFor(p.tags ?? [], p.tools ?? []) }));
}
