// Field playbooks and MCP workflows (docs/mcp-workflows.md): every field on the landing page has a
// playbook, every prompt adapts to what the token may do, the tools a token is offered follow its
// scopes, and the docs cover every field. Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { SAMPLES } from "@/components/projects/sample-models";
import { MCP_TOOLS, annotationsFor, scopeFlags, toolsFor } from "@/lib/mcp";
import { WORK_NOTE } from "@/lib/lanes";
import { LANES_NOTE, PLAYBOOKS, PROMPTS, WORK_RULES, defaultLane, laneFrom, laneSteps, playbookFor, playbookMarkdown, playbookUri, playbooksIndexMarkdown, promptText } from "@/lib/mcp-playbooks";

const ROOT = join(__dirname, "..", "..");

test("there's a playbook for each of the 20 fields the landing page shows, and no other", () => {
  const fields = SAMPLES.map((s) => s.field).sort();
  assert.equal(fields.length, 20);
  assert.deepEqual(PLAYBOOKS.map((p) => p.field).sort(), fields);
  assert.equal(new Set(PLAYBOOKS.map((p) => p.id)).size, 20, "ids are unique");
  for (const p of PLAYBOOKS) {
    assert.match(p.id, /^[a-z]+(-[a-z]+)*$/, `${p.field}: id is a slug`);
    assert.ok(p.tools.length >= 3, `${p.field}: at least 3 tools`);
    assert.ok(p.study.moments.length >= 2, `${p.field}: at least 2 studying moments`);
    assert.ok(p.study.moments.some((m) => m.becomes === "milestone"), `${p.field}: a studying milestone`);
    assert.ok(p.study.signers.length > 10, `${p.field}: who signs when studying`);
    assert.ok(p.work.moments.length >= 1 && p.work.moments.every((m) => m.becomes === "milestone"), `${p.field}: a working milestone`);
    assert.match(p.work.signers, /manager|lead|client|director|head|engineer of record|principal|conductor/, `${p.field}: someone at work signs`);
    assert.doesNotMatch(p.work.signers, /club|officers|TA\b|professor/, `${p.field}: no campus signers at work`);
  }
});

