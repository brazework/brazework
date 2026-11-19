// Field playbooks and MCP workflows (docs/mcp-workflows.md): every field on the landing page has a
// playbook, every prompt adapts to what the token may do, the tools a token is offered follow its
// scopes, and the docs cover every field. Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { SAMPLES } from "@/components/projects/sample-models";
import { MCP_TOOLS, annotationsFor, scopeFlags, toolsFor } from "@/lib/mcp";
import { PLAYBOOKS, PROMPTS, playbookFor, playbookMarkdown, playbookUri, playbooksIndexMarkdown, promptText } from "@/lib/mcp-playbooks";

const ROOT = join(__dirname, "..", "..");

test("there's a playbook for each of the 20 fields the landing page shows, and no other", () => {
  const fields = SAMPLES.map((s) => s.field).sort();
  assert.equal(fields.length, 20);
  assert.deepEqual(PLAYBOOKS.map((p) => p.field).sort(), fields);
  assert.equal(new Set(PLAYBOOKS.map((p) => p.id)).size, 20, "ids are unique");
  for (const p of PLAYBOOKS) {
    assert.match(p.id, /^[a-z]+(-[a-z]+)*$/, `${p.field}: id is a slug`);
    assert.ok(p.tools.length >= 3, `${p.field}: at least 3 tools`);
    assert.ok(p.moments.length >= 2, `${p.field}: at least 2 moments`);
    assert.ok(p.moments.some((m) => m.becomes === "milestone"), `${p.field}: at least one milestone moment`);
    assert.ok(p.signers.length > 10, `${p.field}: who signs`);
  }
});

test("playbooks don't claim integrations that don't exist (checked November 2026)", () => {
  const all = PLAYBOOKS.flatMap((p) => p.tools);
  const status = (name: string) => [...new Set(all.filter((t) => t.name === name).map((t) => t.connect))];
  assert.deepEqual(status("SPSS"), ["files"], "SPSS has no MCP server");
  assert.deepEqual(status("Onshape"), ["community"], "Onshape's official server only writes FeatureScript");
  assert.deepEqual(status("Adobe Premiere"), ["files"], "Adobe's desktop servers are only previewed");
  for (const t of all.filter((x) => x.name === "PubMed")) assert.match(t.reads, /Anthropic/, "the PubMed server is Anthropic's connector");
  for (const name of ["KiCad", "SolidWorks", "ROS 2", "Overleaf", "Zotero", "Lean 4"]) assert.deepEqual(status(name), ["community"], `${name} has no vendor server`);
  for (const name of ["GitHub", "Weights & Biases", "MATLAB", "Figma", "Stripe"]) assert.deepEqual(status(name), ["official"], `${name} runs its own`);
});

test("playbookFor finds a field by id or name, forgivingly, and nothing for nonsense", () => {
  assert.equal(playbookFor("data-ai")?.field, "Data & AI");
  assert.equal(playbookFor("Data & AI")?.id, "data-ai");
  assert.equal(playbookFor("data and ai")?.id, "data-ai");
  assert.equal(playbookFor("computer science")?.id, "computer-science");
  assert.equal(playbookFor("Mechanical Engineering")?.id, "mechanical");
  assert.equal(playbookFor("basket weaving"), undefined);
  assert.equal(playbookFor(""), undefined);
});

