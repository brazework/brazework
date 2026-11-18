import { NextResponse, type NextRequest } from "next/server";
import { rememberInvite } from "@/lib/invites";
import { callbackUrl, fromPage, isProvider, safeNext } from "@/lib/oauth";
import { createClient } from "@/lib/supabase/server";

// "Continue with Google / GitHub / LinkedIn": /auth/oauth?provider=google&from=signup&next=/feed.
// Starts Supabase's PKCE flow (the verifier goes in a cookie on this site) and sends the browser to the
// provider. It comes back through /auth/callback. A plain link, not a form, so the site's
// Content-Security-Policy (form-action 'self') has nothing to block and it works without JavaScript.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = fromPage(sp.get("from"));
  const back = (problem: string) => NextResponse.redirect(new URL(`/${from}?oauth=${problem}`, request.nextUrl.origin), { status: 303 });
  const provider = sp.get("provider");
  if (!isProvider(provider)) return back("unavailable");
  // A club invite rides through sign-up the same way it does for the email form.
  const invite = sp.get("invite");
  if (invite) await rememberInvite(invite);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // Back to the site the person is on, so the verifier cookie is there to finish with.
      redirectTo: callbackUrl(request.nextUrl.origin, safeNext(sp.get("next")), from),
      skipBrowserRedirect: true,
      // Google: always let people pick which account (a personal and a school account are common).
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data?.url) return back("unavailable");
  return NextResponse.redirect(data.url, { status: 303 });
}
