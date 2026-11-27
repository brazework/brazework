// How much of a conversation Ember sees (Linear FIX-239): all of it within the budget; past it, the
// start and the latest messages word for word and the middle summarised; a fold point that holds still
// so the prompt stays cached; the summary call on a cheap model, remembered, and a note when it fails;
// and the Ask bar's follow-ups. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { copilotRequest } from "@/lib/copilot-request";
import { FOLD_STEP, KEEP_HEAD, KEEP_TAIL_MIN, MAX_TURNS, cleanTurns, foldNote, followUpHistory, historyMessages, planHistory, type Turn } from "@/lib/ember-history";
import { SUMMARY_MODEL, conversation, summarizeTurns } from "@/lib/ember-history-summary";

// A chat of n messages, member then Ember, each `len` characters.
const chat = (n: number, len = 100): Turn[] => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `${i}:`.padEnd(len, "x") }));

test("a chat within the budget goes whole, far past the old 10-message window", () => {
  const ts = chat(40);
  const p = planHistory(ts, 100_000);
  assert.deepEqual(p.head, ts);
  assert.equal(p.folded.length, 0);
  assert.deepEqual(historyMessages(p), ts);
});

test("past the budget: the start and the latest stay word for word, the middle is folded", () => {
  const ts = chat(60, 1000);
  const p = planHistory(ts, 30_000);
  assert.deepEqual(p.head, ts.slice(0, KEEP_HEAD));
  assert.ok(p.folded.length > 0);
  assert.ok(p.tail.length >= KEEP_TAIL_MIN);
  assert.deepEqual([...p.head, ...p.folded, ...p.tail], ts, "every message is in exactly one part, in order");
  assert.equal(p.tail[0].role, "user", "the tail starts with the member, so the summary joins it");
  assert.deepEqual(p.tail.at(-1), ts.at(-1));
  const sent = historyMessages(p, "They named the rocket Kestrel.");
  assert.ok(sent.reduce((n, t) => n + t.content.length, 0) <= 30_000, "what's sent fits the budget");
  assert.match(sent[KEEP_HEAD].content, /summarised so the chat fits: They named the rocket Kestrel\./);
});

test("the fold point moves in steps, so the folded part (and the cached prefix) holds still between them", () => {
  const ts = chat(80, 1000);
  const folds = [60, 61, 62, 63].map((n) => planHistory(ts.slice(0, n), 30_000).folded.length);
  assert.ok(folds.every((f) => f % FOLD_STEP === 0 || f % FOLD_STEP === FOLD_STEP - 1), `folds land on steps: ${folds}`);
  assert.ok(new Set(folds).size <= 2, `at most one move over four turns: ${folds}`);
});

test("with no summary, the note still says how much is missing, so Ember asks rather than guesses", () => {
  assert.match(foldNote(chat(12), ""), /^\[12 earlier messages from the middle of this chat aren't shown here\. If the member refers to something you can't see, ask them/);
  assert.match(foldNote(chat(1), "  "), /1 earlier message from/);
});

test("what can be sent: real turns, each cut to size, the latest 80, starting with the member", () => {
  const ts = cleanTurns([{ role: "assistant", content: "Hi" }, { role: "user", content: "x".repeat(7000) }, { role: "system", content: "no" }, { role: "assistant", content: "  " }, { role: "assistant", content: "ok" }]);
  assert.equal(ts.length, 2);
  assert.equal(ts[0].role, "user");
  assert.equal(ts[0].content.length, 6000);
  assert.equal(cleanTurns(chat(100)).length, MAX_TURNS);
});

test("the request takes the whole saved chat's worth of history and a chat id, and still refuses junk", () => {
  const ok = copilotRequest.safeParse({ task: "ask", input: "and the second one?", history: chat(80), chat: "0f375040-0b82-44a2-93c1-8b460bbb4556" });
  assert.ok(ok.success, ok.error?.message);
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "q", history: chat(81) }).success, false);
  assert.equal(copilotRequest.safeParse({ task: "ask", input: "q", chat: "not-a-chat" }).success, false);
});

test("the summary comes from the cheap model at low effort, is remembered for the same part, and failing is quiet", async () => {
  const calls: Record<string, unknown>[] = [];
  const client = { messages: { create: async (p: Record<string, unknown>) => { calls.push(p); return { stop_reason: "end_turn", content: [{ type: "text", text: "Rocket is Kestrel; launch on the 3rd." }] }; } } };
  const folded = chat(10).map((t, i) => ({ ...t, content: `${t.content} unique-${Date.now()}-${i}` }));
  assert.equal(await summarizeTurns(client as never, folded), "Rocket is Kestrel; launch on the 3rd.");
  assert.equal(await summarizeTurns(client as never, folded), "Rocket is Kestrel; launch on the 3rd.");
  assert.equal(calls.length, 1, "the same folded part is summarised once");
  assert.equal(calls[0].model, SUMMARY_MODEL);
  assert.match(String(calls[0].model), /claude-haiku-5-5$/);
  assert.deepEqual(calls[0].output_config, { effort: "low" });
  const broken = { messages: { create: async () => { throw new Error("overloaded"); } } };
  assert.equal(await summarizeTurns(broken as never, chat(4).map((t) => ({ ...t, content: t.content + Math.random() }))), "");
});

test("a long saved chat goes out as start + summary + latest; a short one as it is, with no summary call", async () => {
  let n = 0;
  const client = { messages: { create: async () => { n++; return { stop_reason: "end_turn", content: [{ type: "text", text: "S" }] }; } } };
  const short = await conversation(client as never, chat(20));
  assert.equal(short.length, 20);
  assert.equal(n, 0);
  const long = await conversation(client as never, chat(80, 6000));
  assert.equal(n, 1);
  assert.match(long[KEEP_HEAD].content, /summarised so the chat fits: S\]$/);
  assert.equal(long.at(-1)!.content, chat(80, 6000).at(-1)!.content);
});

test("the Ask bar's follow-up carries the turns before it, in order", () => {
  const first = followUpHistory([], "Which clubs fit me?", "Rocketry Club and Robotics Society.");
  assert.deepEqual(first, [{ role: "user", content: "Which clubs fit me?" }, { role: "assistant", content: "Rocketry Club and Robotics Society." }]);
  const second = followUpHistory(first, "and the second one?", "Robotics Society meets Thursdays.");
  assert.equal(second.length, 4);
  assert.equal(second[2].content, "and the second one?");
});
