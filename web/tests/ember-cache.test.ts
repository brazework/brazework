// Jig's prompt caching (lib/copilot-agent.ts): the fixed rules carry the cache marker and come
// first, the member's details follow it, and a question's tool rounds cache the growing conversation.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { emberSystem, runAgent } from "@/lib/copilot-agent";

test("the rules are one cached block, unchanged; everything about this member comes after the marker", () => {
  const blocks = emberSystem("RULES TEXT", "Member: Priya Raman.\n\nAnswer the question.");
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], { type: "text", text: "RULES TEXT", cache_control: { type: "ephemeral" } });
  assert.deepEqual(blocks[1], { type: "text", text: "Member: Priya Raman.\n\nAnswer the question." });
  // Same rules for two members: the cached block is byte-identical, so the second one reads it.
  assert.deepEqual(emberSystem("RULES TEXT", "Member: Leo Park.")[0], blocks[0]);
});

test("nothing after the rules is ever empty (an empty text block is a 400)", () => {
  assert.equal(emberSystem("RULES TEXT", "").length, 1);
  assert.equal(emberSystem("RULES TEXT", "   ").length, 1);
});

test("every tool round sends the same tools and system, and caches the conversation so far", async () => {
  const sent: Record<string, unknown>[] = [];
  let round = 0;
  const client = {
    messages: {
      stream: (params: Record<string, unknown>) => {
        sent.push(params);
        round++;
        const final = round === 1
          ? { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "my_profile", input: {} }] }
          : { stop_reason: "end_turn", content: [{ type: "text", text: "Done." }] };
        return { async *[Symbol.asyncIterator]() {}, finalMessage: async () => final };
      },
    },
  };
  const system = emberSystem("RULES TEXT", "Member: Priya.");
  const tools = [{ name: "my_profile", description: "x", input_schema: { type: "object" as const, properties: {} } }];
  await runAgent({ client: client as never, model: "m", system, messages: [{ role: "user", content: "hi" }], tools, exec: async () => ({ ok: true }), emit: () => {} });
  assert.equal(sent.length, 2, "one tool round, then the answer");
  for (const p of sent) {
    assert.deepEqual(p.cache_control, { type: "ephemeral" }, "the growing conversation is cached");
    assert.equal(p.system, system, "the same system blocks every round");
    assert.equal(p.tools, tools, "the same tools every round");
  }
});
