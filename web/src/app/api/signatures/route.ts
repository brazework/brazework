import { LINKEDIN_ADD_HERE } from "@/lib/linkedin";
import { needsLinkedin, saveLinkedinFrom } from "@/lib/linkedin-gate";
import { signatureRequest } from "@/lib/signature-request";
import { friendlyError } from "@/lib/forge";
import { viewerFromToken } from "@/lib/supabase/server";
import { askToVouch } from "@/lib/vouch-ask";

// POST /api/signatures: the iPhone app asks a person who saw the work to sign a milestone, as the
// web's Add milestone → "A person who saw it" does (lib/milestones.ts addMilestone, lib/vouches.ts).
// Only the app's sign-in ("Authorization: Bearer <Supabase access token>"), never a browser cookie,
// so no other site can make a signed-in browser send asks. The member never sees the signer's link:
// it's made and mailed here (lib/vouch-ask.ts). Replies are JSON { ok, message, linkedin? }: 200 asked,
// 400 bad input, 401 signed out, 409 needs a LinkedIn link first, 422 the database said no.
const json = (status: number, body: { ok: boolean; message: string; linkedin?: boolean; milestone_id?: string }) => Response.json(body, { status });
const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" || e.code === "23514" ? e.message ?? friendlyError(e) : friendlyError(e));

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return json(401, { ok: false, message: "Log in again to ask someone to sign." });
  const viewer = await viewerFromToken(token);
  if (!viewer?.user) return json(401, { ok: false, message: "Log in again to ask someone to sign." });
  const parsed = signatureRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." });
  const r = parsed.data;
  const { supabase, user } = viewer;

  // A working account adds its LinkedIn link before asking (the database holds the rule too).
  const bad = await saveLinkedinFrom(supabase, r.linkedin);
  if (bad) return json(409, { ok: false, message: bad, linkedin: true });
  if (await needsLinkedin(supabase)) return json(409, { ok: false, message: LINKEDIN_ADD_HERE, linkedin: true });

  // A new milestone is made first, with no club: the same row as the web's form.
  let id = r.milestone_id ?? "";
  if (r.milestone) {
    const m = r.milestone;
    const row: Record<string, unknown> = { project_id: m.project_id, community_id: null, title: m.title, detail: m.detail, evidence: m.evidence, achieved_on: m.achieved_on };
    if (m.show_on_profile) row.private = false;
    const { data: made, error } = await supabase.from("milestones").insert(row).select("id").single();
    if (error || !made) return json(422, { ok: false, message: error?.code === "42501" ? "You can only add milestones to your own projects." : reason(error ?? {}) });
    id = made.id;
  }

  const asked = await askToVouch(viewer, id, r.email, r.relationship);
  if (!asked.ok) {
    // No ask went out: don't leave a new milestone waiting on nobody.
    if (r.milestone) await supabase.from("milestones").delete().eq("id", id).eq("owner_id", user.id);
    return json(422, asked);
  }
  return json(200, { ...asked, milestone_id: id });
}
