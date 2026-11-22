// A working account's LinkedIn profile link (supabase/linkedin-required.sql, Linear FIX-214). The
// rule: a professional adds it before asking a person to sign their work. Signing up doesn't need it
// (the form offers it), and students are never asked. The database cleans and checks the link
// (linkedin_clean()) and holds the rule, on the table the asks are saved in; this is the same shape
// check, to catch a typo before the round trip. Signed-in members see it on the profile unless its
// owner turns off "Show it on my profile" (supabase/linkedin-public.sql); it never shows on a public record. Plain functions, no server
// imports, so forms and tests can use them.
export const LINKEDIN_PLACEHOLDER = "linkedin.com/in/yourname";
// The database's own message when an ask is refused (vouch_needs_linkedin()), for routes with no form.
export const LINKEDIN_TO_ASK = "Add your LinkedIn profile link before you ask someone to sign. It's in Settings, under Profile.";
// Said where there is a form to add it in.
export const LINKEDIN_ADD_HERE = "Add your LinkedIn profile link to ask someone to sign.";
export const LINKEDIN_WHY = "Optional.";
export const LINKEDIN_BAD = "Enter your LinkedIn profile link, like linkedin.com/in/yourname.";
// Shown on the profile by default (supabase/linkedin-public.sql); the member can hide it in Settings.
export const LINKEDIN_PRIVATE = "Shown on your profile to signed-in members. You can hide it in Settings. It's never on your public record.";

const PROFILE = /^(?:https?:\/\/)?(?:[a-z]{1,3}\.)?linkedin\.com\/in\/([a-z0-9_%-]{3,100})\/?(?:[?#].*)?$/i;

export type CleanLinkedin = { ok: true; url: string | null } | { ok: false; message: string };

// What people paste (a country subdomain, a trailing slash, tracking after "?") becomes
// https://www.linkedin.com/in/<name>. Empty is "none"; anything else that isn't a personal profile
// on linkedin.com is refused.
export function cleanLinkedin(input: unknown): CleanLinkedin {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s) return { ok: true, url: null };
  const m = PROFILE.exec(s);
  return m ? { ok: true, url: `https://www.linkedin.com/in/${m[1]}` } : { ok: false, message: LINKEDIN_BAD };
}
