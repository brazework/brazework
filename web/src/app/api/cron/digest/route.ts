import { NextResponse } from "next/server";
import { buildDigest } from "@/lib/digest";
import { mailer } from "@/lib/email";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWeekFor } from "@/lib/week-load";

// The weekly email digest. Run it once a week (Vercel Cron sends "Authorization: Bearer $CRON_SECRET").
// Each member gets "Your week" by email, unless it's empty or they turned it off; a member is never
// emailed twice in a week. Without RESEND_API_KEY it only counts who would get one (?dry=1 does too).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Set CRON_SECRET to run the digest." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY to run the digest." }, { status: 503 });

  const mail = mailer();
  const dry = !mail.enabled || new URL(req.url).searchParams.get("dry") === "1";
  const now = Date.now();
  // The week the database records against (Postgres weeks start on Monday, in UTC).
  const d = new Date(now); const day = (d.getUTCDay() + 6) % 7;
  const week = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);

  const counts = { sent: 0, wouldSend: 0, quiet: 0, failed: 0 };
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db.rpc("digest_recipients", { p_after: after, p_limit: 200 });
    if (error) return NextResponse.json({ error: "Couldn't read the recipients.", ...counts }, { status: 500 });
    const rows = (data ?? []) as { user_id: string; email: string; first_name: string }[];
    if (!rows.length) break;
    for (const r of rows) {
      const digest = buildDigest(r.first_name, await loadWeekFor(db, r.user_id, now), env.siteUrl);
      if (!digest) { counts.quiet++; continue; }
      if (dry) { counts.wouldSend++; continue; }
      const res = await mail.send({ to: r.email, ...digest });
      if (res.ok) { counts.sent++; await db.from("digest_sends").insert({ user_id: r.user_id, week }); } else counts.failed++;
    }
    after = rows[rows.length - 1].user_id;
  }
  return NextResponse.json({ emailOn: mail.enabled, dry, week, ...counts });
}
