// The email that asks someone to vouch for a milestone (supabase/vouches.sql). The link is the only
// way in: it proves the reader controls the address it was sent to. Pure, so it's unit-tested
// (tests/vouch-email.test.ts).

export const RELATIONSHIPS = {
  professor: "a professor", ta: "a TA", pi: "their lab's PI", manager: "a manager", mentor: "a mentor", other: "someone who saw the work",
} as const;
export type Relationship = keyof typeof RELATIONSHIPS;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildVouchEmail(p: { member: string; title: string; project: string; relationship: Relationship; link: string }) {
  const who = p.member || "A student";
  const subject = `${who} asked you to vouch for their work`;
  const as = RELATIONSHIPS[p.relationship];
  const text = [
    "Hi,", "",
    `${who} listed you as ${as} who saw this happen, and asked you to vouch for it on Brazework:`, "",
    `  "${p.title}"${p.project ? ` (${p.project})` : ""}`, "",
    "It takes a minute: look at their evidence, then say in a sentence what you saw and how you know their work. No account needed.", "",
    `Vouch or decline: ${p.link}`, "",
    "The link works once and expires in 14 days. If you don't know them, ignore this email and nothing happens.", "",
    "Brazework is where students keep a record of what they build, signed by people who saw it.",
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:520px">
<p>Hi,</p>
<p><b>${esc(who)}</b> listed you as ${esc(as)} who saw this happen, and asked you to vouch for it on Brazework:</p>
<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #111;background:#f6f6f6"><b>${esc(p.title)}</b>${p.project ? `<br><span style="color:#555">${esc(p.project)}</span>` : ""}</blockquote>
<p>It takes a minute: look at their evidence, then say in a sentence what you saw and how you know their work. No account needed.</p>
<p><a href="${esc(p.link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Vouch or decline</a></p>
<p style="font-size:12px;color:#666">The link works once and expires in 14 days. If you don't know them, ignore this email and nothing happens.</p></div>`;
  return { subject, text, html };
}
