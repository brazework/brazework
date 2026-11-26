import { test } from "node:test";
import assert from "node:assert/strict";
import { frame, parseStream, type Proposal } from "../src/lib/copilot-agent";

// Jig's reply renders in the order it arrived (components/copilot/reply.tsx): text, the card, then
// the text after it, so a card is never pushed down by words arriving above it (redesign 2026-11).
const post: Proposal = { id: "p1", kind: "post", body: "Flight computer v2 is alive.", postKind: "result", tags: ["avionics"] };

test("segments keep text and cards in arrival order, and skip lookup frames", () => {
  const raw = `Here's a draft.${frame({ tool: "propose_post" })}${frame({ proposal: post })}\n\nIt's on the card below.`;
  const { text, tools, proposals, segments } = parseStream(raw);
  assert.equal(text, "Here's a draft.\n\nIt's on the card below.");
  assert.deepEqual(tools, ["propose_post"]);
  assert.deepEqual(proposals, [post]);
  assert.deepEqual(segments, [
    { type: "text", text: "Here's a draft." },
    { type: "proposal", proposal: post },
    { type: "text", text: "\n\nIt's on the card below." },
  ]);
});

test("a frame still arriving shows nothing, not half its JSON", () => {
  const whole = `Drafting${frame({ proposal: post })}`;
  const { segments, text } = parseStream(whole.slice(0, whole.length - 12));
  assert.equal(text, "Drafting");
  assert.deepEqual(segments, [{ type: "text", text: "Drafting" }]);
});

test("text around a lookup frame stays one segment", () => {
  const { segments } = parseStream(`Checking${frame({ tool: "search_clubs" })} your clubs.`);
  assert.deepEqual(segments, [{ type: "text", text: "Checking your clubs." }]);
});
