import { EMAIL_RE } from "@/lib/forge";

// Graduating: move your sign-in from your school email to a personal one you'll keep (Settings →
// Account, lib/settings.ts moveToPersonalEmail). Your profile, projects, verified work and past classes
// are tied to your account, not your email, so they all stay. Only school placement follows the email.

export const cleanEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

// What's wrong with this move, or null when it can go ahead. School checks come from is_school_email().
export function personalEmailProblem(p: { next: string; current: string | null | undefined; currentIsSchool: boolean; nextIsSchool: boolean }): string | null {
  if (!EMAIL_RE.test(p.next) || p.next.length > 254) return "Enter the personal email you want to sign in with.";
  if (cleanEmail(p.current) === p.next) return "This is already your sign-in email.";
  if (!p.currentIsSchool) return "Your sign-in email is already a personal one.";
  if (p.nextIsSchool) return "That's a school email. Use a personal address you'll keep after you graduate.";
  return null;
}

export const personalEmailSent = (next: string) =>
  `Check both inboxes: your school email and ${next}. Follow both links to finish. Your projects, verified work and classes stay on your profile.`;
