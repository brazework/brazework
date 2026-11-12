import { NextResponse } from "next/server";
import { githubConfig, userInstallations, userToken, verifyState } from "@/lib/github-app";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/supabase/server";

// Back from GitHub after installing Brazework's App (Linear FIX-92, phase 3). GitHub sends the
// installation id and, because the App asks members to sign in on install, a code. The id in the
// URL is only a claim: the member's own GitHub token must list that installation before Brazework
// records it as theirs. Then they pick which repo feeds the project.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { user } = await getViewer();
  if (!user) return NextResponse.redirect(new URL("/login", url));
  const c = githubConfig();
  const db = createAdminClient();
  const state = url.searchParams.get("state");
  const cookie = req.headers.get("cookie")?.match(/(?:^|;\s*)gh_connect=([^;]+)/)?.[1];
  const s = c ? verifyState(c.clientSecret, state) : null;
  // The same browser, the same member, a state we signed in the last 20 minutes.
  if (!c || !db || !s || !cookie || decodeURIComponent(cookie) !== state || s.member !== user.id) {
    return NextResponse.redirect(new URL("/projects?github=expired", url));
  }
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/projects/${encodeURIComponent(s.project)}?github=${result}#log`, url));
    res.cookies.set("gh_connect", "", { path: "/api/github", maxAge: 0 });
    return res;
  };

  const code = url.searchParams.get("code");
  const claimed = Number(url.searchParams.get("installation_id"));
  // An organization's owner has to approve the install first: nothing to link yet.
  if (url.searchParams.get("setup_action") === "request") return back("requested");
  if (!code) return back("error");
  try {
    const { user: gh, installations } = await userInstallations(c, await userToken(c, code));
    const mine = claimed ? installations.filter((i) => i.id === claimed) : installations;
    if (claimed && !mine.length) return back("denied"); // an installation this GitHub user can't reach
    for (const i of mine) {
      // An installation another member connected stays theirs.
      const { data: existing } = await db.from("github_installations").select("installed_by").eq("installation_id", i.id).maybeSingle();
      if (existing?.installed_by && existing.installed_by !== user.id) continue;
      await db.from("github_installations").upsert({ installation_id: i.id, account_login: i.account.login, account_type: i.account.type === "Organization" ? "Organization" : "User", installed_by: user.id, github_user_id: gh.id, suspended_at: null }, { onConflict: "installation_id" });
    }
    return back("pick");
  } catch {
    return back("error");
  }
}
