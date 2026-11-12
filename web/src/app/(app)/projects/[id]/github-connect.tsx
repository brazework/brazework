import { githubConfig, installationRepos, type Repo } from "@/lib/github-app";
import { linkRepo, unlinkRepo } from "@/lib/github-actions";
import type { SupabaseClient } from "@supabase/supabase-js";

// The owner's GitHub card in the build log (Linear FIX-92, phase 3): connect, pick a repo, or see
// which one is live. Hidden until the GitHub App's variables are set.
// GitHub's mark (lucide no longer ships brand icons).
function Github({ className }: { className?: string }) {
  return <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>;
}
const NOTES: Record<string, string> = {
  denied: "That GitHub installation isn't one your GitHub account can reach. Install it on your own account or ask your org's owner.",
  requested: "Your organization's owner has to approve Brazework on GitHub first. Once they do, connect again.",
  error: "GitHub didn't finish connecting. Try again.",
  expired: "That took a while, so the link expired. Connect again.",
};

export async function GitHubConnect({ supabase, projectId, linked, note }: { supabase: SupabaseClient; projectId: string; linked: { repo_id: number; full_name: string }[]; note?: string }) {
  const c = githubConfig();
  if (!c) return null;
  // A plain link, not next/link: it leaves the site (to GitHub), so there's nothing to prefetch.
  const connect = `/api/github/connect?project=${encodeURIComponent(projectId)}`;
  async function link(form: FormData) { "use server"; await linkRepo(form); }
  async function unlink(form: FormData) { "use server"; await unlinkRepo(form); }
  const message = note && NOTES[note] ? <p role="status" className="mt-2 text-sm text-danger">{NOTES[note]}</p> : null;

  if (linked.length) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {linked.map((r) => (
          <form key={r.repo_id} action={unlink} className="inline-flex items-center gap-2">
            <input type="hidden" name="project" value={projectId} /><input type="hidden" name="repo" value={r.repo_id} />
            <span className="inline-flex items-center gap-1"><Github className="size-3.5" /> {r.full_name} is live in this log</span>
            <button className="underline underline-offset-4 hover:text-text">Disconnect</button>
          </form>
        ))}
      </div>
    );
  }

  // Installations this member connected (RLS shows only their own), and the repos each can reach.
  const { data: insts } = await supabase.from("github_installations").select("installation_id, account_login").is("suspended_at", null).limit(10);
  const groups: { id: number; login: string; repos: Repo[] }[] = [];
  for (const i of (insts ?? []) as { installation_id: number; account_login: string }[]) {
    try { groups.push({ id: i.installation_id, login: i.account_login, repos: await installationRepos(c, i.installation_id) }); } catch { /* uninstalled on GitHub meanwhile */ }
  }
  const repos = groups.flatMap((g) => g.repos.map((r) => ({ ...r, installation: g.id })));

  return (
    <section aria-label="Connect GitHub" className="rounded-xl border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Github className="size-4" /> {repos.length ? "Which repo is this project?" : "Make this log update itself"}</p>
      {repos.length ? (
        <ul className="mt-3 flex flex-col gap-1">
          {repos.slice(0, 30).map((r) => (
            <li key={`${r.installation}-${r.id}`}>
              <form action={link} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-hover">
                <input type="hidden" name="project" value={projectId} /><input type="hidden" name="installation" value={r.installation} /><input type="hidden" name="repo" value={r.id} />
                <span className="min-w-0 truncate text-sm">{r.full_name}{r.private && <span className="ml-1.5 text-xs text-faint">private</span>}</span>
                <button className="inline-flex h-8 shrink-0 items-center rounded-lg border border-line px-3 text-xs font-medium transition hover:bg-hover">Connect</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">Connect the repo and its merged pull requests, releases, CI and deploys show up here as you work. Read-only: Brazework never writes to your code or posts for you.</p>
      )}
      <a href={connect} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-text px-3.5 text-sm font-medium text-surface transition hover:opacity-90"><Github className="size-4" /> {repos.length ? "Add another account or repo on GitHub" : "Connect GitHub"}</a>
      {message}
    </section>
  );
}
