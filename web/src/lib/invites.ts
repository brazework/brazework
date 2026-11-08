"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Joining through an invite link (/join/<code>, supabase/invites.sql).
const COOKIE = "forge_invite";
const CODE_RE = /^[0-9a-f]{16}$/;

export async function acceptInvite(code: string): Promise<{ ok: boolean; message: string }> {
  if (!CODE_RE.test(code)) return { ok: false, message: "That invite link isn't valid." };
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  // Not set up yet: remember the invite and finish onboarding first.
  if (!profile?.onboarded) {
    await rememberInvite(code);
    redirect("/onboarding");
  }
  const { data, error } = await supabase.rpc("accept_invite", { p_code: code });
  if (error || !data) return { ok: false, message: error?.code === "P0001" || error?.code === "42501" ? error.message : friendlyError(error) };
  (await cookies()).delete(COOKIE);
  redirect(`/c/${encodeURIComponent(String(data))}?joined=1`);
}

// Kept through sign-up and email confirmation (same browser), used once onboarding is done.
export async function rememberInvite(code: string) {
  if (!CODE_RE.test(code)) return;
  (await cookies()).set(COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 14, path: "/" });
}

// Called after onboarding: joins the remembered club, if any. Returns where to go next.
export async function joinRememberedInvite(): Promise<string | null> {
  const jar = await cookies();
  const code = jar.get(COOKIE)?.value;
  if (!code || !CODE_RE.test(code)) return null;
  jar.delete(COOKIE);
  const { supabase } = await getViewer();
  const { data, error } = await supabase.rpc("accept_invite", { p_code: code });
  return error || !data ? null : `/c/${encodeURIComponent(String(data))}?joined=1`;
}
