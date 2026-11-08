import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Links in Supabase's emails land here with ?code= (PKCE). Swap it for a session, then go on to
// ?next= (same-site paths only, e.g. /reset after a password reset email) or the feed.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "";
  const next = /^\/(?!\/)/.test(nextParam) ? nextParam : "/feed";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  // Opened in a different browser than the one that asked: the link can't sign them in here.
  return NextResponse.redirect(`${origin}/login?${next === "/reset" ? "reset=expired" : "confirmed=1"}`);
}
