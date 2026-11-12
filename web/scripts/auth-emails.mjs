// Brazework's sign-in emails (Supabase Auth), kept in the repo (Linear FIX-1). Supabase sends these
// for sign-up, password reset, sign-in links, email changes and invites; until now they were
// Supabase's plain defaults. Email-safe HTML: tables, inline styles, no images or external CSS, so
// they look the same in Gmail, Outlook and Apple Mail, light or dark.
//
//   node scripts/auth-emails.mjs --preview <dir>   write each email as HTML, with sample values filled in
//   node scripts/auth-emails.mjs --apply           set them on production Supabase (needs
//                                                  SUPABASE_ACCESS_TOKEN; run with the SMTP switch-over)
//
// Supabase fills in {{ .ConfirmationURL }}, {{ .Email }}, {{ .NewEmail }} and {{ .SiteURL }}.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT = "uwiwkjoonculpxjmzsfj";
const INK = "#09090b", MUTED = "#52525b", FAINT = "#a1a1aa", LINE = "#e4e4e7", PAPER = "#ffffff", WASH = "#f4f4f5";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// One layout for every email: wordmark, a heading, a line or two, one button, the link as text, and
// why you got it.
function layout({ preheader, heading, body, button, why }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:${WASH};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${WASH};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${WASH};">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 20px 4px;font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.02em;color:${INK};">&#9650;&nbsp;Brazework</td></tr>
      <tr><td style="background:${PAPER};border:1px solid ${LINE};border-radius:20px;padding:36px 32px;">
        <h1 style="margin:0 0 12px 0;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;color:${INK};">${heading}</h1>
        <p style="margin:0 0 28px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${MUTED};">${body}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${INK}" style="border-radius:999px;">
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:${PAPER};text-decoration:none;border-radius:999px;">${button}</a>
          </td>
        </tr></table>
        <p style="margin:28px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${FAINT};">Button not working? Paste this into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:${MUTED};word-break:break-all;">{{ .ConfirmationURL }}</a></p>
      </td></tr>
      <tr><td style="padding:20px 4px 0 4px;font-family:${FONT};font-size:12px;line-height:1.6;color:${FAINT};">${why}<br>Brazework: verified work from student engineering clubs.</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Supabase's names for each email, with its subject and words.
export const EMAILS = {
  confirmation: {
    subject: "Confirm your email for Brazework",
    html: layout({
      preheader: "One tap and you're in.",
      heading: "Confirm your email",
      body: "You're one tap from Brazework, where your club's verified work becomes proof of what you can build. Confirm this is your email to finish signing up.",
      button: "Confirm and sign in",
      why: "You're getting this because {{ .Email }} was used to sign up for Brazework. If that wasn't you, ignore this email and nothing happens.",
    }),
  },
  recovery: {
    subject: "Reset your Brazework password",
    html: layout({
      preheader: "Choose a new password. The link works once.",
      heading: "Reset your password",
      body: "Someone asked to reset the password for {{ .Email }}. If it was you, choose a new one. The link works once and expires soon.",
      button: "Choose a new password",
      why: "If you didn't ask for this, you can ignore it: your password stays the same.",
    }),
  },
  magic_link: {
    subject: "Your Brazework sign-in link",
    html: layout({
      preheader: "Sign in with one tap. The link works once.",
      heading: "Sign in to Brazework",
      body: "Here's your sign-in link for {{ .Email }}. It works once and expires soon.",
      button: "Sign in",
      why: "If you didn't ask to sign in, ignore this email. Nobody can sign in without the link.",
    }),
  },
  email_change: {
    subject: "Confirm your new email for Brazework",
    html: layout({
      preheader: "Confirm the change to your sign-in email.",
      heading: "Confirm your new email",
      body: "You asked to change your Brazework sign-in email from {{ .Email }} to {{ .NewEmail }}. Confirm to make the switch.",
      button: "Confirm new email",
      why: "If you didn't ask for this, ignore it and your email stays as it is.",
    }),
  },
  invite: {
    subject: "You're invited to Brazework",
    html: layout({
      preheader: "Your club is on Brazework. Join to see its work.",
      heading: "You're invited to Brazework",
      body: "You've been invited to join Brazework, where student engineering clubs post what they build and verify each other's milestones. Accept to set up your account.",
      button: "Accept the invite",
      why: "You're getting this because someone invited {{ .Email }}. If you weren't expecting it, ignore this email.",
    }),
  },
};

const SAMPLE = { "{{ .ConfirmationURL }}": "https://brazework.com/auth/confirm?token_hash=pkce_example&type=signup", "{{ .Email }}": "ada@university.edu", "{{ .NewEmail }}": "ada@newschool.edu", "{{ .SiteURL }}": "https://brazework.com" };

const [cmd, dir] = process.argv.slice(2);
if (cmd === "--preview") {
  const out = dir ?? "auth-email-previews";
  mkdirSync(out, { recursive: true });
  for (const [name, e] of Object.entries(EMAILS)) writeFileSync(join(out, `${name}.html`), Object.entries(SAMPLE).reduce((s, [k, v]) => s.replaceAll(k, v), e.html));
  console.log(`wrote ${Object.keys(EMAILS).length} previews to ${out}`);
} else if (cmd === "--apply") {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) { console.error("Set SUPABASE_ACCESS_TOKEN (a Supabase personal access token)."); process.exit(1); }
  const body = {};
  for (const [name, e] of Object.entries(EMAILS)) { body[`mailer_subjects_${name}`] = e.subject; body[`mailer_templates_${name}_content`] = e.html; }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/config/auth`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  console.log(`PATCH /config/auth -> ${res.status}`);
  if (!res.ok) { console.error(await res.text()); process.exit(1); }
} else {
  console.log("usage: node scripts/auth-emails.mjs --preview <dir> | --apply");
}
