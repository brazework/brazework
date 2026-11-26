// Jig asks a person to sign (Linear FIX-216), tested on the real tool code with a database that
// refuses every write:
//  - a new milestone needs a real https proof link, never an invented one;
//  - the signer's email is only ever what the member gave: a made-up or malformed one is dropped,
//    and the card still shows so the member types it;
//  - a milestone that is already waiting can be asked about; one that isn't the member's, or isn't
//    waiting, can't;
//  - nothing is saved or sent by the tool: the member confirms the card.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOL_LABEL, type Proposal } from "@/lib/copilot-agent";
import { TOOLS, makeExec } from "@/lib/copilot-tools";

const ME = "00000000-0000-0000-0000-000000000001";
type Sig = Extract<Proposal, { kind: "signature" }>;

function readOnlyDb(milestone: Record<string, unknown> | null = null) {
  const writes: string[] = [];
  const fixture = (table: string) => (table === "projects" ? { title: "Checkout" } : table === "milestones" ? milestone : {});
  const builder = (table: string): unknown => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "in", "or", "order", "limit"]) b[m] = () => b;
    for (const m of ["insert", "update", "delete", "upsert"]) b[m] = () => { writes.push(`${m} ${table}`); throw new Error(`WRITE ATTEMPT: ${m} on ${table}`); };
    b.maybeSingle = async () => ({ data: fixture(table), error: null });
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [fixture(table)], error: null }).then(ok);
    return b;
  };
  const db = { from: (t: string) => builder(t), rpc: (name: string) => { writes.push(`rpc ${name}`); throw new Error(`WRITE ATTEMPT: rpc ${name}`); } };
  return { db: db as never, writes };
}
const run = async (args: Record<string, unknown>, milestone: Record<string, unknown> | null = null) => {
  const { db, writes } = readOnlyDb(milestone);
  const cards: Proposal[] = [];
  const result = (await makeExec(db, ME, (p) => cards.push(p))("propose_signature", args)) as { error?: string; shown_to_member?: boolean };
  return { result, cards: cards as Sig[], writes };
};
const NEW = { project_id: "p1", title: "Checkout p95 down to 310 ms", evidence: "https://github.com/acme/checkout/pull/1187" };

test("the tool is offered, labelled, and says it waits for the member", () => {
  const t = TOOLS.find((x) => x.name === "propose_signature");
  assert.ok(t, "propose_signature is offered");
  assert.match(String(t.description), /NOT sent until they confirm/);
  assert.match(String(t.description), /never guess/i);
  assert.ok(TOOL_LABEL.propose_signature);
});

test("a new milestone becomes one card, and nothing is written", async () => {
  const { result, cards, writes } = await run({ ...NEW, email: " Sam.Rivera@Northwind.example ", relationship: "manager", detail: "Before and after on the dashboard", achieved_on: "2026-11-18" });
  assert.equal(result.shown_to_member, true);
  assert.deepEqual(writes, []);
  assert.equal(cards.length, 1);
  const { id, ...card } = cards[0];
  assert.ok(id);
  assert.deepEqual(card, { kind: "signature", milestone_id: "", project_id: "p1", project_title: "Checkout", title: NEW.title, evidence: NEW.evidence, detail: "Before and after on the dashboard", achieved_on: "2026-11-18", email: "sam.rivera@northwind.example", relationship: "manager" });
});

test("a new milestone needs a real proof link", async () => {
  for (const evidence of [undefined, "", "the dashboard", "http://insecure.example.com/x", "javascript:alert(1)"]) {
    const { result, cards } = await run({ ...NEW, evidence });
    assert.match(result.error ?? "", /needs evidence/i, `evidence ${String(evidence)} must be refused`);
    assert.equal(cards.length, 0);
  }
});

test("the signer's email is the member's or nothing; the relationship is one the database knows", async () => {
  for (const email of [undefined, "", "sam", "sam@", "sam at northwind", "sam@northwind", `${"a".repeat(250)}@x.io`]) {
    const { cards } = await run({ ...NEW, email });
    assert.equal(cards.length, 1, "the card still shows, for the member to type the address");
    assert.equal(cards[0].email, "", `"${String(email)}" is dropped, not kept`);
  }
  assert.equal((await run({ ...NEW, relationship: "tech lead" })).cards[0].relationship, "other");
  assert.equal((await run(NEW)).cards[0].relationship, "other");
  assert.equal((await run({ ...NEW, relationship: "pi" })).cards[0].relationship, "pi");
});

test("a milestone already waiting can be asked about, with its own words", async () => {
  const waiting = { id: "m1", project_id: "p1", title: "Thrust stand reads within 2%", detail: "Against reference weights", evidence: "https://github.com/acme/rig/pull/9", achieved_on: "2026-11-02", status: "draft" };
  // Whatever else Jig passes about the milestone is ignored: the card shows what is on the record.
  const { cards, writes } = await run({ milestone_id: "m1", title: "Something else", evidence: "https://evil.example/x", email: "dr.ruiz@stateu.edu", relationship: "professor" }, waiting);
  assert.deepEqual(writes, []);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].milestone_id, "m1");
  assert.equal(cards[0].title, "Thrust stand reads within 2%");
  assert.equal(cards[0].evidence, "https://github.com/acme/rig/pull/9");
  assert.equal(cards[0].email, "dr.ruiz@stateu.edu");
  assert.equal((await run({ milestone_id: "m1" }, { ...waiting, status: "pending" })).cards.length, 1);
});

test("a milestone that isn't theirs, or isn't waiting, can't be asked about", async () => {
  const none = await run({ milestone_id: "m9" }, null);
  assert.match(none.result.error ?? "", /isn't one of the member's milestones/);
  assert.equal(none.cards.length, 0);
  for (const status of ["verified", "logged", "declined", "revoked"]) {
    const r = await run({ milestone_id: "m1" }, { id: "m1", project_id: "p1", title: "x", status });
    assert.match(r.result.error ?? "", /isn't waiting for proof/, status);
    assert.equal(r.cards.length, 0);
  }
  assert.match((await run({ milestone_id: "not an id!" })).result.error ?? "", /open_milestones/);
});

test("with no project, Jig is told to make one first", async () => {
  const r = await run({ title: NEW.title, evidence: NEW.evidence });
  assert.match(r.result.error ?? "", /propose_project first/);
  assert.equal(r.cards.length, 0);
});
