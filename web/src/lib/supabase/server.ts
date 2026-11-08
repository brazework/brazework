import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Profile } from "@/lib/forge";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Row-level security in supabase/*.sql is still what protects the data.
export async function createClient() {
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
export async function getViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null, profile: null } as const;
  // Photo and cover paths exist once supabase/media.sql has run; before that, ask without them.
  const base = "id, first_name, last_name, account_type, headline, bio, field, interests, onboarded, created_at";
  let res = await supabase.from("profiles").select(`${base}, avatar_path, cover_path`).eq("id", claims.sub).maybeSingle();
  if (res.error?.code === "42703") res = await supabase.from("profiles").select(base).eq("id", claims.sub).maybeSingle();
  const profile = res.data as Profile | null;
  // "Confirm email" is on in Supabase, so a session only exists once the email is confirmed.
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? "" };
  return { supabase, user, profile } as const;
}
