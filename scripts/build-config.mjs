// Runs on Vercel before each deploy: writes public/js/supabase-config.js from the project's
// environment variables (the Supabase integration on Vercel adds them), so the keys stay out of Git.
import { writeFileSync } from "node:fs";

const env = process.env;
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || "";

if (!url || !anonKey) {
  console.warn("Supabase URL or anon key is missing; the site will show its setup page.");
}

writeFileSync(new URL("../public/js/supabase-config.js", import.meta.url),
  `// Written at build time by scripts/build-config.mjs. Don't edit or commit.\n` +
  `export const supabaseConfig = ${JSON.stringify({ url, anonKey }, null, 2)};\n`);
console.log("Wrote public/js/supabase-config.js");
