// Jig's instructions name its tools and the fields they return (my_profile, open_milestones) so it
// can use them. Those names are plumbing: on production Jig told a member "open_milestones is
// empty". The instructions now say the names stay out of what the member reads. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { taskPrompt } from "@/lib/copilot";

const ask = taskPrompt({ task: "ask", input: "Help me ask someone who saw my latest milestone to sign it." }).instructions;

test("Jig's instructions do teach it internal names, which is why the rule is needed", () => {
  assert.match(ask, /\bmy_profile\b/);
  assert.match(ask, /\bopen_milestones\b/);
});

test("Jig is told never to write a tool or field name in a reply", () => {
  const rule = ask.split("\n").find((line) => /underscore/i.test(line)) ?? "";
  assert.ok(rule, "a line says which names are internal: anything with an underscore");
  assert.match(rule, /tools?/i);
  assert.match(rule, /fields?/i);
  assert.match(rule, /never[^.]*in a reply/i);
});

test("the rule shows Jig the plain words to use instead", () => {
  const rule = ask.split("\n").find((line) => /underscore/i.test(line)) ?? "";
  assert.match(rule, /no milestones waiting/i);
});
