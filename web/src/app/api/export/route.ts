import { mediaUrl } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";

// "Download my data": everything you've put on Forge, as JSON, with links to your files.
// Your own session reads it, so row-level security decides; nothing about other people beyond
// what's part of your own records (for example who you follow).
export async function GET() {
  const { supabase, user } = await getViewer();
  if (!user) return new Response("Log in first.", { status: 401 });
  const me = user.id;
  const q = async (table: string, build: (b: ReturnType<typeof supabase.from>) => PromiseLike<{ data: unknown }>) => ((await build(supabase.from(table))).data ?? []);
  const [profile, posts, comments, projects, milestones, messages, memberships, follows, saved, notifications] = await Promise.all([
    q("profiles", (b) => b.select("*").eq("id", me)),
    q("posts", (b) => b.select("*").eq("author_id", me).order("created_at")),
    q("comments", (b) => b.select("*").eq("author_id", me).order("created_at")),
    q("projects", (b) => b.select("*").eq("owner_id", me).order("created_at")),
    q("milestones", (b) => b.select("*").eq("owner_id", me).order("created_at")),
    q("messages", (b) => b.select("id, conversation_id, body, created_at").eq("sender_id", me).order("created_at")),
    q("community_members", (b) => b.select("community_id, role, joined_at").eq("uid", me)),
    q("follows", (b) => b.select("target, created_at").eq("follower", me)),
    q("saved", (b) => b.select("post_id, saved_at").eq("user_id", me)),
    q("notifications", (b) => b.select("kind, snippet, created_at, read").eq("user_id", me).order("created_at", { ascending: false }).limit(500)),
  ]);
  // Your files: post photos and videos, profile photo and cover.
  const paths = new Set<string>();
  for (const p of posts as { media?: { path?: string }[] }[]) for (const m of p.media ?? []) if (m?.path) paths.add(m.path);
  const prof = (profile as { avatar_path?: string; cover_path?: string }[])[0];
  if (prof?.avatar_path) paths.add(prof.avatar_path);
  if (prof?.cover_path) paths.add(prof.cover_path);
  const body = {
    exported_at: new Date().toISOString(),
    note: "Everything you've put on Forge. Files are linked under files; download them while signed in or before deleting your account.",
    account: { id: me, email: user.email },
    profile: (profile as unknown[])[0] ?? null, posts, comments, projects, milestones, messages_you_sent: messages,
    clubs: memberships, following: follows, saved, notifications,
    files: [...paths].map((path) => ({ path, url: mediaUrl(path) })),
  };
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="forge-export-${day}.json"`, "cache-control": "no-store" },
  });
}
