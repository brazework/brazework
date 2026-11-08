"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Notifications and analytics (public/js/activity.js, supabase/activity.sql).

export async function markAllNotificationsRead(): Promise<void> {
  const { supabase, user } = await getViewer();
  if (!user) return;
  await supabase.rpc("mark_notifications_read");
}

export async function clearNotification(id: number): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/notifications");
  return { ok: true, message: "" };
}
