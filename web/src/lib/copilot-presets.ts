import { z } from "zod";

// One-tap Jig actions ("This week's update for Rocketry Club"). The member sees and saves a plain
// request; the step-by-step instructions for Jig go to the server beside it and are added to the
// system prompt there, so they never show up in the chat, the chat's title or "You asked".
// Pure, so the client can build requests with it and tests can check it (tests/copilot-presets.test.ts).

const clubId = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "That club link isn't valid.");
export const presetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("club_update"), club_id: clubId }),
]);
export type Preset = z.infer<typeof presetSchema>;

// What the member sees as their question.
export const clubUpdateAsk = (clubName: string) => `Draft this week's update for ${clubName.trim() || "my club"}`;
export const clubUpdatePreset = (id: string): Preset => ({ kind: "club_update", club_id: id });

// What Jig is told, server side. Club access is still checked by the club_report tool itself.
export function presetInstruction(p: Preset): string {
  switch (p.kind) {
    case "club_update":
      return [
        `The member tapped "This week's update" for their club (club id ${p.club_id}).`,
        `Call club_report for club ${p.club_id}, then draft the club's weekly update with propose_club_post:`,
        "welcome new members by name, point to the top post, list what's coming up, and invite members to ask the club to verify their work.",
        "Use only the report's numbers. If club_report says they can't see this club's report, say so plainly and don't draft anything.",
      ].join(" ");
  }
}

// A link that opens Jig with this preset (?q= is what the member sees; ?club_update= carries the club).
export const clubUpdateHref = (id: string, name: string) => `/copilot?q=${encodeURIComponent(clubUpdateAsk(name))}&club_update=${encodeURIComponent(id)}`;

// Read the preset back from the Jig page's query string. Anything malformed is ignored, not an error.
export function presetFromQuery(sp: Record<string, string | string[] | undefined>): Preset | null {
  const id = typeof sp.club_update === "string" ? sp.club_update : "";
  if (!id) return null;
  const p = presetSchema.safeParse(clubUpdatePreset(id));
  return p.success ? p.data : null;
}
