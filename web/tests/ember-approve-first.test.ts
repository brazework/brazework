// Torch's hard rules, tested on the real tool code with a database that refuses every write:
//  - Torch never writes: propose_* tools only hand a draft card to the UI; the member taps Approve,
//    and the app's normal server action (with its own checks) does the saving.
//  - Torch never verifies a milestone: no review tool is offered, and calling one is refused.
//  - Milestone drafts need real evidence (an https link the member gave), never invented.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { OFFER_CHOICES, TOOLS, makeExec } from "@/lib/copilot-tools";
import type { Choice, Proposal } from "@/lib/copilot-agent";

const ME = "00000000-0000-0000-0000-000000000001";

// A Supabase client stand-in: reads return small fixtures; any write throws.
function readOnlyDb() {
  const writes: string[] = [];
  const fixture = (table: string) => {
    if (table === "projects") return { title: "Fin test rig" };
    if (table === "community_members") return { communities: { name: "Rocketry Club" }, role: "member" };
    if (table === "profiles") return { id: ME, first_name: "Ben", last_name: "Cho" };
    if (table === "communities") return { id: "rkt", name: "Rocketry Club", privacy: "public" };
    if (table === "events") return { id: "e1", title: "Build night", status: "published", starts_at: new Date(Date.now() + 864e5).toISOString() };
    return {};
  };
  const builder = (table: string): unknown => {
    const done = { data: [fixture(table)], error: null };
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "in", "or", "ilike", "order", "limit", "gt", "gte", "lt", "lte", "contains", "overlaps", "is", "not", "match", "filter", "range"]) b[m] = () => b;
    for (const m of ["insert", "update", "delete", "upsert"]) b[m] = () => { writes.push(`${m} ${table}`); throw new Error(`WRITE ATTEMPT: ${m} on ${table}`); };
    b.maybeSingle = async () => ({ data: fixture(table), error: null });
    b.single = async () => ({ data: fixture(table), error: null });
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(done).then(ok);
    return b;
  };
  const db = {
    from: (t: string) => builder(t),
    rpc: (name: string) => { writes.push(`rpc ${name}`); throw new Error(`WRITE ATTEMPT: rpc ${name}`); },
  };
  return { db: db as never, writes };
}

const proposeTools = TOOLS.map((t) => t.name).filter((n) => n.startsWith("propose_"));

test("Torch is never offered a way to verify a milestone", () => {
  assert.ok(!TOOLS.some((t) => t.name === "propose_review"), "propose_review must not be offered");
  for (const t of TOOLS) assert.doesNotMatch(String(t.description), /verify-or-decline/i);
});

test("every propose_* tool says nothing happens until the member confirms", () => {
  assert.ok(proposeTools.length >= 8);
  for (const name of proposeTools) {
    const d = String(TOOLS.find((t) => t.name === name)!.description);
    assert.match(d, /NOT|until/i, `${name} must say it waits for confirmation`);
  }
});

test("propose_* tools never write; they only hand over a card", async () => {
  const args: Record<string, Record<string, unknown>> = {
    propose_post: { body: "Static fire went clean", kind: "result" },
    propose_milestone: { project_id: "p1", club_id: "rkt", title: "Passed load test", evidence: "https://github.com/josh/rig/commit/abc123" },
    propose_signature: { project_id: "p1", title: "Checkout p95 down to 310 ms", evidence: "https://github.com/acme/checkout/pull/1187", email: "sam@northwind.example", relationship: "manager" },
    propose_join_club: { club_id: "rkt" },
    propose_rsvp: { event_id: "e1" },
    propose_message: { person_id: ME, body: "Hi Ben" },
    propose_follow: { person_id: ME },
    propose_event: { club_id: "rkt", title: "Build night", starts_at: new Date(Date.now() + 864e5).toISOString(), format: "In person", type: "Workshop" },
    propose_club_post: { club_id: "rkt", body: "This week: 3 milestones verified" },
    propose_project: { title: "Fin test rig", summary: "Wind tunnel for fins" },
  };
  for (const name of proposeTools) {
    const { db, writes } = readOnlyDb();
    const cards: Proposal[] = [];
    await makeExec(db, ME, (p) => cards.push(p))(name, args[name] ?? {}).catch((e: Error) => assert.doesNotMatch(e.message, /WRITE ATTEMPT/, `${name} tried to write`));
    assert.deepEqual(writes, [], `${name} must not write (got ${writes.join(", ")})`);
    assert.ok(cards.length <= 1, `${name} hands over at most one card`);
  }
});

test("calling a review tool anyway is refused, and nothing is verified", async () => {
  const { db, writes } = readOnlyDb();
  const cards: Proposal[] = [];
  const r = (await makeExec(db, ME, (p) => cards.push(p))("propose_review", { milestone_id: "m1", verify: true })) as { error?: string };
  assert.match(r.error ?? "", /doesn't verify/i);
  assert.equal(cards.length, 0);
  assert.deepEqual(writes, []);
});

test("milestone drafts need real evidence", async () => {
  const { db } = readOnlyDb();
  const cards: Proposal[] = [];
  const exec = makeExec(db, ME, (p) => cards.push(p));
  for (const evidence of [undefined, "", "not a link", "http://insecure.example.com/x", "javascript:alert(1)"]) {
    const r = (await exec("propose_milestone", { project_id: "p1", club_id: "rkt", title: "Passed load test", evidence })) as { error?: string };
    assert.match(r.error ?? "", /needs evidence/i, `evidence ${String(evidence)} must be refused`);
  }
  assert.equal(cards.length, 0);
  await exec("propose_milestone", { project_id: "p1", club_id: "rkt", title: "Passed load test", evidence: "https://youtu.be/abc" });
  assert.equal(cards.length, 1);
  assert.equal((cards[0] as { evidence?: string }).evidence, "https://youtu.be/abc");
});

test("offering answers as buttons never writes: it only hands the buttons to the page", async () => {
  const { db, writes } = readOnlyDb();
  const choices: Choice[] = [];
  const cards: Proposal[] = [];
  const exec = makeExec(db, ME, (p) => cards.push(p), (c) => choices.push(c));
  const r = (await exec("offer_choices", { options: ["Rocketry Club", "A person who saw it"] })) as { shown_to_member?: boolean };
  assert.equal(r.shown_to_member, true);
  assert.deepEqual(choices.map((c) => c.options), [["Rocketry Club", "A person who saw it"]]);
  assert.equal(cards.length, 0);
  const bad = (await exec("offer_choices", { options: ["Only one"] })) as { error?: string };
  assert.ok(bad.error, "fewer than two answers is refused");
  assert.equal(choices.length, 1);
  assert.deepEqual(writes, []);
  assert.match(String(OFFER_CHOICES.description), /Nothing is saved/);
});

test("a card's next step is kept only where the page carries on, and still nothing is written", async () => {
  const args = { body: "Static fire went clean", kind: "result", then: "post it in the club too" };
  for (const carryOn of [true, false]) {
    const { db, writes } = readOnlyDb();
    const cards: Proposal[] = [];
    await makeExec(db, ME, (p) => cards.push(p), () => {}, { carryOn })("propose_post", args);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].then, carryOn ? "post it in the club too" : undefined);
    assert.deepEqual(writes, []);
  }
  for (const t of TOOLS.filter((t) => t.name.startsWith("propose_"))) {
    assert.ok((t.input_schema.properties as Record<string, unknown>).then, `${t.name} can say what comes next`);
  }
});
