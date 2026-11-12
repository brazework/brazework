import { NextResponse } from "next/server";
import { buildAlert, type AlertItems } from "@/lib/alerts";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Email alerts (Linear FIX-18): new messages, connection requests and comments on your posts, batched.
// Vercel Cron calls this every hour (web/vercel.json) with "Authorization: Bearer $CRON_SECRET". Each
// member gets at most one email a run, covering what arrived since their last one and is still unread
// 10 minutes later (so anyone using the app sees it there first). Each send is claimed in the database
// first, so a run that overlaps another never emails anyone twice. Without RESEND_API_KEY (or with
// ?dry=1) it only counts who would get one and claims nothing.
export const maxDuration = 300;
const GRACE_MS = 10 * 60 * 1000;

type Row = { user_id: string; email: string; first_name: string; since: string } & AlertItems;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Set CRON_SECRET to run the alerts." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY to run the alerts." }, { status: 503 });

  const mail = mailer();
  const url = new URL(req.url);
  const dry = !mail.enabled || url.searchParams.get("dry") === "1";
  // ?grace=0 lets the local tests count something sent a moment ago; production always waits.
  const grace = url.searchParams.get("grace") === "0" && process.env.NODE_ENV !== "production" ? 0 : GRACE_MS;
  const until = new Date(Date.now() - grace).toISOString();

  const counts = { sent: 0, wouldSend: 0, skipped: 0, failed: 0 };
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db.rpc("email_alert_recipients", { p_until: until, p_after: after, p_limit: 200 });
    if (error) return NextResponse.json({ error: "Couldn't read the recipients.", ...counts }, { status: 500 });
    const rows = (data ?? []) as Row[];
    if (!rows.length) break;
    for (const r of rows) {
      const email = buildAlert(r.first_name, r, env.siteUrl);
      if (!email) continue;
      if (dry) { counts.wouldSend++; continue; }
      const claim = await db.rpc("claim_email_alert", { p_user: r.user_id, p_since: r.since, p_until: until });
      if (claim.error || claim.data !== true) { counts.skipped++; continue; }
      const res = await mail.send({ to: r.email, ...email });
      if (res.ok) counts.sent++;
      else { counts.failed++; await db.rpc("release_email_alert", { p_user: r.user_id, p_since: r.since, p_until: until }); }
    }
    after = rows[rows.length - 1].user_id;
  }
  return NextResponse.json({ emailOn: mail.enabled, dry, until, ...counts });
}
