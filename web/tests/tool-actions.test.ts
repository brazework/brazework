// One set of actions behind AI tools (MCP) and Ember (lib/tool-actions.ts, supabase/tool-actions.sql):
// every action tool drafts with a drafting token and is offered with the right scope; a tool's draft
// becomes the Ember card that confirms it; arguments reach the database cleaned; every result says
// what's next. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MCP_TOOLS, annotationsFor, toolsFor } from "@/lib/mcp";
import { nextStep, withFix } from "@/lib/mcp-results";
import { CARD_KINDS, actionPayload, appTopics, draftToProposal, isCardKind } from "@/lib/tool-actions";
import { promptText } from "@/lib/mcp-playbooks";
import { findBuilders, talentAsk } from "@/lib/mcp-talent";
import { buildBuilders, rankBuilders, type Person, type VerifiedRow } from "@/lib/talent";

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
    assert.ok(props.source && props.source_key, `${t.name} takes source and source_key`);
    assert.equal(!!props.draft, !t.draftOnly, `${t.name}: a draft switch unless it's always a draft`);
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

test("RSVP: a draft becomes Ember's RSVP card (going or taking it back); the tool sends going as a boolean", () => {
  const go = draftToProposal({ id: "r1", kind: "rsvp", payload: { event_id: "ev1", title: "Build night", starts_at: "2026-11-20T23:00:00Z", where: "Hangar", going: 4, cancel: false } });
  assert.deepEqual(go, { id: "draft-r1", kind: "rsvp", event_id: "ev1", title: "Build night", starts_at: "2026-11-20T23:00:00Z", where: "Hangar", going: 4, cancel: false });
  const back = draftToProposal({ id: "r2", kind: "rsvp", payload: { event_id: "ev1", cancel: true } });
  assert.ok(back && back.kind === "rsvp" && back.cancel === true);
  assert.deepEqual(actionPayload("rsvp", { event_id: "ev1" }), { event_id: "ev1", going: true });
  assert.deepEqual(actionPayload("rsvp", { event_id: "ev1", going: false }), { event_id: "ev1", going: false });
  const yes = nextStep("rsvp_event", { drafted: false, status: "going", title: "Build night", host: "Rocketry Club", starts_at: "2026-11-20T23:00:00Z", url: "/events/ev1" }, O)!;
  assert.match(yes.next, /going to "Build night" \(Fri, 20 Nov 2026 23:00 UTC\), hosted by Rocketry Club/);
  assert.equal(yes.open, `${O}/events/ev1`);
  assert.match(nextStep("rsvp_event", { drafted: false, status: "not going", title: "Build night", url: "/events/ev1" }, O)!.next, /given back/);
});

test("clubs and messages: join, invite and message drafts become Ember's cards; replies are always drafts", () => {
  assert.deepEqual(draftToProposal({ id: "j", kind: "join", payload: { club_id: "rkt", club_name: "Rocketry Club", privacy: "approval" } }), { id: "draft-j", kind: "join", club_id: "rkt", club_name: "Rocketry Club", privacy: "approval" });
  assert.deepEqual(draftToProposal({ id: "i", kind: "invite", payload: { code: "0123456789abcdef", club_id: "sec", club_name: "Secret" } }), { id: "draft-i", kind: "invite", code: "0123456789abcdef", club_id: "sec", club_name: "Secret" });
  const m = draftToProposal({ id: "m", kind: "message", payload: { person_id: "u1", name: "Josh", headline: "", body: "Sure." } });
  assert.ok(m && m.kind === "message" && m.body === "Sure." && !m.accepts);
  const r = draftToProposal({ id: "m2", kind: "message", payload: { person_id: "u1", name: "Josh", body: "Sure.", conversation_id: "c1", accepts_request: true } });
  assert.ok(r && r.kind === "message" && r.accepts?.conversation_id === "c1", "a reply to a request says it accepts it");
  assert.deepEqual(actionPayload("invite", { invite: "https://brazework.com/join/0123456789abcdef" }), { code: "https://brazework.com/join/0123456789abcdef" });
  assert.deepEqual(actionPayload("message", { conversation_id: "c1", body: "Hi" }), { conversation_id: "c1", body: "Hi" });
  const reply = MCP_TOOLS.find((t) => t.name === "draft_reply")!;
  assert.equal(reply.draftOnly, true);
  assert.match(nextStep("draft_reply", { drafted: true }, O)!.next, /press Confirm to send it/);
  assert.match(nextStep("join_club", { drafted: false, status: "requested", title: "Secret", id: "sec", url: "/c/sec" }, O)!.next, /moderators approve/);
  assert.match(nextStep("accept_invite", { drafted: false, status: "joined", title: "Secret", id: "sec", url: "/c/sec" }, O)!.next, /in Secret/);
  assert.equal(MCP_TOOLS.find((t) => t.name === "my_inbox")!.needs, undefined, "my_inbox only reads");
});

