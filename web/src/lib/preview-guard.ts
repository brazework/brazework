// Previews never run against production's database (Linear FIX-83). A Vercel preview deployment
// builds every pull request, tested or not; if its Supabase URL is production's, untested code can
// read and write real members' records. next.config.ts calls this at build time and stops the build
// with this message. Production builds, CI and the local stack are unaffected: only VERCEL_ENV
// "preview" is checked. The server's admin client uses the same URL, so this covers it too.

/** Production's Supabase project ref (the same one db-migrate.yml and infra/check.mjs use). */
export const PRODUCTION_SUPABASE_REF = "uwiwkjoonculpxjmzsfj";

type Env = { VERCEL_ENV?: string; NEXT_PUBLIC_SUPABASE_URL?: string; [name: string]: string | undefined };

const onProduction = (env: Env) => (env.NEXT_PUBLIC_SUPABASE_URL ?? "").toLowerCase().includes(PRODUCTION_SUPABASE_REF);

/** Why this build must stop, or null when it may go ahead. */
export function previewGuard(env: Env): string | null {
  if (env.VERCEL_ENV !== "preview" || !onProduction(env)) return null;
  return [
    `This is a preview deployment, and NEXT_PUBLIC_SUPABASE_URL points at production's database (${PRODUCTION_SUPABASE_REF}).`,
    "Previews must use their own database, so untested code never touches members' records (Linear FIX-83).",
    "In Vercel → forge-app → Settings → Environment Variables, give the Preview environment a non-production",
    "Supabase URL and keys (or remove them), then redeploy.",
  ].join(" ");
}

/**
 * The same rule on a laptop: `next dev` runs untested code too, so it never starts against
 * production's database. `npm run dev` (scripts/dev.sh) points it at the local one; a bare
 * `next dev` with production's values in web/.env.local stops here and says so.
 */
export function devGuard(env: Env): string | null {
  if (env.NODE_ENV !== "development" || !onProduction(env)) return null;
  return [
    `The dev server is pointed at production's database (${PRODUCTION_SUPABASE_REF}), probably from web/.env.local.`,
    "Run `npm run dev` instead: it starts a private local database with test members and uses that.",
  ].join(" ");
}
