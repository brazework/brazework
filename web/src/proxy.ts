import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isTemporaryAuthError } from "@/lib/supabase/auth-errors";

const APP_PATHS = ["/feed", "/search", "/onboarding", "/post/", "/communities", "/c/", "/network", "/messages", "/events", "/org", "/notifications", "/saved", "/profile", "/u/", "/analytics", "/dashboard", "/projects", "/settings", "/copilot", "/talent", "/challenges", "/chapters", "/admin"];
const AUTH_PATHS = ["/login", "/signup", "/forgot"];

// Refreshes the Supabase session cookie on every request and does optimistic redirects.
// Layouts re-check on the server, so this is a fast path, not the security boundary.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!env.supabaseUrl || !env.supabaseAnonKey) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Don't put code between createServerClient and getClaims: it can sign people out at random.
  const { data, error } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  // Auth couldn't be checked just now (busy or unreachable): don't redirect either way. The page
  // checks again and, if it still can't, shows "try again" instead of signing anyone out.
  if (!signedIn && isTemporaryAuthError(error)) return response;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = to === "/login" ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  // Emails sent by the original app link to "/?code=…" (and "?flow=reset" for password resets).
  // Send them through the new callback so they still work after the switch-over.
  const code = request.nextUrl.searchParams.get("code");
  if (path === "/" && code) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = `?code=${encodeURIComponent(code)}${request.nextUrl.searchParams.get("flow") === "reset" ? "&next=/reset" : ""}`;
    return NextResponse.redirect(url);
  }
  // Signed in: the home page is your feed.
  if (signedIn && path === "/") return redirect("/feed");
  if (!signedIn && APP_PATHS.some((p) => path.startsWith(p))) return redirect("/login");
  if (signedIn && AUTH_PATHS.some((p) => path.startsWith(p))) return redirect("/feed");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
