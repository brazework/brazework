"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_TOPICS, friendlyError } from "@/lib/forge";
import { dbFeatures } from "@/lib/db-features";
import { validMedia } from "@/lib/media";
import { keepMentioned, type Mention } from "@/lib/mention-text";
import { getViewer } from "@/lib/supabase/server";

export type ComposeState = { ok: boolean; message: string; nonce: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const postSchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(3000, "Posts can be up to 3,000 characters."),
  kind: z.enum(["update", "question", "result", "project"]),
  tags: z.array(z.string().refine((t) => ALL_TOPICS.includes(t))).max(3, "Pick up to 3 topics."),
});

// Same table and rules as public/js/posts.js. The database fills in author, counts and time.
export async function createPost(prev: ComposeState, form: FormData): Promise<ComposeState> {
  const parsed = postSchema.safeParse({ body: form.get("body"), kind: form.get("kind"), tags: form.getAll("tags") });
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
  const row: Record<string, unknown> = { ...parsed.data };
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
  const { error } = await supabase.from("posts").insert(row);
  if (error) return { ok: false, message: friendlyError(error), nonce: prev.nonce };
  revalidatePath("/feed");
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
  // Re-render the feed in the same response, so the optimistic heart and count don't flick back.
  revalidatePath("/feed");
  return { ok: true, message: "" };
}
