import { friendlyError } from "@/lib/forge";
import { cleanLinkedin } from "@/lib/linkedin";
import type { getViewer } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof getViewer>>["supabase"];

// Does the signed-in member owe a LinkedIn link before they can ask someone to sign
// (supabase/linkedin-required.sql, Linear FIX-214)? True for a working account with none. Any error
// counts as "no": before the database step has run, or if the database is slow, nobody is stopped
// here (the database still holds the rule where the ask is saved).
export async function needsLinkedin(supabase: Db): Promise<boolean> {
  const { data, error } = await supabase.rpc("needs_linkedin");
  return !error && data === true;
}

// A form that asks for a signature can carry the link. Saves it when there is one; returns what to
// tell the member if it isn't a LinkedIn profile, or null when there's nothing wrong.
export async function saveLinkedinFrom(supabase: Db, raw: unknown): Promise<string | null> {
  const link = cleanLinkedin(raw);
  if (!link.ok) return link.message;
  if (!link.url) return null;
  const { error } = await supabase.rpc("set_linkedin", { p_url: link.url });
  return error ? (error.code === "P0001" ? error.message : friendlyError(error)) : null;
}