// Lanes (docs/superpowers/specs/2026-11-20-playbook-lanes-design.md): the lane belongs to the piece of
// work. A loosely typed lane still means the obvious one, and with none the default follows the rule
// Home already uses (lib/guide-steps.ts): a professional in no club is working.
test("lanes: loose words mean the obvious lane, and the default follows Home's rule", () => {
  // The words people actually use: "at work" is the product's own phrase, and an internship is work.
  for (const v of ["work", "Working", " WORK ", "professional", "at work", "for work", "job", "my job", "internship", "my employer", "a client project", "student job"]) assert.equal(laneFrom(v), "work", v);
  for (const v of ["study", "Studying", "student", "school", "a class project", "my club", "coursework"]) assert.equal(laneFrom(v), "study", v);
  for (const v of ["studio", "banana", "", undefined, null]) assert.equal(laneFrom(v), undefined, String(v));
  assert.equal(defaultLane("student", 0), "study");
  assert.equal(defaultLane("student", 3), "study");
  assert.equal(defaultLane("professional", 0), "work");
  assert.equal(defaultLane("professional", 2), undefined, "a professional in a club is asked");
  assert.equal(defaultLane(undefined, 0), undefined, "no account type yet: ask");
  assert.equal(playbookFor("Mechanical")!.work.moments[0].example, "Housing rev D released: 9 parts, down from 14, at the same load rating");
  assert.equal(playbookFor("Software")!.work.moments[0].example, "Checkout p95 latency down from 820 to 310 ms");
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

// The working rules are written once and repeated wherever an assistant can come in (a prompt, the
// playbook, the server's instructions), because most people type a command with no arguments or just talk.
test("the working rules, the lane steps and the note say what the spec fixes", () => {
  assert.equal(WORK_RULES.length, 7);
  const rules = WORK_RULES.join("\n");
  for (const re of [/employer allows/, /general terms/, /stays hidden/, /unless the project is private/, /never anyone on the Brazework project's team/, /Your last 90 days/, /don't claim anything logged from here is backed/, /Don't suggest a club/]) assert.match(rules, re);
  assert.doesNotMatch(rules, /post_update|draft_post|log_milestone|draft_milestone|request_signature/, "rules name no tool a token might lack");
  const steps = laneSteps();
  assert.match(steps, /account_type/);
  assert.match(steps, /Was this at work, or for school or a club\?/);
  assert.match(steps, /doesn't say/, "an older server with no account_type: ask");
  assert.match(steps, /student[\s\S]*don't ask/i, "a student account is never asked");
  assert.match(LANES_NOTE, /Working part/);
  assert.match(rules, /unless I name it/, "a club only when the member names it");
  assert.doesNotMatch(rules, /my_clubs shows/, "being in a club doesn't send work to it");
  // What the public guide says about work is an instruction to an assistant, not a lock: say so.
  assert.match(WORK_NOTE, /is told to ask whether your employer allows it/);
  assert.match(WORK_NOTE, /stays hidden until you show it/);
});

test("resources: each playbook has a studying part and a working part", () => {
  assert.match(playbooksIndexMarkdown(), /studying[\s\S]*working/i);
  for (const p of PLAYBOOKS) {
    const md = playbookMarkdown(p);
    const [study, work] = [md.indexOf("## If you're studying"), md.indexOf("## If you're working")];
    assert.ok(study > 0 && work > study, `${p.field}: both parts, studying first`);
    for (const m of p.study.moments) assert.ok(md.slice(study, work).includes(m.example), `${p.field}: studying moment`);
    for (const m of p.work.moments) assert.ok(md.slice(work).includes(m.example), `${p.field}: working moment`);
    assert.match(md.slice(work), /employer allows/, "the working part opens with the rules");
    assert.doesNotMatch(md.slice(study, work), /employer allows/);
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

// Lanes in the prompts. Three cases for every prompt that records work: the lane given as work, given
// as study, or not given (the normal case: most people type a command with no arguments).
const POST = scopeFlags(["read", "draft", "post"]), DRAFT = scopeFlags(["read", "draft"]), READ = scopeFlags(["read"]);
const RECORDS = ["start", "shipped", "result", "standup", "week", "setup"];
const at = (lane: string | undefined, name: string, s = POST, field = "Mechanical") => promptText(name, { field, ...(lane ? { lane } : {}) }, s)!;

test("working lane: the rules, the working example and signers, never a club first", () => {
  for (const n of RECORDS) for (const s of [POST, DRAFT, READ]) {
    assert.match(at("work", n, s), /employer allows/, `${n}: the employer question`);
    assert.doesNotMatch(at("work", n, s), /pick the club that saw it/, `${n}: no club first`);
    assert.doesNotMatch(at("work", n, s), /Was this at work/, `${n}: the lane was given, so it isn't asked`);
  }
  assert.match(at("work", "shipped"), /Housing rev D released/);
  assert.match(at("work", "shipped"), /manufacturing engineer/);
  assert.match(at("work", "result"), /log_milestone/, "a number at work is a hidden milestone");
  assert.doesNotMatch(at("work", "result"), /post_update|draft_post/);
  assert.match(at("work", "result", DRAFT), /draft_milestone/);
  assert.match(at("work", "week", DRAFT), /only on a private project/);
  assert.match(at("work", "standup"), /only on a private project/);
  assert.match(at("work", "setup"), /week/);
  assert.match(at("work", "week"), /\/review\?private=1/, "it leads to the review packet, hidden work ticked");
  assert.match(promptText("ask_signature", { field: "Mechanical", lane: "work" }, POST)!, /manufacturing engineer/);
  assert.match(at("work", "shipped", READ), /can only read/, "a read-only token still writes it out");
  assert.match(at("work", "shipped", POST, "basket weaving"), /employer allows/, "no playbook: the rules still apply");
  assert.match(at("Working", "shipped"), /Housing rev D released/, "a loosely typed lane still means work");
  // Work never goes to a club unless the member names one: not in the steps, and not through a rule.
  for (const n of ["start", "shipped", "result"]) assert.doesNotMatch(at("work", n), /my_clubs/, `${n}: no club lookup for work`);
});

test("studying lane: no employer question and no lane question", () => {
  for (const def of PROMPTS) for (const s of [POST, DRAFT, READ])
    assert.doesNotMatch(promptText(def.name, { field: "Mechanical", lane: "study" }, s)!, /employer allows|Was this at work/, def.name);
  assert.match(at("study", "shipped"), /pick the club that saw it/, "as today");
  assert.match(at("study", "shipped"), /Ran two hours under load without slipping/, "the studying example");
});

test("no lane (the normal case): the lane steps and the rules, in every prompt that records work", () => {
  for (const n of RECORDS) for (const s of [POST, DRAFT, READ]) {
    assert.match(at(undefined, n, s), /Was this at work, or for school or a club\?/, n);
    assert.match(at(undefined, n, s), /employer allows/, n);
  }
  assert.match(at("banana", "shipped"), /I said this was “banana”\. [\s\S]*Was this at work, or for school or a club\?/, "a lane it can't read is said back, and asked about");
  assert.doesNotMatch(at("internship", "shipped"), /Was this at work/, "an internship is work, so it isn't asked");
  assert.match(at("internship", "shipped"), /employer allows/);
  // With no lane the studying steps are there too, so the text says what changes when the answer is
  // Working: the rules win, and each command names the step they replace (found in review).
  for (const n of RECORDS) for (const s of [POST, DRAFT, READ]) assert.match(at(undefined, n, s), /If it's Working, the rules below win over any step/, n);
  for (const n of ["start", "shipped"]) assert.match(at(undefined, n), /If it's Working[^\n]*leave the club out/, `${n}: no club for work`);
  assert.match(at(undefined, "result"), /If it's Working[^\n]*milestone, not a post/);
  assert.match(at(undefined, "result", DRAFT), /If it's Working[^\n]*draft_milestone/);
  assert.match(at(undefined, "result", READ), /If it's Working[^\n]*can only read/);
  assert.match(at(undefined, "standup"), /If it's Working[^\n]*only if the project is private/);
  assert.match(at(undefined, "week"), /If it's Working[^\n]*milestones only/i);
  assert.match(at(undefined, "setup"), /If it's Working[^\n]*employer allows each tool/);
  for (const n of [...RECORDS, "ask_signature"]) assert.ok(PROMPTS.find((p) => p.name === n)!.arguments.some((a) => a.name === "lane" && !a.required), `${n} takes lane`);
  assert.ok(PROMPTS.find((p) => p.name === "ask_signature")!.arguments.some((a) => a.name === "field"), "ask_signature takes field");
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
  for (const p of PLAYBOOKS) assert.ok(doc.includes(p.work.moments[0].example), `docs: ${p.field}'s working moment`);
  for (const p of PLAYBOOKS) assert.ok(doc.includes(`Who signs at work: ${p.work.signers}`), `docs: who signs at work in ${p.field}`);
  assert.match(doc, /\| `lane` \|/, "docs: the lane argument");
  assert.match(doc, /Was this at work, or for school or a club\?/, "docs: how the lane is chosen");
  assert.doesNotMatch(doc, /shows on (your|their) profile once/, "docs: a logged milestone stays hidden until the member shows it");
  for (const t of ["draft_post", "draft_milestone", "request_signature", "/drafts"]) assert.ok(doc.includes(t), `docs: ${t}`);
  assert.ok(readFileSync(join(ROOT, "docs", "README.md"), "utf8").includes("mcp-workflows.md"), "linked from the docs index");
});

// Fixtures: every field's playbook through every prompt, for each kind of token. A prompt may only
// name tools that token is offered, so the assistant is never told to call something it can't.
test("every field × every prompt × every token names only tools that token has", () => {
  const scopes: [string, string[]][] = [["post", ["read", "draft", "post"]], ["draft", ["read", "draft"]], ["read", ["read"]]];
  const named = MCP_TOOLS.map((t) => t.name).filter((n) => n.includes("_"));
  for (const lane of [undefined, "study", "work"]) for (const p of PLAYBOOKS) for (const def of PROMPTS) for (const [label, sc] of scopes) {
    const text = promptText(def.name, { field: p.field, what: "the thing I finished", who: "Dr. Lee", ...(lane ? { lane } : {}) }, scopeFlags(sc));
    assert.ok(text && text.length > 80, `${def.name}/${p.id}/${label}/${lane ?? "no lane"} renders`);
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

test("standup: today's done, next and blocked, always saved as a draft, once a day", () => {
  const post = scopeFlags(["read", "draft", "post"]), draft = scopeFlags(["read", "draft"]), read = scopeFlags(["read"]);
  for (const s of [post, draft]) {
    const t = promptText("standup", { field: "Software" }, s)!;
    assert.match(t, /Done [\s\S]* Next [\s\S]* Blocked/);
    assert.match(t, /draft_post/);
    assert.match(t, /source_key “standup:<today's date as YYYY-MM-DD>”/);
    assert.doesNotMatch(t, /post_update/, "never posted directly, even by a token that can");
    assert.match(t, /Never invent/);
    assert.match(t, /confidential/);
  }
  assert.match(promptText("standup", { date: "2026-11-23" }, draft)!, /standup:2026-11-23/);
  assert.match(promptText("standup", { date: "next tuesday" }, draft)!, /for today/);
  assert.match(promptText("standup", {}, read)!, /can only read/);
});

// An assistant that never sees a prompt still reads the tools' descriptions, so they say where a
// milestone stays (hidden until the member shows it) and point to the playbook's working part.
test("the tools say where work stays, and which part of the playbook to read", () => {
  const d = (n: string) => MCP_TOOLS.find((t) => t.name === n)!.description;
  assert.match(d("me"), /account_type/);
  assert.match(d("me"), /Studying or Working/);
  for (const n of ["log_milestone", "draft_milestone"]) {
    assert.doesNotMatch(d(n), /shows on the member's profile only once/, `${n}: no longer claims it shows`);
    assert.match(d(n), /stays hidden/, `${n}: hidden until the member shows it`);
    assert.match(d(n), /Working part/, `${n}: points to the working part`);
  }
  assert.match(LANES_NOTE, /ask whether their employer allows/);
});

// When a command is fetched with no lane typed, the server knows who is asking (their account and
// clubs) and passes the lane it would start from. So a student's command carries no question at all,
// and someone who works and is in no club gets the working text as if they had said so. Only when the
// server can't tell (someone who works and is in a club; an older database) does the assistant ask.
test("the server picks the lane when it knows the member, and what the member typed still wins", () => {
  for (const n of RECORDS) for (const s of [POST, DRAFT, READ]) {
    const student = promptText(n, { field: "Mechanical" }, s, "study")!;
    assert.doesNotMatch(student, /Was this at work|employer allows|The rules for work/, `${n}: a student is never asked`);
    assert.match(student, /for an employer or a client[\s\S]*If you're working/, `${n}: an internship still has a way in`);
    assert.equal(promptText(n, { field: "Mechanical" }, s, "work"), promptText(n, { field: "Mechanical", lane: "work" }, s), `${n}: the working text, as if they had said so`);
  }
  assert.equal(promptText("ask_signature", { field: "Mechanical" }, POST, "work"), promptText("ask_signature", { field: "Mechanical", lane: "work" }, POST));
  assert.equal(promptText("shipped", { field: "Mechanical", lane: "work" }, POST, "study"), at("work", "shipped"), "typed Working beats a student account");
  assert.equal(promptText("shipped", { field: "Mechanical", lane: "study" }, POST, "work"), at("study", "shipped"), "typed Studying beats a working account");
  assert.match(promptText("shipped", { field: "Mechanical", lane: "banana" }, POST, "study")!, /I said this was “banana”[\s\S]*Was this at work/, "a lane it can't read is asked about, whatever the account");
  assert.match(promptText("shipped", { field: "Mechanical" }, POST, undefined)!, /Was this at work, or for school or a club\?/, "when the server can't tell, the assistant asks");
  assert.doesNotMatch(at("study", "shipped"), /for an employer or a client \(a job/, "typed Studying reads exactly as it always has");
  for (const n of ["career_fair", "club_week"]) assert.equal(promptText(n, {}, POST, "work"), promptText(n, {}, POST), `${n} has no lanes`);
});
