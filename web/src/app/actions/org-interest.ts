"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_RE, FREE_MAIL, friendlyError } from "@/lib/forge";

export type OrgInterestState = { ok: boolean; message: string; contact?: string; name?: string };

const schema = z.object({
  type: z.enum(["company", "school", "club"]),
  name: z.string().trim().min(1, "Enter your organization's name.").max(120),
  contact: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().max(120).regex(EMAIL_RE, "Enter a valid work email."),
  role: z.string().trim().max(80).default(""),
});

// Same table and rules as the vanilla landing page (public/js/views/landing.js).
// Clubs are stored as "school" until the table's type check allows "club".
export async function registerOrgInterest(_: OrgInterestState, form: FormData): Promise<OrgInterestState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { type, name, contact, email, role } = parsed.data;
  if (FREE_MAIL.includes(email.split("@")[1] ?? "")) return { ok: false, message: "Please use your work or school email, not a personal address." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("org_interest")
    .insert({ type: type === "club" ? "school" : type, name, contact, email, role: type === "club" ? `Club: ${role}`.slice(0, 80) : role });
  if (error) return { ok: false, message: friendlyError(error) };
  return { ok: true, message: "", contact: contact.split(" ")[0], name };
}
