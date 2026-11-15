// The weekly database watch (.github/scripts/db-watch.mjs): what counts as new, what's ignored, and
// both shapes the advisors come in. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { baselineFrom, compare, keyOf, report } from "../../.github/scripts/db-watch.mjs";

const api = [
  { name: "function_search_path_mutable", level: "WARN", title: "Function Search Path Mutable", detail: "Function `public.a` has a role mutable search_path", remediation: "https://x" },
  { name: "unused_index", level: "INFO", title: "Unused Index", detail: "Index `i` is unused" },
  { name: "authenticated_security_definer_function_executable", level: "WARN", title: "Signed-in", detail: "Function `public.b`" },
];

test("a finding's key drops the quoting that differs between the API and the dashboard", () => {
  assert.equal(keyOf("Table \\`public.x\\` has RLS"), "Table public.x has RLS");
  assert.equal(keyOf("Table `public.x` has RLS"), "Table public.x has RLS");
});

test("warnings not on the accepted list are new; INFO and ignored kinds never are", () => {
  const { fresh, gone } = compare(api, { ignore: ["authenticated_security_definer_function_executable"], accepted: {} });
  assert.deepEqual(fresh.map((f: { key: string }) => f.key), ["Function public.a has a role mutable search_path"]);
  assert.equal(gone.length, 0);
});

test("accepted warnings stay quiet, and ones that disappear are reported as fixed", () => {
  const baseline = baselineFrom(api, ["authenticated_security_definer_function_executable"]);
  assert.deepEqual(compare(api, baseline).fresh, []);
  assert.equal(compare([], baseline).gone.length, 1);
});

test("the grouped shape (findings under each lint) reads the same as one entry per finding", () => {
  const grouped = [{ name: "function_search_path_mutable", level: "WARN", title: "T", remediation: "r", findings: [{ detail: "Function \\`public.a\\` has a role mutable search_path" }] }];
  assert.deepEqual(compare(grouped, baselineFrom(api)).fresh, []);
});

test("the report counts problems from the advisors and the health check alike", () => {
  assert.equal(report({ fresh: [], gone: [] }).problems, 0);
  const r = report({ fresh: [], gone: [], missingSteps: ["57 hardening"], noRls: ["secrets"] });
  assert.equal(r.problems, 2);
  assert.match(r.text, /57 hardening/);
  assert.match(r.text, /`secrets`/);
});
