import { z } from "zod";
import { RELATIONSHIPS, type Relationship } from "@/lib/vouch-email";

// What the iPhone app may send to /api/signatures: ask a person who saw the work to sign either one of
// the member's milestones that's still open, or a new one (made here first, with no club, the same
// row the web's addMilestone makes). The same limits as the web's form and the database
// (supabase/milestones.sql, verification.sql, vouches.sql). Pure, so it's tested
// (tests/signature-request.test.ts).
const milestone = z.object({
  project_id: z.string().min(1).max(64),
  title: z.string().trim().min(1, "Say what happened.").max(120, "Keep the title under 120 characters."),
  detail: z.string().trim().max(600, "Keep the details under 600 characters.").default(""),
  evidence: z.string().trim().min(1, "Add evidence: a link to a photo, video, file or commit.").max(300).refine((v) => /^https:\/\/\S+$/i.test(v), "Evidence has to be a secure web link (https://…)."),
  achieved_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it happened."),
  show_on_profile: z.boolean().default(true),
});

export const signatureRequest = z.object({
  email: z.string().trim().toLowerCase().email("Enter their email address.").max(254),
  relationship: z.enum(Object.keys(RELATIONSHIPS) as [Relationship, ...Relationship[]], { message: "Pick how they know your work." }),
  // Optional: a LinkedIn link, for a working account that hasn't added one (the ask needs it).
  linkedin: z.string().trim().max(200).optional(),
  milestone_id: z.string().min(1).max(64).optional(),
  milestone: milestone.optional(),
}).refine((r) => Boolean(r.milestone_id) !== Boolean(r.milestone), { message: "Say which milestone to ask about." });

export type SignatureRequest = z.infer<typeof signatureRequest>;
