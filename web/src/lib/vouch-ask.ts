import { createHash, randomBytes } from "node:crypto";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { friendlyError } from "@/lib/forge";
import { createAdminClient } from "@/lib/supabase/admin";
import type { getViewer } from "@/lib/supabase/server";
import { buildVouchEmail, type Relationship } from "@/lib/vouch-email";

// Asking a person who saw the work to sign one of the member's milestones (supabase/vouches.sql):
// make the link, keep only its sha256 in the database, email the link, and close the ask if the email
// never went out. Shared by the web's requestVouch (lib/vouches.ts, signed in by cookie) and the
// iPhone app's /api/signatures (signed in by its access token). The raw token exists only here and in
// the email: the member never sees the link (they could sign their own work with it).

export type VouchState = { ok: boolean; message: string };
type Viewer = Pick<Awaited<ReturnType<typeof getViewer>>, "supabase" | "user">;

const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" ? e.message ?? friendlyError(e) : friendlyError(e));
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function askToVouch({ supabase, user }: Viewer, milestoneId: string, email: string, relationship: Relationship): Promise<VouchState> {
  if (!user) return { ok: false, message: "Log in again." };
  const mail = mailer();
  if (!mail.enabled) return { ok: false, message: "Email isn't available right now, so we can't send the ask. Try again later." };

  const token = randomBytes(32).toString("base64url");
  const { data: id, error } = await supabase.rpc("request_vouch", { p_milestone: milestoneId, p_email: email, p_relationship: relationship, p_token_hash: hash(token) });
  if (error) return { ok: false, message: error.code === "42501" ? "You can only ask about your own milestones." : reason(error) };

  const [{ data: me }, { data: m }] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase.from("milestones").select("title, project_id").eq("id", milestoneId).maybeSingle(),
  ]);
  const { data: project } = m ? await supabase.from("projects").select("title").eq("id", m.project_id).maybeSingle() : { data: null };
  const sent = await mail.send({
    to: email,
    ...buildVouchEmail({
      member: `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim(), title: m?.title ?? "A milestone", project: project?.title ?? "",
      relationship, link: `${env.siteUrl}/vouch/${token}`,
    }),
  });
  if (!sent.ok) {
    // Nobody can answer an ask whose email never went out: close it so it doesn't hold a slot.
    await createAdminClient()?.from("milestone_vouches").update({ state: "withdrawn" }).eq("id", id);
    return { ok: false, message: "We couldn't send the email. Check the address and try again." };
  }
  return { ok: true, message: `Asked. We emailed ${email}; you'll be notified when they answer.` };
}

// A project sign-off (Linear FIX-227): several results on one project, one person, ONE email. Each
// result gets its own ask (and its own token) exactly as above, so every rule holds per result; the
// email carries the first link, and the signer's page lists the others to the same address
// (supabase/signer-tools.sql), where they answer each one. They only sign what they saw.
export async function askProjectSignoff({ supabase, user }: Viewer, projectId: string, milestoneIds: string[], email: string, relationship: Relationship): Promise<VouchState & { asked?: number }> {
  if (!user) return { ok: false, message: "Log in again." };
  const ids = [...new Set(milestoneIds)].slice(0, 5);
  if (ids.length < 2) return { ok: false, message: "Pick at least two results for a sign-off, or ask about one on its own." };
  const mail = mailer();
  if (!mail.enabled) return { ok: false, message: "Email isn't available right now, so we can't send the ask. Try again later." };
  const [{ data: me }, { data: project }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("title").eq("id", projectId).eq("owner_id", user.id).maybeSingle(),
    supabase.from("milestones").select("id, title").eq("project_id", projectId).eq("owner_id", user.id).in("id", ids),
  ]);
  if (!project) return { ok: false, message: "Only the project's owner can ask for a sign-off." };
  const titles = new Map(((rows ?? []) as { id: string; title: string }[]).map((r) => [r.id, r.title]));
  const made: { id: string; token: string; title: string }[] = [];
  for (const id of ids) {
    if (!titles.has(id)) continue;
    const token = randomBytes(32).toString("base64url");
    const { data: vid, error } = await supabase.rpc("request_vouch", { p_milestone: id, p_email: email, p_relationship: relationship, p_token_hash: hash(token) });
    if (error) {
      // Nothing half-sent: withdraw what was made, then say why.
      if (made.length) await createAdminClient()?.from("milestone_vouches").update({ state: "withdrawn" }).in("id", made.map((m) => m.id));
      return { ok: false, message: error.code === "42501" ? "You can only ask about your own milestones." : reason(error) };
    }
    made.push({ id: String(vid), token, title: titles.get(id)! });
  }
  if (made.length < 2) return { ok: false, message: "Pick at least two of your own results on this project." };
  const sent = await mail.send({
    to: email,
    ...buildVouchEmail({
      member: `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim(),
      title: `${made[0].title}" and ${made.length - 1} more result${made.length - 1 === 1 ? "" : "s"} on "${project.title}`,
      project: "", relationship, link: `${env.siteUrl}/vouch/${made[0].token}`,
    }),
  });
  if (!sent.ok) {
    await createAdminClient()?.from("milestone_vouches").update({ state: "withdrawn" }).in("id", made.map((m) => m.id));
    return { ok: false, message: "We couldn't send the email. Check the address and try again." };
  }
  return { ok: true, asked: made.length, message: `Asked. We emailed ${email} once about ${made.length} results; they sign each one they saw.` };
}

