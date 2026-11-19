import { NextResponse } from "next/server";
import { buildDraftReminder, type ReminderRow } from "@/lib/draft-triage";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// The daily drafts reminder (supabase/daily-triage.sql): "Your tools noticed N new things". Only for
// members who turned it on, only when a draft arrived since their last one, at most once a (UTC) day.
// Vercel Cron calls this once a day (web/vercel.json) with "Authorization: Bearer $CRON_SECRET". Each
// send is claimed in the database first, so overlapping runs never email anyone twice, and a failed
// send hands the claim back. Without RESEND_API_KEY (or with ?dry=1) it only counts who would get one.
export const maxDuration = 300;

type Row = ReminderRow & { user_id: string; email: string };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Set CRON_SECRET to run the reminders." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY to run the reminders." }, { status: 503 });

  const mail = mailer();
  const dry = !mail.enabled || new URL(req.url).searchParams.get("dry") === "1";
  const counts = { sent: 0, wouldSend: 0, skipped: 0, failed: 0 };
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db.rpc("draft_reminder_recipients", { p_after: after, p_limit: 200 });
    if (error) return NextResponse.json({ error: "Couldn't read the recipients.", ...counts }, { status: 500 });
    const rows = (data ?? []) as Row[];
    if (!rows.length) break;
    for (const r of rows) {
      const email = buildDraftReminder(r, env.siteUrl);
      if (!email) continue;
      if (dry) { counts.wouldSend++; continue; }
      const claim = await db.rpc("claim_draft_reminder", { p_user: r.user_id });
      if (claim.error || claim.data !== true) { counts.skipped++; continue; }
      const res = await mail.send({ to: r.email, ...email });
      if (res.ok) counts.sent++;
      else { counts.failed++; await db.rpc("release_draft_reminder", { p_user: r.user_id }); }
    }
    after = rows[rows.length - 1].user_id;
  }
  return NextResponse.json({ emailOn: mail.enabled, dry, ...counts });
}
