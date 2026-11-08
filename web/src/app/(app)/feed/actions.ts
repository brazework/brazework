"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_TOPICS, friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

export type ComposeState = { ok: boolean; message: string; nonce: number };

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
  const { error } = await supabase.from("posts").insert(parsed.data);
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
