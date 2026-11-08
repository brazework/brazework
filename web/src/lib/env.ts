// Same variable names Vercel's Supabase integration already sets on the project.
// Literal process.env access so Next.js can inline the public values into the browser bundle.

// Where email links point back to. An explicit NEXT_PUBLIC_SITE_URL wins; otherwise Vercel's own
// system variables (production domain, then this deployment's URL), so no manual setting is needed.
// Server-only: the VERCEL_* values aren't exposed to the browser (and the browser doesn't need them).
function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: siteUrl(),
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
