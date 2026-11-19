// What MCP tools say back (lib/mcp-results.ts): a next step and a link after each write, and a fix
// with each refusal. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextStep, withFix } from "@/lib/mcp-results";

const O = "https://brazework.com";

test("a milestone for a club says it went to the club; with no club, says to ask for a signature by id", () => {
  const club = nextStep("log_milestone", { id: "m1", status: "pending", club: "Rocketry Club", project_url: `${O}/projects/p1` }, O)!;
  assert.match(club.next, /Sent to Rocketry Club/);
  assert.equal(club.open, `${O}/projects/p1`);
  const solo = nextStep("log_milestone", { id: "m2", status: "draft", project_url: "/projects/p1" }, O)!;
  assert.match(solo.next, /request_signature with milestone_id "m2"/);
  assert.equal(solo.open, `${O}/projects/p1`);
});

test("drafts point to the drafts page; a repeat says nothing new was added; posts link the post", () => {
  assert.equal(nextStep("draft_milestone", { id: 1, duplicate: false }, O)!.open, `${O}/drafts`);
  assert.match(nextStep("draft_post", { id: 1, duplicate: true }, O)!.next, /nothing new was added/);
  assert.equal(nextStep("post_update", { id: "x", url: `${O}/post/x` }, O)!.open, `${O}/post/x`);
});

test("reads and signature asks add nothing (they carry their own links and next step)", () => {
  for (const t of ["me", "my_projects", "search", "request_signature"]) assert.equal(nextStep(t, { any: 1 }, O), null, t);
});

test("refusals keep the database's words and add the fix when there's a choice", () => {
  const free = withFix("Use their university or company address (not Gmail, Outlook and the like), so the vouch means something.");
  assert.match(free, /^Use their university/);
  assert.match(free, /school or work address/);
  assert.match(withFix("Ask someone who isn't on the project."), /Teammates can't sign/);
  assert.match(withFix("You've sent 10 asks this week. Try again in a few days."), /a limit, not an error/);
  assert.equal(withFix("Write between 1 and 3,000 characters."), "Write between 1 and 3,000 characters.");
});

test("a hint never repeats what the refusal already says", () => {
  const announce = "Only a club's moderators, admins and owner draft its announcements. my_clubs shows your role in each.";
  assert.equal(withFix(announce), announce, "the database already points to my_clubs");
  const search = "Finding builders is for admins of a verified company or school. Register yours at Brazework → /org.";
  assert.equal(withFix(search), search, "the database already points to /org");
  const review = "Only the club's moderators, admins and owner can review milestones.";
  assert.equal(withFix(review), `${review} my_clubs shows the member's role in each club.`, "a pointer the message lacks is added, without restating it");
  const host = "Only a club's admins and owner can host its events. my_clubs shows your role in each.";
  assert.match(withFix(host), /draft_announcement/, "a hint that adds a different way forward stays");
  const invite = "This invite link has expired or was turned off. Ask for a new one.";
  assert.equal(withFix(invite), `${invite} Or ask to join the club instead (join_club).`);
});
