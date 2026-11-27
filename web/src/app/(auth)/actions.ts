"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { EMAIL_RE, friendlyError } from "@/lib/forge";
import { rememberInvite } from "@/lib/invites";
import { safeNext as safePath } from "@/lib/oauth";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { message: string; sent?: boolean };

// Only same-site paths, so ?next= can't send people to another website.
const safeNext = (v: FormDataEntryValue | null) => safePath(v);

export async function logIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!EMAIL_RE.test(email) || !password) return { message: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { message: friendlyError(error) };
  redirect(safeNext(form.get("next")));
}

// Sign-up asks only for what makes the account: an email and a password (or Google, GitHub or
// LinkedIn). Student or professional, name and birthday come next, in onboarding's "About you", the
// same step for every way in; the database applies the rules there (finish_signup() in
// supabase/oauth-signup.sql: confirmed email and 18 or older). Until then there's no profile.
const signUpSchema = z.object({
  email: z.string().trim().regex(EMAIL_RE, "Enter a valid email address."),
  password: z.string().min(8, "Choose a password with at least 8 characters."),
});

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({ email: form.get("email") ?? "", password: form.get("password") ?? "" });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/onboarding` } });
  if (error) return { message: friendlyError(error) };
  // Supabase doesn't say outright that an address is taken; a user with no identities means it is.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
    return { message: friendlyError({ code: "user_already_exists" }) };
  const invite = String(form.get("invite") ?? "");
  if (invite) await rememberInvite(invite);
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

// The 6-digit code from the confirmation email, typed on /verify: confirms on any device, unlike the
// link's PKCE code, which only works in the browser that signed up.
export async function confirmWithCode(email: string, code: string): Promise<AuthState> {
  const token = code.replace(/\D/g, "");
  if (!EMAIL_RE.test(email)) return { message: "Start over with your email address." };
  if (token.length !== 6) return { message: "Enter the 6 digits from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { message: /expired|invalid/i.test(error.message) ? "That code is wrong or has expired. Check the newest email, or send a new one." : friendlyError(error) };
  redirect("/onboarding");
}

export async function resendConfirmation(email: string): Promise<AuthState> {
  if (!EMAIL_RE.test(email)) return { message: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/onboarding` } });
  return { message: error ? friendlyError(error) : "Sent. Check your inbox (and spam)." };
}

// Log in without a password: Supabase emails a 6-digit code (and a link) to an existing account.
// Never makes an account, and answers the same whether or not one exists, so the form can't be used
// to find out who's a member. The code works on this page on any device; the link, once the
// founders paste supabase/templates/magic-link.html, works on any device too.
export async function sendLoginCode(email: string, next?: string): Promise<AuthState> {
  const address = email.trim();
  if (!EMAIL_RE.test(address)) return { message: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: false, emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(safeNext(next ?? null))}` },
  });
  if (error && /rate limit|security purposes/i.test(error.message)) return { message: "A code was sent a moment ago. Wait a minute, then try again." };
  return { message: "", sent: true };
}

export async function logInWithCode(email: string, code: string, next?: string): Promise<AuthState> {
  const token = code.replace(/\D/g, "");
  if (!EMAIL_RE.test(email.trim())) return { message: "Enter a valid email address." };
  if (token.length !== 6) return { message: "Enter the 6 digits from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
  if (error) return { message: /expired|invalid/i.test(error.message) ? "That code is wrong or has expired. Check the newest email, or send a new code." : friendlyError(error) };
  redirect(safeNext(next ?? null));
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
