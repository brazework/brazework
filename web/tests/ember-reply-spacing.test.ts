// When Ember writes, uses a tool, then writes again, the two pieces arrived glued together: on
// production a reply read "…on the card.I've put together…". The loop (lib/copilot-agent.ts) now
// starts the second piece on a new paragraph. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { runAgent } from "@/lib/copilot-agent";

type Round = { say: string[]; tool?: boolean };

/** A stand-in for the model: each round streams its text in pieces, then asks for a tool or stops. */
async function reply(rounds: Round[]): Promise<string> {
  let n = 0;
  const client = {
    messages: {
      stream: () => {
        const r = rounds[n++];
        const final = r.tool
          ? { stop_reason: "tool_use", content: [{ type: "tool_use", id: `t${n}`, name: "my_profile", input: {} }] }
          : { stop_reason: "end_turn", content: [] };
        return {
          async *[Symbol.asyncIterator]() { for (const text of r.say) yield { type: "content_block_delta", delta: { type: "text_delta", text } }; },
          finalMessage: async () => final,
        };
      },
    },
  };
  let out = "";
  await runAgent({ client: client as never, model: "m", system: "RULES", messages: [{ role: "user", content: "hi" }], tools: [], exec: async () => ({ ok: true }), emit: (e) => { if (e.type === "text") out += e.text; } });
  return out;
}

test("what Ember writes before a tool and after it are separate paragraphs", async () => {
  const out = await reply([{ say: ["You'll fill in their email ", "on the card."], tool: true }, { say: ["I've put together ", "the card."] }]);
  assert.equal(out, "You'll fill in their email on the card.\n\nI've put together the card.");
});

test("an answer that only begins after the tool starts clean, with no blank lines before it", async () => {
  assert.equal(await reply([{ say: [], tool: true }, { say: ["You have four waiting."] }]), "You have four waiting.");
});

test("a break the model already wrote is not doubled", async () => {
  assert.equal(await reply([{ say: ["First.\n\n"], tool: true }, { say: ["Second."] }]), "First.\n\nSecond.");
  assert.equal(await reply([{ say: ["First.\n"], tool: true }, { say: ["\nSecond."] }]), "First.\n\nSecond.");
  assert.equal(await reply([{ say: ["First."], tool: true }, { say: ["\n\nSecond."] }]), "First.\n\nSecond.");
});

test("two tools in a row still leave one break, and text inside one round is untouched", async () => {
  const out = await reply([{ say: ["Looking."], tool: true }, { say: [], tool: true }, { say: ["Found ", "it."] }]);
  assert.equal(out, "Looking.\n\nFound it.");
});
