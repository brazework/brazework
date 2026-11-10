import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/forge";
import { isTemporaryAuthError } from "@/lib/supabase/auth-errors";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Row-level security in supabase/*.sql is still what protects the data.
export async function createClient() {
  // Data is per request: a background prefetch stops here (so prefetches don't run the page's
  // queries), and auth-js may read the clock once it's created, which prerendering doesn't allow.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

// The signed-in person and their profile, or nulls. Uses getClaims(), which verifies the JWT.
// Remembered for one render (React cache): the layout, the page and its parts all ask, and each
// ask used to cost a session check plus a profile read. Server actions aren't renders, so a save
// always sees the latest.
export const getViewer = cache(viewer);
async function viewer() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    // Signed out is "no user"; a busy or unreachable auth server is an error page with "try again",
    // never a redirect to /login (that signed members out whenever Auth was slow).
    if (isTemporaryAuthError(error)) throw new Error("We couldn't check your sign-in just now. Try again in a moment.");
    return { supabase, user: null, profile: null } as const;
  }
  // Photo and cover paths exist once supabase/media.sql has run; before that, ask without them.
  const base = "id, first_name, last_name, account_type, headline, bio, field, interests, onboarded, created_at";
  let res = await supabase.from("profiles").select(`${base}, avatar_path, cover_path`).eq("id", claims.sub).maybeSingle();
  if (res.error?.code === "42703") res = await supabase.from("profiles").select(base).eq("id", claims.sub).maybeSingle();
  const profile = res.data as Profile | null;
  // "Confirm email" is on in Supabase, so a session only exists once the email is confirmed.
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? "" };
  return { supabase, user, profile } as const;
}
