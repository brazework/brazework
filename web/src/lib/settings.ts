"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_TOPICS, FIELDS, friendlyError } from "@/lib/forge";
import { parseGradYear } from "@/lib/profile-meta";
import { getViewer } from "@/lib/supabase/server";

// Settings (public/js/views/settings.js). Messaging settings and blocks per supabase/messages.sql.
export type SettingsState = { ok: boolean; message: string };

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Enter your first name.").max(80),
  last_name: z.string().trim().min(1, "Enter your last name.").max(80),
  headline: z.string().trim().max(200),
  field: z.string().refine((f) => FIELDS.includes(f), "Pick your field."),
  interests: z.array(z.string().refine((t) => ALL_TOPICS.includes(t))).min(3, "Keep at least 3 interests.").max(100),
});

export async function saveProfileSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  const parsed = profileSchema.safeParse({
    first_name: form.get("first_name"), last_name: form.get("last_name"), headline: form.get("headline") ?? "",
    // Topics get renamed and retired over time: drop ones that no longer exist instead of failing
    // with "Invalid input", so the member sees the real rule (at least 3 current interests).
    field: form.get("field") ?? "", interests: form.getAll("interests").map(String).filter((t) => ALL_TOPICS.includes(t)),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  // Graduation year: the form only sends it once supabase/grad-year.sql has run.
  const row: Record<string, unknown> = { ...parsed.data };
  if (form.has("grad_year")) {
    const year = parseGradYear(form.get("grad_year"));
    if (!year.ok) return { ok: false, message: "Pick a graduation year from the list." };
    row.grad_year = year.value;
  }
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function saveMessageSettings(requestsOn: boolean, who: "everyone" | "communities" | "connections"): Promise<SettingsState> {
  if (!["everyone", "communities", "connections"].includes(who)) return { ok: false, message: "Choose who can message you." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("save_message_settings", { p_requests_on: requestsOn, p_who: who });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/settings");
  revalidatePath("/messages");
  return { ok: true, message: "Saved." };
}

export async function unblockPerson(otherId: string): Promise<SettingsState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("message_blocks").delete().eq("blocker", user.id).eq("blocked", otherId);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/settings");
  return { ok: true, message: "Unblocked." };
}

export async function changePassword(_: SettingsState, form: FormData): Promise<SettingsState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { ok: false, message: "Choose a password with at least 8 characters." };
  if (password !== confirm) return { ok: false, message: "The two passwords don't match." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: friendlyError(error) };
  return { ok: true, message: "Password changed." };
}

// Delete your account (supabase/account.sql): your files first, then everything you authored.
export async function deleteAccount(confirm: string): Promise<SettingsState> {
  if (confirm !== "DELETE") return { ok: false, message: "Type DELETE to confirm." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  // Your uploads live in your own folder of the media bucket; remove them while you still can.
  const { data: files } = await supabase.storage.from("media").list(user.id, { limit: 1000 });
  if (files?.length) await supabase.storage.from("media").remove(files.map((f) => `${user.id}/${f.name}`));
  const { error } = await supabase.rpc("delete_my_account", { p_confirm: confirm });
  if (error) return { ok: false, message: error.code === "P0001" ? error.message : friendlyError(error) };
  await supabase.auth.signOut();
  return { ok: true, message: "Your account and everything you posted are deleted." };
}

// The weekly email digest (supabase/email-digest.sql).
export async function saveEmailPrefs(weekly: boolean): Promise<SettingsState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("save_email_prefs", { p_weekly: weekly });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/settings");
  return { ok: true, message: weekly ? "You'll get your week by email." : "Weekly emails are off." };
}

// Email alerts, one switch per kind (supabase/email-alerts.sql, Linear FIX-18).
export async function saveEmailAlerts(kinds: { messages: boolean; requests: boolean; comments: boolean }): Promise<SettingsState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("save_email_alerts", { p_messages: !!kinds.messages, p_requests: !!kinds.requests, p_comments: !!kinds.comments });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/settings");
  return { ok: true, message: "Email alerts saved." };
}