test("resources: an index that links every playbook, and markdown for each", () => {
  const index = playbooksIndexMarkdown();
  for (const p of PLAYBOOKS) {
    assert.ok(index.includes(playbookUri(p)), `index links ${p.field}`);
    const md = playbookMarkdown(p);
    assert.ok(md.startsWith(`# ${p.field}`));
    for (const t of p.tools) assert.ok(md.includes(t.name));
    assert.match(md, /never posts without the member's yes/);
  }
});

test("prompts adapt to the token: post shows it and waits for yes; draft leaves a draft; read writes it out", () => {
  const post = { canPost: true, canDraft: true }, draft = { canPost: false, canDraft: true }, read = { canPost: false, canDraft: false };
  for (const def of PROMPTS) for (const s of [post, draft, read]) assert.ok(promptText(def.name, { field: "Mechanical" }, s), `${def.name} renders`);
  const shipped = (s: typeof post) => promptText("shipped", { field: "Software", what: "merged the arrival-times PR" }, s)!;
  assert.match(shipped(post), /wait for my yes. Then call log_milestone/);
  assert.match(shipped(draft), /Save it with draft_milestone/);
  assert.doesNotMatch(shipped(draft), /call log_milestone/);
  assert.match(shipped(read), /can only read/);
  assert.match(shipped(post), /merged the arrival-times PR/);
  assert.match(shipped(post), /brazework:\/\/playbooks\/software/);
  assert.match(promptText("result", { field: "Business" }, post)!, /post_update/);
  assert.match(promptText("week", {}, draft)!, /source_key/);
  assert.match(promptText("week", {}, read)!, /can only read/);
  assert.match(promptText("ask_signature", {}, draft)!, /can't send asks/);
  assert.match(promptText("ask_signature", { who: "Dr. Lee" }, post)!, /request_signature/);
  assert.match(promptText("setup", { field: "basket weaving" }, post)!, /isn't one Brazework has a playbook for/);
  assert.equal(promptText("nope", {}, post), null);
});

test("tools follow scopes: read gets reads only, draft adds drafts, post adds everything", () => {
  const names = (scopes: string[]) => toolsFor(scopes).map((t) => t.name);
  const reads = MCP_TOOLS.filter((t) => !t.needs).map((t) => t.name);
  assert.deepEqual(names(["read"]), reads);
  assert.ok(toolsFor(["read"]).every((t) => annotationsFor(t).readOnlyHint === true), "a read token's tools are all read-only");
  // Actions shared with Ember (supabase/tool-actions.sql) draft with a drafting token and act with a posting one.
  const acts = MCP_TOOLS.filter((t) => t.act).map((t) => t.name);
  assert.deepEqual(names(["read", "draft"]).filter((n) => !reads.includes(n)).sort(), ["draft_milestone", "draft_post", ...acts].sort());
  assert.deepEqual(names(["read", "post"]).filter((n) => !reads.includes(n)).sort(), ["draft_milestone", "draft_post", "drop_goal", "log_milestone", "post_update", "reach_goal", "request_signature", "set_goal", ...acts].sort());
  for (const t of toolsFor(["read", "draft", "post"]).filter((x) => x.needs)) assert.equal(annotationsFor(t).destructiveHint, false, `${t.name} only adds`);
  assert.deepEqual(scopeFlags(["read", "post"]), { canPost: true, canDraft: true }, "an older post token can draft");
});

test("draft tools carry the live tool's fields plus where they came from", () => {
  const tool = (n: string) => MCP_TOOLS.find((t) => t.name === n)!;
  const props = (n: string) => Object.keys((tool(n).inputSchema as { properties: object }).properties);
  assert.deepEqual(props("draft_milestone"), [...props("log_milestone"), "source", "source_key"]);
  assert.deepEqual(props("draft_post"), [...props("post_update"), "source", "source_key"]);
  const a = tool("draft_milestone").args({ project_id: "p1", title: "Merged", evidence: ["https://github.com/a/b/pull/1"], source: "GitHub Actions", source_key: " github:a/b#1 " });
  assert.equal(a.p_club, null, "no club: it waits for a signature");
  assert.equal(a.p_source_key, "github:a/b#1");
  assert.deepEqual((tool("log_milestone").inputSchema as { required: string[] }).required, ["project_id", "title", "evidence"], "the club is optional");
  const sig = tool("request_signature").args({ milestone_id: "m9", email: " Prof.Lee@UTexas.edu ", relationship: "professor" });
  assert.deepEqual(sig, { p_milestone: "m9", p_email: "prof.lee@utexas.edu", p_relationship: "professor" });
});

test("docs/mcp-workflows.md covers every field, every prompt and the drafts and signature tools", () => {
  const doc = readFileSync(join(ROOT, "docs", "mcp-workflows.md"), "utf8");
  for (const p of PLAYBOOKS) assert.ok(doc.includes(`### ${p.field}`), `docs: a section for ${p.field}`);
  for (const p of PROMPTS) assert.ok(doc.includes(p.name), `docs: the ${p.name} prompt`);
  for (const t of ["draft_post", "draft_milestone", "request_signature", "/drafts"]) assert.ok(doc.includes(t), `docs: ${t}`);
  assert.ok(readFileSync(join(ROOT, "docs", "README.md"), "utf8").includes("mcp-workflows.md"), "linked from the docs index");
});

// Fixtures: every field's playbook through every prompt, for each kind of token. A prompt may only
// name tools that token is offered, so the assistant is never told to call something it can't.
test("every field × every prompt × every token names only tools that token has", () => {
  const scopes: [string, string[]][] = [["post", ["read", "draft", "post"]], ["draft", ["read", "draft"]], ["read", ["read"]]];
  const named = MCP_TOOLS.map((t) => t.name).filter((n) => n.includes("_"));
  for (const p of PLAYBOOKS) for (const def of PROMPTS) for (const [label, sc] of scopes) {
    const text = promptText(def.name, { field: p.field, what: "the thing I finished", who: "Dr. Lee" }, scopeFlags(sc));
    assert.ok(text && text.length > 80, `${def.name}/${p.id}/${label} renders`);
    const offered = new Set(toolsFor(sc).map((t) => t.name));
    for (const n of named) if (new RegExp(`\\b${n}\\b`).test(text!)) assert.ok(offered.has(n), `${def.name}/${p.id}/${label} names ${n}, which a ${label} token doesn't have`);
    if (def.arguments?.some((a) => a.name === "field")) assert.ok(text!.includes(playbookUri(p)), `${def.name}/${p.id} points to its playbook`);
  }
});

test("start: the first minute finds real finished work and ends with the link", () => {
  const post = scopeFlags(["read", "draft", "post"]), draft = scopeFlags(["read", "draft"]);
  const t = promptText("start", { field: "Data & AI" }, post)!;
  assert.match(t, /my_projects/);
  assert.match(t, /last 30 days/);
  assert.match(t, /request_signature/);
  assert.match(t, /link from the result/);
  assert.match(promptText("start", {}, draft)!, /Call me first/);
  assert.doesNotMatch(promptText("start", { field: "Data & AI" }, draft)!, /request_signature/);
  assert.equal(PROMPTS[0].name, "start", "start is listed first");
});
