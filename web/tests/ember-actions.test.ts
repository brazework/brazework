// Jig's composer actions (lib/ember-actions.ts): the same eight for everyone, worded for who's asking;
// the ones that start a sentence say how to finish it. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { emberActions, emberGreeting } from "@/lib/ember-actions";

test("someone who works is never sent to a club to get work signed", () => {
  const pro = emberActions({ field: "Software", student: false });
  assert.equal(pro.find((a) => a.id === "sign")?.label, "Get it signed");
  for (const a of pro) assert.doesNotMatch(`${a.label} ${a.text} ${a.finish ?? ""}`, /club|semester/i);
  assert.match(emberActions({ field: "Software", student: true }).find((a) => a.id === "sign")!.text, /verified by my club/);
});

test("Jig writes from the record: a review for someone who works, résumé bullets for a student, and the story for both", () => {
  const pro = emberActions({ student: false }), stu = emberActions({ student: true });
  assert.equal(pro.find((a) => a.id === "review")?.label, "Prep my review");
  assert.match(pro.find((a) => a.id === "review")!.text, /from my signed work/);
  assert.equal(stu.find((a) => a.id === "review")?.label, "Résumé bullets");
  assert.match(stu.find((a) => a.id === "story")!.text, /year by year/);
  assert.equal(pro.length, 8);
  assert.equal(new Set(pro.map((a) => a.id)).size, 8, "one button per thing");
});

test("an action either asks at once or starts a sentence and says how to finish it", () => {
  for (const a of emberActions({ student: true })) {
    if (a.finish) assert.match(a.text, /( |\/)$/, `${a.id} should leave the cursor where the member types`);
    else assert.match(a.text, /[.?]$/, `${a.id} should be a whole request`);
    assert.ok(a.label.length <= 16, `${a.label} is short enough for a phone`);
  }
});

test("the field goes into the ask, and a missing one still reads", () => {
  assert.match(emberActions({ field: " Robotics ", student: true }).find((a) => a.id === "people")!.text, /someone in Robotics worth/);
  assert.match(emberActions({ field: "", student: true }).find((a) => a.id === "people")!.text, /someone in my field worth/);
  assert.equal(emberGreeting(" Josh "), "Hi Josh, what are we getting done?");
  assert.equal(emberGreeting(""), "What are we getting done?");
});
