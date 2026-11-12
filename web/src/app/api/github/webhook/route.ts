import { NextResponse } from "next/server";
import { eventsFrom, removedRepos, verifySignature } from "@/lib/github-events";
import { createAdminClient } from "@/lib/supabase/admin";

// GitHub calls this for Brazework's GitHub App (infra/github-app.json; Linear FIX-92, phase 3).
// Merged pull requests, releases, CI on the default branch, deploys and pushes to the default branch
// of a linked repo become entries in that project's build log (supabase/github.sql).
//
// Order matters: the signature is checked on the raw body before anything is parsed or written.
// A delivery already handled is a no-op. Writes are idempotent (one build event per thing on GitHub),
// and the delivery is recorded only after they succeed: if storing fails, GitHub's retry does the
// work instead of being mistaken for a duplicate. Only repos linked under the same installation the
// delivery came from are touched.
// Needs GITHUB_APP_WEBHOOK_SECRET and SUPABASE_SERVICE_ROLE_KEY; without them it refuses (503).
export async function POST(req: Request) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  const db = createAdminClient();
  if (!secret || !db) return NextResponse.json({ error: "The GitHub webhook isn't configured." }, { status: 503 });

  const body = await req.text();
  if (!verifySignature(secret, body, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }
  const event = req.headers.get("x-github-event") ?? "";
  const delivery = req.headers.get("x-github-delivery") ?? "";
  let p: Record<string, unknown>;
  try { p = JSON.parse(body); } catch { return NextResponse.json({ error: "Bad JSON." }, { status: 400 }); }
  if (event === "ping") return NextResponse.json({ ok: true, pong: true });
  if (!/^[A-Za-z0-9-]{1,100}$/.test(delivery)) return NextResponse.json({ error: "Missing delivery id." }, { status: 400 });

  const { data: seen } = await db.from("github_deliveries").select("delivery_id").eq("delivery_id", delivery).maybeSingle();
  if (seen) return NextResponse.json({ ok: true, duplicate: true });
  const done = async (result: Record<string, unknown>) => {
    await db.from("github_deliveries").upsert({ delivery_id: delivery, event }, { onConflict: "delivery_id", ignoreDuplicates: true });
    return NextResponse.json({ ok: true, ...result });
  };

  const installationId = (p.installation as { id?: number } | undefined)?.id;

  // The App was removed or paused on an account: its repos stop feeding projects.
  if (event === "installation" && installationId) {
    if (p.action === "deleted") await db.from("github_installations").delete().eq("installation_id", installationId);
    else if (p.action === "suspend") await db.from("github_installations").update({ suspended_at: new Date().toISOString() }).eq("installation_id", installationId);
    else if (p.action === "unsuspend") await db.from("github_installations").update({ suspended_at: null }).eq("installation_id", installationId);
    return done({});
  }
  const removed = removedRepos(event, p);
  if (removed.length && installationId) {
    await db.from("project_repos").delete().eq("installation_id", installationId).in("repo_id", removed);
    return done({ unlinked: removed.length });
  }

  const drafts = eventsFrom(event, p);
  if (!drafts.length || !installationId) return done({ ignored: true });
  const { data: links } = await db.from("project_repos").select("project_id, repo_id").eq("installation_id", installationId).in("repo_id", [...new Set(drafts.map((d) => d.repo_id))]);
  const rows = drafts.flatMap((d) => ((links ?? []) as { project_id: string; repo_id: number }[]).filter((l) => l.repo_id === d.repo_id).map((l) => ({ ...d, project_id: l.project_id })));
  if (!rows.length) return done({ ignored: true });
  const { error } = await db.from("build_events").upsert(rows, { onConflict: "project_id,repo_id,source_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Couldn't record the events." }, { status: 500 }); // not marked done: GitHub retries
  return done({ recorded: rows.length });
}
