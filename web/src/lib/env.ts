// Same variable names Vercel's Supabase integration already sets on the project.
// Literal process.env access so Next.js can inline the public values into the browser bundle.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
