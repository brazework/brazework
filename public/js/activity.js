// Notifications and personal analytics. The database writes notifications and counts profile
// views itself; the app only reads them.
import { sb, run, many } from "./supabase.js";

export const notifications = me => many(sb.from("notifications").select("*")
  .eq("user_id", me).order("created_at", { ascending: false }).limit(100));

export async function unreadNotifications() {
  try { return Number(await run(sb.rpc("unread_notifications"))) || 0; } catch (e) { return 0; }
}
export const markAllRead = () => run(sb.rpc("mark_notifications_read"));
export const clearNotification = id => run(sb.from("notifications").delete().eq("id", id));

// Counts a view of someone else's profile. Never gets in the way of the page.
export function recordView(profileId) {
  sb.rpc("record_profile_view", { p_profile: profileId }).then(() => {}, () => {});
}

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } };
export const analytics = range => run(sb.rpc("my_analytics", { p_range: range, p_tz: tz() }));
