// A club's link to its university (Linear FIX-237): the browser's check matches the database's
// (supabase/school-link-email.sql email_at_domain). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { emailAtDomain, schoolDomain } from "@/lib/school-domain";

test("a school's website comes down to its academic domain", () => {
  assert.equal(schoolDomain("https://www.hartford.edu/student-life"), "hartford.edu");
  assert.equal(schoolDomain("hartford.edu"), "hartford.edu");
  assert.equal(schoolDomain("http://cs.ox.ac.uk"), "cs.ox.ac.uk");
  assert.equal(schoolDomain("https://unimelb.edu.au"), "unimelb.edu.au");
  assert.equal(schoolDomain("example.com"), "");
  assert.equal(schoolDomain(""), "");
});

test("an email is at the school, or one of its departments, and nowhere that only looks like it", () => {
  assert.ok(emailAtDomain("ben@hartford.edu", "hartford.edu"));
  assert.ok(emailAtDomain("Ben@Eng.Hartford.EDU", "hartford.edu"));
  assert.ok(!emailAtDomain("ben@nothartford.edu", "hartford.edu"));
  assert.ok(!emailAtDomain("ben@hartford.edu.evil.com", "hartford.edu"));
  assert.ok(!emailAtDomain("ben@gmail.com", "hartford.edu"));
  assert.ok(!emailAtDomain("", "hartford.edu"));
  assert.ok(!emailAtDomain("ben@hartford.edu", ""));
});
