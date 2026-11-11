"use server";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { hashtagsIn } from "@/lib/hashtags";
import { dbFeatures } from "@/lib/db-features";
import { validMedia } from "@/lib/media";
import { keepMentioned, type Mention } from "@/lib/mention-text";
import { getViewer } from "@/lib/supabase/server";

export type ComposeState = { ok: boolean; message: string; nonce: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const postSchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(3000, "Posts can be up to 3,000 characters."),
  kind: z.enum(["update", "question", "result", "project"]),
});

// Same table and rules as public/js/posts.js. The database fills in author, counts and time.
export async function createPost(prev: ComposeState, form: FormData): Promise<ComposeState> {
  const parsed = postSchema.safeParse({ body: form.get("body"), kind: form.get("kind") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your post.", nonce: prev.nonce };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to post.", nonce: prev.nonce };
  // Photos/video (supabase/media.sql): only when the database has them, and only your own files.
  let media: ReturnType<typeof validMedia> = [];
  const rawMedia = String(form.get("media") ?? "[]");
  if (rawMedia !== "[]") {
    if (!(await dbFeatures()).media) return { ok: false, message: "Photos and video aren't turned on yet.", nonce: prev.nonce };
    try { media = validMedia(JSON.parse(rawMedia), user.id); } catch { media = null; }
    if (!media) return { ok: false, message: "Something's wrong with those attachments. Remove them and try again.", nonce: prev.nonce };
  }
  // Its tags are the #tags written in it (lib/hashtags.ts): what the composer coloured.
  const row: Record<string, unknown> = { ...parsed.data, tags: hashtagsIn(parsed.data.body) };
  if (media && media.length) row.media = media;
  // @mentions (supabase/mentions.sql): the database re-checks each one and notifies them.
  const rawMentions = String(form.get("mentions") ?? "[]");
  if (rawMentions !== "[]" && (await dbFeatures()).mentions) {
    let picked: Mention[] = [];
    try {
      const list: unknown = JSON.parse(rawMentions);
      if (Array.isArray(list)) picked = list.filter((m): m is Mention => typeof m?.id === "string" && UUID.test(m.id) && typeof m?.name === "string" && m.name.length <= 170);
    } catch {}
    const kept = keepMentioned(parsed.data.body, picked);
    if (kept.length) row.mentions = kept;
  }
  // Which project it's about, and which club sees it (project-posts.sql lets one post do both).
  const ID = /^[A-Za-z0-9-]{1,64}$/;
  const projectId = String(form.get("project_id") ?? "");
  const clubId = String(form.get("community_id") ?? "");
  if (projectId) {
    if (!ID.test(projectId)) return { ok: false, message: "Pick one of your projects.", nonce: prev.nonce };
    row.project_id = projectId;
  }
  if (clubId) {
    if (!ID.test(clubId)) return { ok: false, message: "Pick one of your clubs.", nonce: prev.nonce };
    if (projectId && !(await dbFeatures()).projectPosts) return { ok: false, message: "Project updates can't go to a club yet. Post it to your feed, or leave the project out.", nonce: prev.nonce };
    row.community_id = clubId;
  }
  const { error } = await supabase.from("posts").insert(row);
  if (error) return { ok: false, message: friendlyError(error), nonce: prev.nonce };
  // No revalidatePath here: it made this response carry the whole re-rendered feed (news rail
  // included), and the composer only showed "posted" once all of it arrived, so a slow feed made a
  // saved post look stuck (Linear FIX-45). The composer refreshes the page itself once it's saved.
  return { ok: true, message: "", nonce: prev.nonce + 1 };
}

export async function toggleLike(postId: string, like: boolean) {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to like posts." };
  const { error } = like
    ? await supabase.from("likes").insert({ post_id: postId })
    : await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
  // A duplicate like (double click across tabs) is fine.
  if (error && error.code !== "23505") return { ok: false, message: friendlyError(error) };
  // No feed re-render: the card holds your like (lib/card-marks.ts); re-rendering the whole feed for
  // one heart cost ~100 database requests (Linear FIX-77).
  return { ok: true, message: "" };
}
