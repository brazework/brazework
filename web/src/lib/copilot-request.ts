import { z } from "zod";
import { presetSchema } from "@/lib/copilot-presets";
import { PAGE_ID } from "@/lib/ember-bar";
import { MAX_CARDS, MAX_TURN, cardOutcome, offeredChoice } from "@/lib/ember-thread";

// What the browser may send to /api/copilot. Kept apart from lib/copilot.ts (server-only) so the
// client and tests can use it.
export const copilotRequest = z.object({
  task: z.enum(["post", "writeup", "ask"]),
  // Empty only on a follow turn after a confirmed card: the server writes that turn (lib/ember-thread.ts).
  input: z.string().trim().max(4000, "Keep it under 4,000 characters.").default(""),
  kind: z.enum(["update", "question", "result", "project"]).optional(),
  title: z.string().max(120).optional(),
  summary: z.string().max(600).optional(),
  // `cards`: what happened to the cards an answer prepared (lib/ember-thread.ts), so Torch knows.
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(MAX_TURN), cards: z.array(cardOutcome).max(MAX_CARDS).optional(), choice: offeredChoice.optional(), follow: z.boolean().optional() })).max(12).optional(),
  // Torch carrying on by itself after a yes: free, up to 3 after each ask (supabase/ember-follow.sql).
  follow: z.boolean().optional(),
  // The page can show Torch's answers as buttons (offer_choices). The Ask Torch bar and Torch's page
  // say so; anywhere else (the feed's box, the iPhone app) Torch asks in words.
  choices: z.boolean().optional(),
  // A one-tap action's instructions (lib/copilot-presets.ts): added server side, never shown in the chat.
  preset: presetSchema.optional(),
  // The page the Ask Torch bar was used on (lib/ember-bar.ts pageContext): only the id; the server
  // reads the rest as the member (lib/copilot-page.ts).
  page: z.object({ kind: z.enum(["project", "club", "event"]), id: z.string().regex(PAGE_ID) }).optional(),
}).superRefine((r, ctx) => {
  if (!r.follow && !r.input) ctx.addIssue({ code: "custom", path: ["input"], message: "Write a few words first." });
  if (r.follow && (r.task !== "ask" || !r.choices)) ctx.addIssue({ code: "custom", path: ["follow"], message: "Only a page that can carry on asks Torch to." });
});
export type CopilotRequest = z.infer<typeof copilotRequest>;
