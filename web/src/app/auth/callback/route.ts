import { NextResponse, type NextRequest } from "next/server";
import { fromPage, oauthProblem, safeNext } from "@/lib/oauth";
import { createClient } from "@/lib/supabase/server";

// Links in Supabase's emails, and sign-ins with Google, GitHub or LinkedIn (?flow=oauth, from
// /auth/oauth), land here with ?code= (PKCE). Swap it for a session, then go on to ?next= (same-site
// paths only, e.g. /reset after a password reset email) or the feed. Someone new from a provider has
// no profile yet, so the app sends them to onboarding to finish signing up (app/onboarding/page.tsx).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const oauth = searchParams.get("flow") === "oauth";
  const changingEmail = searchParams.get("flow") === "email-change";
  const from = fromPage(searchParams.get("from"));
  // The provider or Supabase said no (cancelled, unverified email, ...): say so where they started.
  // (Email links that fail keep their own handling below.)
  const problem = oauth ? oauthProblem(searchParams) : null;
  if (problem) return NextResponse.redirect(`${origin}/${from}?oauth=${problem}`);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  // Opened in a different browser than the one that asked: the link can't sign them in here.
  if (oauth) return NextResponse.redirect(`${origin}/${from}?oauth=expired`);
  if (changingEmail) return NextResponse.redirect(`${origin}/settings#school-email`);
  return NextResponse.redirect(`${origin}/login?${next === "/reset" ? "reset=expired" : "confirmed=1"}`);
}
