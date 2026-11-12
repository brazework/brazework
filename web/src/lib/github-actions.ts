"use server";
import { revalidatePath } from "next/cache";
import { eventsFrom } from "@/lib/github-events";
import { githubConfig, installationRepos, recentHistory } from "@/lib/github-app";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/supabase/server";

// Linking a repo to a project, and unlinking it (Linear FIX-92, phase 3). Everything is checked
// here, on the server, whatever the form said: the member owns the project, the installation is
// theirs (they proved it with GitHub sign-in, api/github/callback) and not suspended, and the repo is
// one that installation can reach. Only then does the service key write.

type Result = { ok: boolean; message: string };

async function ownerOf(projectId: string) {
  const { supabase, user } = await getViewer();
  if (!user || !/^[A-Za-z0-9_-]{1,64}$/.test(projectId)) return null;
  const { data } = await supabase.from("projects").select("owner_id").eq("id", projectId).maybeSingle();
  return data?.owner_id === user.id ? { supabase, user } : null;
}

export async function linkRepo(form: FormData): Promise<Result> {
  const projectId = String(form.get("project") ?? "");
  const installationId = Number(form.get("installation"));
  const repoId = Number(form.get("repo"));
  const c = githubConfig();
  const db = createAdminClient();
  const me = await ownerOf(projectId);
  if (!c || !db) return { ok: false, message: "GitHub isn't switched on yet." };
  if (!me || !Number.isSafeInteger(installationId) || !Number.isSafeInteger(repoId)) return { ok: false, message: "Only the project's owner can connect a repo." };

  // Their installation (RLS: members see only their own), and not paused.
  const { data: inst } = await me.supabase.from("github_installations").select("installation_id, suspended_at").eq("installation_id", installationId).maybeSingle();
  if (!inst || inst.suspended_at) return { ok: false, message: "Connect GitHub again: that installation isn't yours or is paused." };
  const repo = (await installationRepos(c, installationId)).find((r) => r.id === repoId);
  if (!repo) return { ok: false, message: "That repo isn't one you gave Brazework access to." };

  const { error } = await db.from("project_repos").upsert({ project_id: projectId, installation_id: installationId, repo_id: repo.id, full_name: repo.full_name, html_url: repo.html_url, default_branch: repo.default_branch, linked_by: me.user.id }, { onConflict: "project_id,repo_id" });
  if (error) return { ok: false, message: "Couldn't connect the repo. Try again." };

  // The last 90 days, through the same rules as live webhooks; failure here only means an emptier log.
  try {
    const rows = (await recentHistory(c, installationId, repo)).flatMap(({ event, payload }) => eventsFrom(event, payload)).map((d) => ({ ...d, project_id: projectId }));
    if (rows.length) await db.from("build_events").upsert(rows, { onConflict: "project_id,repo_id,source_id", ignoreDuplicates: true });
  } catch { /* the webhook fills it in from here */ }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: `Connected ${repo.full_name}.` };
}

export async function unlinkRepo(form: FormData): Promise<Result> {
  const projectId = String(form.get("project") ?? "");
  const repoId = Number(form.get("repo"));
  const db = createAdminClient();
  const me = await ownerOf(projectId);
  if (!db || !me || !Number.isSafeInteger(repoId)) return { ok: false, message: "Only the project's owner can disconnect a repo." };
  await db.from("project_repos").delete().eq("project_id", projectId).eq("repo_id", repoId);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: "Disconnected. What it already logged stays in the build log." };
}
