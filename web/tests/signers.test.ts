// Who can sign your work (lib/signers.ts): the ask form says it before you ask, instead of an error
// after. Mirrors the database rule (supabase/verification.sql): an officer of the club (moderator,
// admin or owner) who isn't you. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { signerNote, signersFor } from "@/lib/signers";

const rows = [
  { community_id: "a", uid: "me", role: "owner", first_name: "Josh", last_name: "Menzies" },
  { community_id: "a", uid: "ian", role: "admin", first_name: "Ian", last_name: "Coleman" },
  { community_id: "a", uid: "sam", role: "member", first_name: "Sam", last_name: "Roy" },
  { community_id: "a", uid: "kim", role: "helper", first_name: "Kim", last_name: "Lee" },
  { community_id: "b", uid: "me", role: "owner", first_name: "Josh", last_name: "Menzies" },
];

test("signers are the club's officers other than you; helpers and members can't sign", () => {
  const s = signersFor(rows, "me");
  assert.deepEqual(s.get("a"), ["Ian C."]);
  assert.deepEqual(s.get("b") ?? [], [], "you're the only officer: nobody can sign");
});

test("the note says who signs, or that nobody can yet and what to do", () => {
  assert.equal(signerNote("NSBE UHart", ["Ian C."]).ok, true);
  assert.match(signerNote("NSBE UHart", ["Ian C."]).text, /Ian C\. can sign this/);
  assert.match(signerNote("NSBE UHart", ["Ian C.", "Maya P.", "Dev S.", "Ana R."]).text, /Ian C\., Maya P\. and 2 more officers can sign this/);
  const none = signerNote("Agentic Engineering Group", []);
  assert.equal(none.ok, false);
  assert.match(none.text, /only officer/);
  assert.match(none.text, /can't sign your own work/);
});
