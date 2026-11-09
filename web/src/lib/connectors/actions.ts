"use server";
import { GitHubError, fetchRepo, parseRepo, repoToDraft, type ProjectDraft } from "@/lib/connectors/github";
import { getViewer } from "@/lib/supabase/server";

// "Import from GitHub": a project draft from a public repo. Signed-in members only, so anonymous
// visitors can't spend the GitHub rate limit.
export async function importFromGitHub(url: string): Promise<{ ok: true; draft: ProjectDraft } | { ok: false; message: string }> {
  const { user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to import." };
  const r = parseRepo(url);
  if (!r) return { ok: false, message: "Paste a GitHub repository link, like github.com/owner/repo." };
  try {
    return { ok: true, draft: repoToDraft(await fetchRepo(r.owner, r.repo)) };
  } catch (e) {
    return { ok: false, message: e instanceof GitHubError ? e.message : "Couldn't import that repository." };
  }
}
