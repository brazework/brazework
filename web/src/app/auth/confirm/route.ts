import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/oauth";
import { createClient } from "@/lib/supabase/server";

// The confirmation email's link (supabase/templates/confirm-signup.html):
// /auth/confirm?token_hash=…&type=email&next=/onboarding. Unlike /auth/callback's ?code= (PKCE, which
// needs the verifier cookie from the browser that signed up), a token hash confirms on any device:
// sign up on a laptop, open the email on a phone, and the phone is signed in and carries on.
const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), type === "recovery" ? "/reset" : "/onboarding");
  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  // Used already, or too old: say so, and how to get a fresh one.
  return NextResponse.redirect(`${origin}/login?${type === "recovery" ? "reset=expired" : "link=expired"}`);
}
