// Launch links: the Product Hunt ref is read from the URL, and nothing else gets through. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { PH_REF, refFrom } from "@/lib/launch";

test("the ref is read from the query string, tidied, and anything odd is dropped", () => {
  assert.equal(refFrom("?ref=producthunt"), PH_REF);
  assert.equal(refFrom("?utm_source=x&ref=ProductHunt"), PH_REF);
  assert.equal(refFrom("?ref=<script>"), "");
  assert.equal(refFrom(""), "");
});

