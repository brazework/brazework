// order.txt step names are unique, and the public-stats health-check row is present.
// Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkOrderFiles } from "../scripts/check-order";

const health = `
select step, file, case when present then 'applied' else 'missing' end as status
from (values
  (19, 'public-stats', to_regprocedure('public.public_stats()') is not null),
  (20, 'account', to_regprocedure('public.delete_my_account(text)') is not null)
) as s(step, file, present)
order by step;
`;

const order = "# comment\n\nschema\npublic-stats\naccount\n";

test("passes when step names are unique and the public-stats health-check row is present", () => {
  assert.deepEqual(checkOrderFiles(order, health), []);
});

test("fails when order.txt lists the same step name more than once", () => {
  const problems = checkOrderFiles("# comment\n\nschema\npublic-stats\nschema\n", health);
  assert.deepEqual(problems, [{ code: "duplicate", name: "schema", lines: [3, 5] }]);
});

test("fails when the public-stats health-check row is missing", () => {
  const without = `
select step, file, case when present then 'applied' else 'missing' end as status
from (values
  (20, 'account', to_regprocedure('public.delete_my_account(text)') is not null)
) as s(step, file, present)
order by step;
`;
  const problems = checkOrderFiles(order, without);
  assert.deepEqual(problems, [{ code: "missing-health-row", name: "public-stats" }]);
});

test("the repo's order.txt and health check pass", () => {
  const root = join(__dirname, "..", "..");
  const orderText = readFileSync(join(root, "supabase", "order.txt"), "utf8");
  const healthSql = readFileSync(join(root, "supabase", "maintenance", "health-check.sql"), "utf8");
  assert.deepEqual(checkOrderFiles(orderText, healthSql), []);
});