test("officers: event and announcement drafts become Ember's cards; both are always drafts; the brief only reads", () => {
  const e = draftToProposal({ id: "e", kind: "event", payload: { club_id: "rkt", club_name: "Rocketry Club", title: "Static fire", type: "Workshop", format: "In person", location: "", topic: "Aerospace", starts_at: "2026-12-03T23:00:00Z", ends_at: "2026-12-04T01:00:00Z", description: "" } });
  assert.ok(e && e.kind === "event" && e.title === "Static fire" && e.ends_at === "2026-12-04T01:00:00Z");
  const odd = draftToProposal({ id: "e2", kind: "event", payload: { club_id: "rkt", title: "x", topic: "Rocketry", starts_at: "2026-12-03T23:00:00Z", ends_at: "2026-12-04T01:00:00Z" } });
  assert.ok(odd && odd.kind === "event" && odd.topic === "", "a club topic that isn't one of the app's is left out, as Ember does (the event form refuses it)");
  const a = draftToProposal({ id: "a", kind: "club_post", payload: { club_id: "rkt", club_name: "Rocketry Club", body: "Build night moves to Thursday." } });
  assert.deepEqual(a, { id: "draft-a", kind: "club_post", club_id: "rkt", club_name: "Rocketry Club", body: "Build night moves to Thursday.", postKind: "update" });
  for (const n of ["draft_event", "draft_announcement"]) assert.equal(MCP_TOOLS.find((t) => t.name === n)!.draftOnly, true, n);
  assert.equal(MCP_TOOLS.find((t) => t.name === "club_brief")!.needs, undefined);
  assert.deepEqual(actionPayload("event", { club_id: "rkt", title: "T", starts_at: "2026-12-03T18:00:00-05:00", draft: true }), { club_id: "rkt", title: "T", starts_at: "2026-12-03T18:00:00-05:00" });
  assert.match(nextStep("draft_event", { drafted: true }, O)!.next, /publish it to the club/);
  assert.match(withFix("Only a club's admins and owner can host its events. my_clubs shows your role in each."), /draft_announcement/);
});

test("club_week: a meeting plan offers to draft the meeting; a read token writes it out; nobody is told to verify", () => {
  const draft = promptText("club_week", { what: "meeting plan" }, { canDraft: true, canPost: false })!;
  assert.match(draft, /club_brief/);
  assert.match(draft, /draft_announcement/);
  assert.match(draft, /draft_event/);
  assert.match(draft, /Don't verify/);
  const read = promptText("club_week", {}, { canDraft: false, canPost: false })!;
  assert.doesNotMatch(read, /draft_/);
  assert.match(read, /this week's update/);
  assert.match(promptText("club_week", { what: "recap" }, { canDraft: true, canPost: true })!, /recap of the club's last week/);
});

test("find_builders ranks exactly as /talent does, by club name or id, and labels backed work", () => {
  const row = (id: string, owner: string, club: string | null, title: string, extra: Partial<VerifiedRow> = {}): VerifiedRow => ({ id, owner_id: owner, community_id: club, community_name: club === "rkt" ? "Rocketry Club" : "Robotics", title, reviewer_name: "Maya Patel", reviewer_role: "Officer", reviewed_at: "2026-11-01T00:00:00Z", projects: { title: "Stand", tags: ["Aerospace"], tools: ["STM32"] }, ...extra });
  const people: Person[] = [{ id: "u1", first_name: "Ben", last_name: "Cho", headline: "Avionics", field: "Aerospace", open_to: ["internships"], grad_year: 2027 }, { id: "u2", first_name: "Ann", last_name: "Lee", headline: "", field: "Mechanical", grad_year: 2026 }];
  const rows = [row("m1", "u1", "rkt", "Static fire"), row("m2", "u1", "rkt", "Recovery test"), row("m3", "u2", "rob", "Arm v2"), row("m4", "u2", null, "Gimbal", { backed: true, backing: { kind: "commit", repo_full_name: "a/b", ref: "abc1234" } })];
  const data = { org: { name: "Acme", type: "company" }, rows, people };
  const ask = talentAsk({ query: "STM32" });
  const r = findBuilders(data, ask);
  assert.deepEqual(r.builders.map((b) => b.name), rankBuilders(buildBuilders(rows, people), { q: "STM32", min: 1, year: 0, club: "", openTo: "", backed: false }).map((b) => `${b.person.first_name} ${b.person.last_name}`), "the same order as /talent");
  assert.equal(r.builders[0].name, "Ben Cho");
  assert.equal(r.builders[0].url, "/u/u1");
  assert.deepEqual(findBuilders(data, talentAsk({ club: "Rocketry Club" })).builders.map((b) => b.name), ["Ben Cho"], "a club by name");
  assert.equal(findBuilders(data, talentAsk({ club: "No such club" })).total, 0);
  assert.deepEqual(findBuilders(data, talentAsk({ class_year: 2026 })).builders.map((b) => b.name), ["Ann Lee"]);
  const withBacked = findBuilders(data, talentAsk({ query: "gimbal", level: "signed_or_backed" }));
  assert.equal(withBacked.builders[0].work.find((w) => w.title === "Gimbal")?.level, "backed by GitHub, not signed");
  assert.equal(findBuilders(data, talentAsk({ query: "gimbal" })).total, 0, "signed only by default");
  assert.equal(talentAsk({ class_year: "2027", min_signed: 99 }).min_signed, 20);
});

test("follow: the last Ember card a tool couldn't reach; career_fair asks before each write and names only the token's tools", () => {
  assert.deepEqual(draftToProposal({ id: "f", kind: "follow", payload: { person_id: "u1", name: "Cara Diaz", headline: "" } }), { id: "draft-f", kind: "follow", person_id: "u1", name: "Cara Diaz", headline: "" });
  const post = promptText("career_fair", { event: "Spring Engineering Career Fair" }, { canDraft: true, canPost: true })!;
  for (const t of ["upcoming_events", "my_projects", "request_signature", "my_resume", "rsvp_event"]) assert.match(post, new RegExp(t), t);
  assert.match(post, /only after my yes/);
  const draft = promptText("career_fair", {}, { canDraft: true, canPost: false })!;
  assert.doesNotMatch(draft, /request_signature/);
  assert.match(draft, /waits as a card/);
  assert.doesNotMatch(promptText("career_fair", {}, { canDraft: false, canPost: false })!, /rsvp_event|request_signature/);
});
