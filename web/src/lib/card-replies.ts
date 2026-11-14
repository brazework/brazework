import type { ReplyPreview } from "@/app/(app)/feed/post-card";
import { dbFeatures } from "@/lib/db-features";
import type { createClient } from "@/lib/supabase/server";

type Sb = Awaited<ReturnType<typeof createClient>>;

// The latest comments under each post card (two per post, oldest of them first), with what a card
// needs to like, reply to, edit and delete them: thread, edit and like fields once step 53 has run,
// and whether you liked each. The feed gets the same from feed_page(); every other page with post
// cards (a club, a profile, Saved, a project's build log) uses this, so comments work the same
// everywhere. One query for the comments and one for your likes, whatever the number of posts.
export async function cardReplies(supabase: Sb, me: string, postIds: string[]): Promise<Map<string, ReplyPreview[]>> {
  const out = new Map<string, ReplyPreview[]>();
  if (!postIds.length) return out;
  const threads = (await dbFeatures()).commentThreads;
  const { data } = await supabase
    .from("comments")
    .select(threads ? "id, post_id, author_id, author_first, author_last, body, created_at, parent_id, edited_at, like_count" : "id, post_id, author_id, author_first, author_last, body, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: false })
    .limit(Math.min(400, postIds.length * 20));
  for (const c of (data ?? []) as unknown as (ReplyPreview & { post_id: string })[]) {
    const list = out.get(c.post_id) ?? [];
    if (list.length < 2) out.set(c.post_id, [c, ...list]);
  }
  if (threads) {
    const shown = [...out.values()].flat().map((c) => c.id);
    const { data: mine } = shown.length ? await supabase.from("comment_likes").select("comment_id").eq("user_id", me).in("comment_id", shown) : { data: [] };
    const liked = new Set(((mine ?? []) as { comment_id: string }[]).map((l) => l.comment_id));
    for (const list of out.values()) for (const c of list) c.liked = liked.has(c.id);
  }
  return out;
}
