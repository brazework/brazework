"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// One-to-one messages (public/js/messages.js, supabase/messages.sql). The database decides a
// conversation's status, keeps the preview and unread markers, and enforces who can write.
type R = { ok: boolean; message: string };
const cidSchema = z.string().min(1).max(64);

const touch = (cid?: string) => {
  revalidatePath("/messages");
  if (cid) revalidatePath(`/messages/${cid}`);
};

export async function sendMessage(cid: string, body: string): Promise<R> {
  const text = body.trim();
  if (!cidSchema.safeParse(cid).success) return { ok: false, message: "That conversation couldn't be found." };
  if (!text) return { ok: false, message: "Write a message first." };
  if (text.length > 2000) return { ok: false, message: "Messages can be up to 2,000 characters." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("messages").insert({ conversation_id: cid, body: text });
  if (error) return { ok: false, message: /request|accept/i.test(error.message) ? "You can send one message until they accept your request." : friendlyError(error) };
  touch(cid);
  return { ok: true, message: "" };
}

export async function acceptConversation(cid: string): Promise<R> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("accept_conversation", { p_cid: cid });
  if (error) return { ok: false, message: friendlyError(error) };
  touch(cid);
  return { ok: true, message: "" };
}

export async function declineConversation(cid: string): Promise<void> {
  const { supabase, user } = await getViewer();
  if (!user) return;
  await supabase.from("conversations").delete().eq("id", cid);
  touch();
  redirect("/messages");
}

// Blocks the sender and files a report with a copy of the messages.
export async function blockAndReport(cid: string): Promise<R> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("block_and_report", { p_cid: cid });
  if (error) return { ok: false, message: friendlyError(error) };
  touch();
  redirect("/messages");
}

export async function markConversationRead(cid: string): Promise<void> {
  const { supabase, user } = await getViewer();
  if (!user) return;
  await supabase.rpc("mark_conversation_read", { p_cid: cid });
}
