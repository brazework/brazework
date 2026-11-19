// One set of actions behind AI tools (MCP) and Ember (lib/tool-actions.ts, supabase/tool-actions.sql):
// every action tool drafts with a drafting token and is offered with the right scope; a tool's draft
// becomes the Ember card that confirms it; arguments reach the database cleaned; every result says
// what's next. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MCP_TOOLS, annotationsFor, toolsFor } from "@/lib/mcp";
import { nextStep, withFix } from "@/lib/mcp-results";
import { CARD_KINDS, actionPayload, appTopics, draftToProposal, isCardKind } from "@/lib/tool-actions";

const O = "https://brazework.com";
const acts = MCP_TOOLS.filter((t) => t.act);

test("each action kind has exactly one MCP tool; each drafts with a drafting token and writes nothing destructive", () => {
  assert.deepEqual(acts.map((t) => t.act).sort(), [...CARD_KINDS].sort());
  const drafting = toolsFor(["read", "draft"]).map((t) => t.name);
  for (const t of acts) {
    assert.equal(t.needs, "draft", `${t.name} is offered to tokens that draft`);
    assert.ok(drafting.includes(t.name), `${t.name} is in a drafting token's list`);
    assert.ok(!toolsFor(["read"]).some((x) => x.name === t.name), `${t.name} isn't offered to a read-only token`);
    assert.deepEqual(annotationsFor(t), { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
    const props = (t.inputSchema as { properties: Record<string, unknown> }).properties;
    assert.ok(props.draft && props.source && props.source_key, `${t.name} takes draft, source and source_key`);
    assert.match(t.description, /yes|drafts/i, `${t.name} says it waits for the member`);
  }
});

test("no tool verifies, signs for the member, or deletes", () => {
  for (const t of MCP_TOOLS) assert.doesNotMatch(t.name, /verify|delete|remove|sign_milestone|review_milestone/, t.name);
  assert.ok(!isCardKind("verify") && !isCardKind("review"));
});

test("a project draft becomes Ember's project card, with only the app's topics", () => {
  const p = draftToProposal({ id: "d1", kind: "project", payload: { title: "Hopper", summary: "A hopper.", link: "https://github.com/b/h", tags: ["Aerospace", "Nope", "Mechanical Design"], status: "completed", year: "2026" } });
  assert.deepEqual(p, { id: "draft-d1", kind: "project", title: "Hopper", summary: "A hopper.", details: "", link: "https://github.com/b/h", tags: ["Aerospace", "Mechanical Design"], status: "completed", year: "2026", source: "GitHub" });
  assert.deepEqual(appTopics(["Aerospace", 3, "x", "Embedded Systems", "Mechanical Design", "Civil & Structural"]), ["Aerospace", "Embedded Systems", "Mechanical Design"]);
});

test("an edit keeps only the fields it changes, and what they replace", () => {
  const p = draftToProposal({ id: "d2", kind: "project_edit", payload: { project_id: "p1", project_title: "Stand", summary: "New.", specs: [{ label: "Thrust", value: "1.2 kN" }, { bad: 1 }], before: { summary: "Old.", details: "", link: "", specs: [] } } });
  assert.ok(p && p.kind === "project_edit");
  assert.equal(p.summary, "New.");
  assert.equal("details" in p, false);
  assert.deepEqual(p.specs, [{ label: "Thrust", value: "1.2 kN" }]);
  assert.equal(p.before.summary, "Old.");
});

test("a teammate draft is a member or a viewer, never anything else", () => {
  const p = draftToProposal({ id: "d3", kind: "teammate", payload: { project_id: "p1", project_title: "Stand", person_id: "u1", name: "Josh", headline: "", role: "admin" } });
  assert.ok(p && p.kind === "teammate" && p.role === "member");
});

test("posts and milestones keep their own card; unknown kinds have none", () => {
  for (const k of ["post", "milestone", "verify", ""]) assert.equal(draftToProposal({ id: "x", kind: k, payload: {} }), null, k);
});

test("tool arguments reach the database cleaned: project_edit sends only what was given", () => {
  assert.deepEqual(actionPayload("project_edit", { project_id: "p1", summary: "S", draft: true, source: "x" }), { project_id: "p1", summary: "S" });
  assert.deepEqual(actionPayload("project", { title: "T", summary: "S", tags: ["Aerospace", "<b>"] }).tags, ["Aerospace"]);
  assert.deepEqual(actionPayload("teammate", { project_id: "p1", person_id: "u1" }), { project_id: "p1", person_id: "u1", role: "member" });
});

test("every action says what's next and links it; drafts point to the drafts page", () => {
  assert.equal(nextStep("create_project", { drafted: true, duplicate: false }, O)!.open, `${O}/drafts`);
  assert.match(nextStep("add_teammate", { drafted: true, duplicate: true }, O)!.next, /nothing new was added/);
  const made = nextStep("create_project", { drafted: false, id: "p9", title: "Hopper", url: `${O}/projects/p9` }, O)!;
  assert.match(made.next, /log_milestone with project_id "p9"/);
  assert.equal(made.open, `${O}/projects/p9`);
  assert.match(nextStep("update_project", { drafted: false, title: "Stand", url: "/projects/p1", changed: ["summary", "specs"] }, O)!.next, /summary, specs/);
  assert.equal(nextStep("update_project", { drafted: false, title: "Stand", url: "/projects/p1", changed: [] }, O)!.open, `${O}/projects/p1`);
  assert.match(nextStep("add_teammate", { drafted: false, person: "Josh Menzies", title: "Stand", role: "viewer", url: "/projects/p1" }, O)!.next, /Josh Menzies is on "Stand" as a viewer/);
});

test("refusals about clubs and draft-only actions say how to fix them", () => {
  assert.match(withFix("They aren't in any of your clubs. Add people you don't share a club with from the project in Brazework."), /search/);
  assert.match(withFix("That one is always left as a draft: the member sends it from Brazework. Draft it instead."), /draft: true/);
});
