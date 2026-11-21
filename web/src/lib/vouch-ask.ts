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
