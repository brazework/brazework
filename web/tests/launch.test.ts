// Launch links: the Product Hunt ref is read from the URL, and nothing else gets through. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { HERO_STORIES } from "@/lib/landing-demo";
import { PH_REF, firstStoryFor, refFrom } from "@/lib/launch";

test("the ref is read from the query string, tidied, and anything odd is dropped", () => {
  assert.equal(refFrom("?ref=producthunt"), PH_REF);
  assert.equal(refFrom("?utm_source=x&ref=ProductHunt"), PH_REF);
  assert.equal(refFrom("?ref=<script>"), "");
  assert.equal(refFrom(""), "");
});

test("a Product Hunt visitor starts on the engineer's story; everyone else on mechanical work", () => {
  const first = firstStoryFor(PH_REF, HERO_STORIES);
  assert.equal(HERO_STORIES[first].who, "Software");
  assert.match(HERO_STORIES[first].tool, /GitHub/);
  assert.equal(HERO_STORIES[firstStoryFor("", HERO_STORIES)].who, "Mechanical");
  assert.equal(HERO_STORIES[firstStoryFor("newsletter", HERO_STORIES)].who, "Mechanical");
  assert.equal(firstStoryFor(PH_REF, [{ who: "Student" }]), 0, "no engineer story: the first one");
});
