// The public guide (/ai, lib/ai-guide.ts) comes from the code's own lists, so it can't fall behind the
// MCP server: every field, every command and every tool is on it, once, and the rules say what the
// assistant never does. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ASSISTANTS, COMMANDS, FIELDS, FLOW, RULES, toolGroups } from "@/lib/ai-guide";
import { MCP_TOOLS } from "@/lib/mcp";
import { PLAYBOOKS, PROMPTS } from "@/lib/mcp-playbooks";

test("every field has a section, with its tools, moments and signers, and its own anchor", () => {
  assert.equal(FIELDS.length, PLAYBOOKS.length);
  assert.equal(FIELDS.length, 20);
  assert.equal(new Set(FIELDS.map((f) => f.id)).size, 20, "anchors are unique");
  for (const f of FIELDS) {
    assert.match(f.id, /^[a-z]+(-[a-z]+)*$/, `${f.field}: anchor is a slug`);
    assert.ok(f.tools.length && f.moments.length && f.signers, `${f.field}: tools, moments and signers`);
    for (const t of f.tools) assert.ok(["Official MCP server", "Community MCP server", "Reads your exports"].includes(t.how), `${f.field}/${t.name}: how it connects`);
  }
});

test("every command the server offers is listed, in order", () => {
  assert.deepEqual(COMMANDS.map((c) => c.name), PROMPTS.map((p) => p.name));
});

test("every tool is listed exactly once: reads apart from what it drafts and does", () => {
  const groups = toolGroups();
  const all = groups.flatMap((g) => g.tools.map((t) => t.name));
  assert.deepEqual([...all].sort(), MCP_TOOLS.map((t) => t.name).sort());
  const reads = groups.find((g) => g.id === "reads")!.tools.map((t) => t.name);
  for (const n of reads) assert.equal(MCP_TOOLS.find((t) => t.name === n)!.needs, undefined, `${n} only reads`);
  for (const g of groups) for (const t of g.tools) assert.ok(t.body.length > 10 && t.body.length < 400, `${t.name}: a one-sentence summary`);
});

test("the loop is three steps, ending with a person signing; the rules cover yes, signing, deleting and the app's limits", () => {
  assert.equal(FLOW.length, 3);
  assert.match(FLOW[2].title, /signs/);
  const rules = RULES.join(" ");
  for (const w of [/without your yes/, /never verifies or signs/, /never deletes/, /same rules and limits/]) assert.match(rules, w);
  assert.ok(ASSISTANTS.includes("Claude Code") && !ASSISTANTS.includes("GitHub Actions"), "assistants, not the automation");
});
