"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ALL_TOPICS, FIELDS, friendlyError } from "@/lib/forge";
import { joinRememberedInvite } from "@/lib/invites";
import { parseGradYear } from "@/lib/profile-meta";
import { getViewer } from "@/lib/supabase/server";

export type OnboardState = { message: string };

const schema = z.object({
  headline: z.string().trim().min(1, "Add your major or profession.").max(200),
  field: z.string().refine((f) => FIELDS.includes(f), "Pick your field."),
  interests: z.array(z.string().refine((t) => ALL_TOPICS.includes(t))).min(3, "Pick at least 3 interests.").max(100),
});

export async function completeOnboarding(_: OnboardState, form: FormData): Promise<OnboardState> {
  const parsed = schema.safeParse({ headline: form.get("headline"), field: form.get("field"), interests: form.getAll("interests") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the form." };
  const row: Record<string, unknown> = { ...parsed.data, onboarded: true };
  // Sent only to students, once supabase/grad-year.sql has run.
  if (form.has("grad_year")) {
    const year = parseGradYear(form.get("grad_year"));
    if (!year.ok) return { message: "Pick a graduation year from the list." };
    row.grad_year = year.value;
  }
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
  if (error) return { message: friendlyError(error) };
  // Came in through a club invite link: land in that club.
  // Otherwise: find your club next (its officers verify your work), before the feed.
  redirect((await joinRememberedInvite()) ?? "/onboarding/club");
}
