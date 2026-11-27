import type Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { claudeModel } from "@/lib/claude";
import { cleanTurns, historyMessages, planHistory, type Turn } from "@/lib/ember-history";

// The summary that stands in for the middle of a long chat (Linear FIX-239). Server-only.
// A small, cheap model writes it; the answer itself still comes from Ember's own model. The fold
// point only moves every few turns (lib/ember-history.ts), and a summary is kept in memory per folded
// part, so the same folded part gets the same words: the prompt prefix stays the same and stays cached.
// If the summary call fails, the chat still goes through with a note saying what's missing.

export const SUMMARY_MODEL = claudeModel(process.env.COPILOT_SUMMARY_MODEL || "claude-haiku-5-5");

const SUMMARY_RULES = `You condense the middle of a chat between a member of Brazework (a record of what people build, signed by the people who saw it) and Ember, its assistant, so the rest of the chat can continue without it.
Write under 250 words, plain text, no headings. Keep what a later message might refer back to: names, projects, clubs, numbers, dates, links, decisions, what the member asked for, what Ember prepared or promised, and anything still open. Leave out pleasantries. Don't add anything that isn't in the chat.`;

const memo = new Map<string, string>();
const MEMO_MAX = 500;
const key = (ts: Turn[]) => createHash("sha256").update(JSON.stringify(ts)).digest("hex");

type Summarizer = Pick<Anthropic, "messages">;

export async function summarizeTurns(client: Summarizer, folded: Turn[], signal?: AbortSignal): Promise<string> {
  const k = key(folded);
  const hit = memo.get(k);
  if (hit !== undefined) return hit;
  try {
    const transcript = folded.map((t) => `${t.role === "user" ? "Member" : "Ember"}: ${t.content}`).join("\n\n");
    const res = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 2000,
      // A short condensing job: little thinking needed.
      output_config: { effort: "low" },
      system: SUMMARY_RULES,
      messages: [{ role: "user", content: `The part of the chat to condense:\n\n${transcript}` }],
    }, { signal });
    if (res.stop_reason === "refusal") return "";
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim().slice(0, 3000);
    if (text) {
      if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value as string);
      memo.set(k, text);
    }
    return text;
  } catch {
    return "";
  }
}

// The conversation to send with a request: all of it within budget, or start + summary + latest.
export async function conversation(client: Summarizer, history: { role: string; content: unknown }[], signal?: AbortSignal): Promise<Turn[]> {
  const plan = planHistory(cleanTurns(history));
  if (!plan.folded.length) return plan.head;
  return historyMessages(plan, await summarizeTurns(client, plan.folded, signal));
}
