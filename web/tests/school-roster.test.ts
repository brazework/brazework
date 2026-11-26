// Reading class rosters and faculty lists, and writing the evidence export (lib/school-roster.ts). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { evidenceCsv, parseEmails, parseFaculty, termsAround } from "@/lib/school-roster";

test("a roster is every distinct email in whatever the registrar or LMS exported", () => {
  const csv = 'Last,First,Email\n"Cho, Jr.",Ben,BEN@uportal.edu\nLee,Ann,ann.lee@uportal.edu\nLee,Ann,ann.lee@uportal.edu\n';
  assert.deepEqual(parseEmails(csv), ["ben@uportal.edu", "ann.lee@uportal.edu"]);
  assert.deepEqual(parseEmails("one@uportal.edu\ntwo@uportal.edu; three@uportal.edu"), ["one@uportal.edu", "two@uportal.edu", "three@uportal.edu"]);
  assert.deepEqual(parseEmails("no emails here"), []);
});

test("a faculty list takes email, name and title from any column order, and skips the header", () => {
  const rows = parseFaculty('email,name,title\nmaya@uportal.edu,"Ortiz, Maya",Professor\n"Dana Ruiz",dana@uportal.edu,Lecturer\nnot a row\n');
  assert.deepEqual(rows, [
    { email: "maya@uportal.edu", name: "Ortiz, Maya", title: "Professor" },
    { email: "dana@uportal.edu", name: "Dana Ruiz", title: "Lecturer" },
  ]);
});

test("the class form offers this term and the next two", () => {
  assert.deepEqual(termsAround(new Date("2026-11-26T00:00:00Z")), ["Fall 2026", "Spring 2027", "Summer 2027"]);
  assert.deepEqual(termsAround(new Date("2027-02-10T00:00:00Z")), ["Spring 2027", "Summer 2027", "Fall 2027"]);
});

test("the evidence export quotes every cell and never lets a spreadsheet run a formula", () => {
  const csv = evidenceCsv([{ student: "Ben Cho", milestone: '=HYPERLINK("x")', setting: "ME 410 · Capstone" }], [["student", "Student"], ["milestone", "Milestone"], ["setting", "Class or club"]]);
  assert.equal(csv, '"Student","Milestone","Class or club"\r\n"Ben Cho","\'=HYPERLINK(""x"")","ME 410 · Capstone"\r\n');
});
