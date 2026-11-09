"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_TOPICS, friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Saving, deleting and commenting (public/js/posts.js). The database fills in names and counts.
type R = { ok: boolean; message: string };
const pid = z.string().min(1).max(64);

function touch(postId?: string) {
  revalidatePath("/feed");
  revalidatePath("/saved");
  if (postId) revalidatePath(`/post/${postId}`);
}

export async function toggleSave(postId: string, save: boolean): Promise<R> {
  if (!pid.safeParse(postId).success) return { ok: false, message: "That post couldn't be found." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = save
    ? await supabase.from("saved").insert({ post_id: postId })
    : await supabase.from("saved").delete().eq("user_id", user.id).eq("post_id", postId);
  if (error && error.code !== "23505") return { ok: false, message: friendlyError(error) };
  touch(postId);
  return { ok: true, message: "" };
}

// The author can change a post's text and topics at any time (supabase/post-edits.sql stamps
// edited_at, so readers see it was edited). Photos and video stay as they were posted.
const editSchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(3000, "Posts can be up to 3,000 characters."),
  tags: z.array(z.string().refine((t) => ALL_TOPICS.includes(t), "Pick topics from the list.")).max(3, "Pick up to 3 topics.").transform((t) => [...new Set(t)]),
});

export async function editPost(postId: string, body: string, tags: string[]): Promise<R> {
  if (!pid.safeParse(postId).success) return { ok: false, message: "That post couldn't be found." };
  const parsed = editSchema.safeParse({ body, tags });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the post." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("posts").update({ body: parsed.data.body, tags: parsed.data.tags }).eq("id", postId).eq("author_id", user.id).select("id");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "You can only edit your own posts." };
  touch(postId);
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "" };
}

// Deleting a post also removes its likes, comments and saves.
export async function deletePost(postId: string): Promise<R> {
  if (!pid.safeParse(postId).success) return { ok: false, message: "That post couldn't be found." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("posts").delete().eq("id", postId).select("id");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "You don't have permission to do that." };
  touch(postId);
  revalidatePath(`/u/${user.id}`);
  return { ok: true, message: "" };
}

export async function addComment(postId: string, body: string): Promise<R> {
  const text = body.trim();
  if (!text) return { ok: false, message: "Write a comment first." };
  if (text.length > 1000) return { ok: false, message: "Comments can be up to 1,000 characters." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("comments").insert({ post_id: postId, body: text });
  if (error) return { ok: false, message: friendlyError(error) };
  touch(postId);
  return { ok: true, message: "" };
}

export async function deleteComment(postId: string, commentId: string): Promise<R> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("comments").delete().eq("id", commentId).select("id");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "You don't have permission to do that." };
  touch(postId);
  return { ok: true, message: "" };
}
