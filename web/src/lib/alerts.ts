// Email alerts (Linear FIX-18): one batched email for new messages, connection requests and comments
// on your posts that you haven't seen in the app. The rows come from email_alert_recipients()
// (supabase/email-alerts.sql). No message text is copied into the email: only who and how many.
// Tested in tests/alerts.test.ts.

export type AlertItems = {
  messages?: { from: string; n: number }[] | null;
  requests?: string[] | null;
  comments?: { from: string; n: number }[] | null;
};

type Line = { text: string; action: string; href: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const nameOf = (s: string) => s.trim() || "Someone";

export function alertLines(items: AlertItems): Line[] {
  const lines: Line[] = [];
  for (const m of items.messages ?? []) {
    lines.push({ text: `${nameOf(m.from)} sent you ${m.n === 1 ? "a message" : plural(m.n, "message")}`, action: "Reply", href: "/messages" });
  }
  for (const r of items.requests ?? []) {
    lines.push({ text: `${nameOf(r)} wants to connect`, action: "Respond", href: "/network?tab=invitations" });
  }
  for (const c of items.comments ?? []) {
    lines.push({ text: `${nameOf(c.from)} ${c.n === 1 ? "commented on your post" : `left ${plural(c.n, "comment")} on your posts`}`, action: "See", href: "/notifications" });
  }
  return lines;
}

export function alertSubject(items: AlertItems): string {
  const m = (items.messages ?? []).reduce((s, x) => s + x.n, 0);
  const r = (items.requests ?? []).length;
  const c = (items.comments ?? []).reduce((s, x) => s + x.n, 0);
  const people = (items.messages ?? []).length + r + (items.comments ?? []).length;
  // One thing from one person reads best as a sentence; anything more as a count.
  if (people === 1) return alertLines(items)[0].text;
  const parts = [m && plural(m, "new message"), r && plural(r, "connection request"), c && plural(c, "new comment")].filter(Boolean);
  return `On Brazework: ${parts.join(", ")}`;
}

export function buildAlert(first: string, items: AlertItems, site: string): { subject: string; text: string; html: string } | null {
  const lines = alertLines(items);
  if (!lines.length) return null;
  const subject = alertSubject(items);
  const hi = first ? `Hi ${first},` : "Hi,";
  const settings = `${site}/settings#email`;
  const text = [
    hi, "", "While you were away:", "",
    ...lines.map((l) => `- ${l.text} (${l.action}: ${site}${l.href})`),
    "", `Open Brazework: ${site}/feed`, "", `Choose which emails you get in Settings: ${settings}`,
  ].join("\n");
  const rows = lines.map((l) => `<li style="margin:0 0 10px">${esc(l.text)} <a href="${esc(site + l.href)}" style="color:#111;font-weight:600">${esc(l.action)} →</a></li>`).join("");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:520px">
<p>${esc(hi)}</p><p>While you were away:</p><ul style="padding-left:18px">${rows}</ul>
<p><a href="${esc(site)}/feed" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open Brazework</a></p>
<p style="font-size:12px;color:#666"><a href="${esc(settings)}" style="color:#666">Choose which emails you get</a> in Settings.</p></div>`;
  return { subject, text, html };
}
