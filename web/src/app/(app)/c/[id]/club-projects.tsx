import { FolderGit2 } from "lucide-react";
import { EmptyState } from "@/components/app/page-ui";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { ProjectEditor, ProjectGrid, type ProjectView } from "../../u/[id]/profile-client";

// The club's own projects (Linear FIX-264, supabase/club-projects.sql). Every owner and admin of the
// club starts and runs them; their teammates build on them like on a personal project. A private one
// shows its card only, like on a profile. Nothing shows to a member until there's one.
export async function ClubProjects({ cid, name, lead, interests }: { cid: string; name: string; lead: boolean; interests: string[] }) {
  const f = await dbFeatures();
  if (!f.clubProjects) return null;
  const { supabase } = await getViewer();
  const { data } = await supabase.from("projects").select(`id, title, summary, status, year, tags, private, updated_at${f.projectTools ? ", tools" : ""}`)
    .eq("community_id", cid).order("created_at", { ascending: false }).limit(60);
  const rows = (data ?? []) as unknown as Omit<ProjectView, "details" | "link">[];
  if (!rows.length && !lead) return null;
  // The write-up and link, where this viewer may read them (row-level security hides a private one's).
  const { data: det } = rows.length
    ? await supabase.from("project_details").select("project_id, details, link").in("project_id", rows.map((r) => r.id))
    : { data: [] };
  const details = new Map(((det ?? []) as { project_id: string; details: string; link: string }[]).map((d) => [d.project_id, d]));
  const projects: ProjectView[] = rows.map((r) => ({ ...r, details: details.get(r.id)?.details ?? null, link: details.get(r.id)?.link ?? null }));

  return (
    <section id="projects" aria-label="Club projects" className="mt-6 scroll-mt-24">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
        {lead && <ProjectEditor interests={interests} stack={f.projectTools} specsOn={false} club={{ id: cid, name }} />}
      </div>
      {projects.length > 0
        ? <ProjectGrid projects={projects} own={lead} interests={interests} stack={f.projectTools} />
        : <EmptyState icon={<FolderGit2 className="size-6" />} title="No club projects yet" body="Start one for the club, then add the members building it from the project page. Their work shows on their profiles too." />}
    </section>
  );
}
