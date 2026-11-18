"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ALL_TOPICS, FIELDS, ageFrom, friendlyError } from "@/lib/forge";
import { joinRememberedInvite } from "@/lib/invites";
import { parseGradYear } from "@/lib/profile-meta";
import { getViewer } from "@/lib/supabase/server";

export type OnboardState = { message: string };
export type FinishState = { message: string; school?: boolean };

// Someone who signed up with Google, GitHub or LinkedIn gives what the sign-up form asks for.
// The database applies the same rules as for an email sign-up (finish_signup() in
// supabase/oauth-signup.sql: minimum age, a school email for a student account); this only
// catches the obvious before the round trip.
const finishSchema = z
  .object({
    accountType: z.enum(["student", "professional"], { error: "Choose student or professional." }),
    firstName: z.string().trim().min(1, "Enter your first and last name.").max(80),
    lastName: z.string().trim().min(1, "Enter your first and last name.").max(80),
    birthday: z.string(),
  })
  .superRefine((v, ctx) => {
    const age = ageFrom(v.birthday);
    if (age < 0) ctx.addIssue({ code: "custom", message: "Enter your birthday." });
    else if (age < 18) ctx.addIssue({ code: "custom", message: "You must be at least 18 to create an account." });
  });

export async function finishSignup(_: FinishState, form: FormData): Promise<FinishState> {
  const parsed = finishSchema.safeParse({ accountType: form.get("accountType"), firstName: form.get("firstName") ?? "", lastName: form.get("lastName") ?? "", birthday: form.get("birthday") ?? "" });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login");
  if (profile) redirect("/onboarding");
  const { accountType, firstName, lastName, birthday } = parsed.data;
  const { error } = await supabase.rpc("finish_signup", { p_account_type: accountType, p_first_name: firstName, p_last_name: lastName, p_birthday: birthday });
  if (error) {
    const message = error.code === "P0001" ? error.message : friendlyError(error);
    return { message, school: /university email/.test(message) };
  }
  redirect("/onboarding");
}

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
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login");
  // Signed up with a provider and hasn't finished: that comes first (there's no profile to update).
  if (!profile) redirect("/onboarding");
  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
  if (error) return { message: friendlyError(error) };
  // Came in through a club invite link: land in that club.
  // Otherwise a student finds their club next (its officers verify their work), before the feed.
  // Someone already working may not have one, so they go straight to Today, which starts with their
  // work and a person who saw it (lib/guide-steps.ts). Clubs are still one tap away, under Club.
  redirect((await joinRememberedInvite()) ?? (profile?.account_type === "professional" ? "/feed" : "/onboarding/club"));
}
