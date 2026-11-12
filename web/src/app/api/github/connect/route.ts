import { NextResponse } from "next/server";
import { githubConfig, signState } from "@/lib/github-app";
import { getViewer } from "@/lib/supabase/server";

// "Connect GitHub" on a project (Linear FIX-92, phase 3): the owner goes to GitHub to install
// Brazework's App on the repos they choose. The signed state (which project, which member, 20
// minutes) rides along and also sits in an httpOnly cookie, so the callback only accepts the round
// trip this browser started.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get("project") ?? "";
  const { supabase, user } = await getViewer();
  if (!user) return NextResponse.redirect(new URL("/login", url));
  const back = new URL(`/projects/${encodeURIComponent(project)}`, url);
  const c = githubConfig();
  if (!c || !/^[A-Za-z0-9_-]{1,64}$/.test(project)) return NextResponse.redirect(back);
  const { data: p } = await supabase.from("projects").select("owner_id").eq("id", project).maybeSingle();
  if (p?.owner_id !== user.id) return NextResponse.redirect(back);

  const state = signState(c.clientSecret, { project, member: user.id });
  const res = NextResponse.redirect(`${c.web}/apps/${encodeURIComponent(c.slug)}/installations/new?state=${encodeURIComponent(state)}`);
  res.cookies.set("gh_connect", state, { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/api/github", maxAge: 20 * 60 });
  return res;
}
