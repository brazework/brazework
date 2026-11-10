import type { WeekItem } from "@/lib/week";

// The weekly digest email: the same items as "Your week" on Home, so the email and the app never
// disagree. Nothing to say means no email at all. Plain text plus simple HTML (works in every client).
// Tested in tests/digest.test.ts.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function weekLink(item: WeekItem): string {
  return item.href.startsWith("/") ? item.href : "/feed";
}

export function buildDigest(first: string, items: WeekItem[], site: string): { subject: string; text: string; html: string } | null {
  if (!items.length) return null;
  const todo = items.filter((i) => i.tone === "todo").length;
  const subject = todo ? `Your week on Forge: ${todo} ${todo === 1 ? "thing" : "things"} waiting on you` : "Your week on Forge";
  const hi = first ? `Hi ${first},` : "Hi,";
  const settings = `${site}/settings#email`;
  const text = [
    hi, "", "Here's your week on Forge:", "",
    ...items.map((i) => `- ${i.text}${i.action ? ` (${i.action}: ${site}${weekLink(i)})` : ""}`),
    "", `Open Forge: ${site}/feed`, "", `You get this weekly. Turn it off in Settings: ${settings}`,
  ].join("\n");
  const rows = items.map((i) => `<li style="margin:0 0 10px">${esc(i.text)}${i.action ? ` <a href="${esc(site + weekLink(i))}" style="color:#111;font-weight:600">${esc(i.action)} →</a>` : ""}</li>`).join("");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:520px">
<p>${esc(hi)}</p><p>Here's your week on Forge:</p><ul style="padding-left:18px">${rows}</ul>
<p><a href="${esc(site)}/feed" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open Forge</a></p>
<p style="font-size:12px;color:#666">You get this weekly. <a href="${esc(settings)}" style="color:#666">Turn it off in Settings</a>.</p></div>`;
  return { subject, text, html };
}
