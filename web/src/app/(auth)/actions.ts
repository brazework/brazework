"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { ACADEMIC_RE, EMAIL_RE, ageFrom, friendlyError } from "@/lib/forge";
import { rememberInvite } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { message: string; sent?: boolean };

// Only same-site paths, so ?next= can't send people to another website.
const safeNext = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\/(?!\/)/.test(v) ? v : "/feed");

export async function logIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!EMAIL_RE.test(email) || !password) return { message: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { message: friendlyError(error) };
  redirect(safeNext(form.get("next")));
}

const signUpSchema = z
  .object({
    accountType: z.enum(["student", "professional"], { error: "Choose student or professional." }),
    firstName: z.string().trim().min(1, "Enter your first and last name.").max(80),
    lastName: z.string().trim().min(1, "Enter your first and last name.").max(80),
    birthday: z.string(),
    email: z.string().trim().regex(EMAIL_RE, "Enter a valid email address."),
    password: z.string().min(8, "Choose a password with at least 8 characters."),
  })
  .superRefine((v, ctx) => {
    const age = ageFrom(v.birthday);
    if (age < 0) ctx.addIssue({ code: "custom", message: "Enter your birthday." });
    else if (age < 18) ctx.addIssue({ code: "custom", message: "You must be at least 18 to create an account." });
    if (v.accountType === "student" && !ACADEMIC_RE.test(v.email))
      ctx.addIssue({ code: "custom", message: "Use your university email (for example, ending in .edu or .ac.uk)." });
  });

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { email, password, firstName, lastName, birthday, accountType } = parsed.data;

  const supabase = await createClient();
  // The database's handle_new_user trigger makes the profile from this metadata.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { firstName, lastName, birthday, accountType }, emailRedirectTo: `${env.siteUrl}/auth/callback` },
  });
  if (error) return { message: friendlyError(error) };
  // Supabase doesn't say outright that an address is taken; a user with no identities means it is.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
    return { message: friendlyError({ code: "user_already_exists" }) };
  const invite = String(form.get("invite") ?? "");
  if (invite) await rememberInvite(invite);
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

export async function resendConfirmation(email: string): Promise<AuthState> {
  if (!EMAIL_RE.test(email)) return { message: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${env.siteUrl}/auth/callback` } });
  return { message: error ? friendlyError(error) : "Sent. Check your inbox (and spam)." };
}

// Always the same answer, so the form can't be used to find out who has an account.
export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { message: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.siteUrl}/auth/callback?next=/reset` });
  if (error && /rate limit/i.test(error.message)) return { message: friendlyError(error) };
  return { message: "", sent: true };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { message: "Choose a password with at least 8 characters." };
  if (password !== confirm) return { message: "The two passwords don't match." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { message: "This reset link has expired. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: friendlyError(error) };
  redirect("/feed");
}
