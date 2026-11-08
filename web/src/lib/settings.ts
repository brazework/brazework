"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ALL_TOPICS, FIELDS, friendlyError } from "@/lib/forge";
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
    field: form.get("field"), interests: form.getAll("interests"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
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
