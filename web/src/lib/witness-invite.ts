// Witness invitations (Linear FIX-129). When a member shares a signed result (proof cards, FIX-128),
// the person who signed it hears about it once: a member gets a notification (supabase/witness-
// invites.sql); someone who vouched by email gets this one email. And the card credits the witness
// with how many results they've signed. Pure, so it's tested (tests/witness-invite.test.ts).
import type { Email } from "@/lib/email";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildProofSharedEmail(p: { to: string; member: string; title: string; cardUrl: string; signupUrl: string }): Email {
  const who = p.member.trim() || "Someone you vouched for";
  const subject = `${who} shared the work you vouched for`;
  const text = [
    "Hi,", "",
    `${who} shared a result you vouched for on Brazework, with your name on it:`, "",
    `  "${p.title}"`, `  ${p.cardUrl}`, "",
    "Want a record like this for your own work? It's free, and the people who saw it can sign it:",
    `  ${p.signupUrl}`, "",
    "This is the only email about it; we won't email you about it again.",
  ].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:520px">
<p>Hi,</p>
<p><b>${esc(who)}</b> shared a result you vouched for on Brazework, with your name on it:</p>
<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #111;background:#f6f6f6"><b>${esc(p.title)}</b></blockquote>
<p><a href="${esc(p.cardUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">See the card</a></p>
<p>Want a record like this for your own work? It's free, and the people who saw it can sign it: <a href="${esc(p.signupUrl)}">start your record</a>.</p>
<p style="font-size:12px;color:#666">This is the only email about it; we won't email you about it again.</p></div>`;
  return { to: p.to, subject, text, html };
}

/** "Has signed 12 results on Brazework"; nothing for a first signature (it would only say "1"). */
export const witnessCredit = (n: number) => (n >= 2 ? `Has signed ${n} results on Brazework` : "");
