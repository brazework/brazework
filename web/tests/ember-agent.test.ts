// Torch's tool loop (lib/copilot-agent.ts runAgent) at its limits. An answer that ran out of tokens
// used to end without a word, and a project card's write-up alone can be longer than the old limit,
// so a card could be cut off and never appear. Now the limit is higher and a cut-off answer says so.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ASK_TOKENS, taskPrompt } from "@/lib/copilot";
import { MAX_ROUNDS, OUT_OF_ROOM, OUT_OF_ROUNDS, runAgent } from "@/lib/copilot-agent";
import { TOOLS } from "@/lib/copilot-tools";

type Final = { stop_reason: string; content: unknown[] };
// A stand-in for the API: each round streams `text` (if any) and ends with the next scripted message.
function mock(script: (round: number) => Final & { text?: string }) {
  const sent: Record<string, unknown>[] = [];
  const client = {
    messages: {
      stream: (params: Record<string, unknown>) => {
        sent.push(params);
        const { text, ...final } = script(sent.length);
        return {
          async *[Symbol.asyncIterator]() { if (text) yield { type: "content_block_delta", delta: { type: "text_delta", text } }; },
          finalMessage: async () => final,
        };
      },
    },
  };
  return { client: client as never, sent };
}
const lookup = (n: number): Final => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: `t${n}`, name: "my_profile", input: {} }] });

async function run(script: Parameters<typeof mock>[0]) {
  const { client, sent } = mock(script);
  let text = "";
  const tools: string[] = [];
  let ran = 0;
  await runAgent({ client, model: "m", system: "s", messages: [{ role: "user", content: "hi" }], tools: [], exec: async () => { ran++; return { ok: true }; }, emit: (e) => { if (e.type === "text") text += e.text; else tools.push(e.name); } });
  return { text, tools, ran, rounds: sent.length };
}

test("an answer cut off for length says so, and runs no half-written tool", async () => {
  const r = await run(() => ({ text: "I've drafted the project.", stop_reason: "max_tokens", content: [{ type: "text", text: "I've drafted the project." }, { type: "tool_use", id: "t1", name: "propose_project", input: {} }] }));
  assert.equal(r.text, `I've drafted the project.\n\n${OUT_OF_ROOM}`);
  assert.equal(r.ran, 0, "the cut-off card is never run");
  assert.equal(r.rounds, 1);
});

test("an answer that finishes normally gets no notice", async () => {
  const r = await run(() => ({ text: "Done.", stop_reason: "end_turn", content: [] }));
  assert.equal(r.text, "Done.");
});

test(`an answer may use ${MAX_ROUNDS} rounds of tools, and no more`, async () => {
  const fits = await run((n) => (n < MAX_ROUNDS ? lookup(n) : { text: "Here it is.", stop_reason: "end_turn", content: [] }));
  assert.equal(fits.rounds, MAX_ROUNDS);
  assert.equal(fits.ran, MAX_ROUNDS - 1);
  assert.ok(fits.text.endsWith("Here it is."));
  assert.ok(!fits.text.includes(OUT_OF_ROUNDS));

  const over = await run((n) => lookup(n));
  assert.equal(over.rounds, MAX_ROUNDS, "it stops asking");
  assert.ok(over.text.endsWith(OUT_OF_ROUNDS));
  assert.equal(MAX_ROUNDS, 6);
});

test("an ask has room for the longest card Torch can prepare", () => {
  assert.equal(taskPrompt({ task: "ask", input: "hi" }).maxTokens, ASK_TOKENS);
  // The longest field any card may carry, as its tool describes it ("details (the write-up) <= 5000").
  const limits = TOOLS.filter((t) => t.name.startsWith("propose_")).flatMap((t) => [...JSON.stringify(t).matchAll(/(?:<=|at most) ?(\d[\d,]*) ?(?:chars|characters)?/g)].map((m) => Number(m[1].replace(/,/g, ""))));
  const longest = Math.max(...limits);
  assert.ok(longest >= 3000, "the tools still say how long their fields may be");
  // About 4 characters a token, and room left for the words around the card.
  assert.ok(ASK_TOKENS >= longest / 4 + 500, `${ASK_TOKENS} tokens can't hold a ${longest}-character field`);
});

test("the notices are Torch's, in brackets like its other system lines", () => {
  for (const s of [OUT_OF_ROOM, OUT_OF_ROUNDS]) assert.match(s, /^\[Torch .*\]$/);
});

test("offering answers ends the message: no lookup line, no closing round", async () => {
  const { client, sent } = mock((n) => (n === 1
    ? { text: "Which club saw it?", stop_reason: "tool_use", content: [{ type: "text", text: "Which club saw it?" }, { type: "tool_use", id: "c1", name: "offer_choices", input: { options: ["Rocketry Club", "A person"] } }] }
    : { text: "This round should never happen.", stop_reason: "end_turn", content: [] }));
  let text = "";
  const tools: string[] = [];
  await runAgent({ client, model: "m", system: "s", messages: [{ role: "user", content: "hi" }], tools: [], exec: async () => ({ shown_to_member: true }), emit: (e) => { if (e.type === "text") text += e.text; else tools.push(e.name); } });
  assert.equal(sent.length, 1);
  assert.equal(text, "Which club saw it?");
  assert.deepEqual(tools, [], "it isn't shown as a lookup");
});

test("a refused offer goes back to Torch, which carries on in words", async () => {
  const { client, sent } = mock((n) => (n === 1
    ? { stop_reason: "tool_use", content: [{ type: "tool_use", id: "c1", name: "offer_choices", input: { options: ["Only one"] } }] }
    : { text: "Which club saw it?", stop_reason: "end_turn", content: [] }));
  let text = "";
  await runAgent({ client, model: "m", system: "s", messages: [{ role: "user", content: "hi" }], tools: [], exec: async () => ({ error: "Offer 2 to 4" }), emit: (e) => { if (e.type === "text") text += e.text; } });
  assert.equal(sent.length, 2);
  assert.ok(text.endsWith("Which club saw it?"));
});
