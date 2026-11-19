import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildVouchReminder, type Relationship } from "@/lib/vouch-email";

// The one reminder to a signer (supabase/signer-tools.sql): 3 days after an ask that's still open, then
// never again. Each reminder carries its own link to the same single-use ask: the first link's token
// only ever existed in the first email. The send is claimed (with the new link's hash) before emailing,
// so overlapping runs can't both send; a failed send hands the claim back for tomorrow. Vercel Cron
// calls this once a day (web/vercel.json) with "Authorization: Bearer $CRON_SECRET". Without
// RESEND_API_KEY (or with ?dry=1) it only counts who would get one.
export const maxDuration = 300;

type Row = { id: number; email: string; relationship: Relationship; member: string; title: string; project: string; expires_at: string };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Set CRON_SECRET to run the reminders." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY to run the reminders." }, { status: 503 });

  const mail = mailer();
  const dry = !mail.enabled || new URL(req.url).searchParams.get("dry") === "1";
  const { data, error } = await db.rpc("vouch_reminders_due", { p_limit: 500 });
  if (error) return NextResponse.json({ error: "Couldn't read the asks." }, { status: 500 });
  const counts = { sent: 0, wouldSend: 0, skipped: 0, failed: 0 };
  for (const r of (data ?? []) as Row[]) {
    if (dry) { counts.wouldSend++; continue; }
    const token = randomBytes(32).toString("base64url");
    const h = createHash("sha256").update(token).digest("hex");
    const claim = await db.rpc("claim_vouch_reminder", { p_id: r.id, p_reminder_hash: h });
    if (claim.error || claim.data !== true) { counts.skipped++; continue; }
    const res = await mail.send({ to: r.email, ...buildVouchReminder({ member: r.member, title: r.title, project: r.project, relationship: r.relationship, link: `${env.siteUrl}/vouch/${token}`, expiresAt: r.expires_at }) });
    if (res.ok) counts.sent++;
    else { counts.failed++; await db.rpc("release_vouch_reminder", { p_id: r.id, p_reminder_hash: h }); }
  }
  return NextResponse.json({ emailOn: mail.enabled, dry, ...counts });
}
