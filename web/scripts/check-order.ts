// CI check for supabase/order.txt and the health-check row /api/health depends on.
//
// /api/health returns 200 only when public_stats() answers (web/src/app/api/health/route.ts).
// That function is created by the public-stats step (supabase/public-stats.sql). Block 1 of
// supabase/maintenance/health-check.sql is the read-only list db-migrate uses to see which
// steps have run; its public-stats row checks to_regprocedure('public.public_stats()').
// If that row is missing, the migration runner cannot tell whether the function the health
// route calls has been applied. Early steps in order.txt have no row there on purpose, so
// this check looks for that one row, not a row for every step.
//
// Run from web/: npx tsx scripts/check-order.ts [order.txt] [health-check.sql]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HEALTH_ROW = "public-stats";

export type OrderProblem =
  | { code: "duplicate"; name: string; lines: number[] }
  | { code: "missing-health-row"; name: string };

export function parseOrderSteps(orderText: string): { name: string; line: number }[] {
  return orderText.split("\n").flatMap((raw, i) => {
    const name = raw.trim();
    if (!name || name.startsWith("#")) return [];
    return [{ name, line: i + 1 }];
  });
}

/** File names in block 1, or null when the block markers db-migrate looks for are absent. */
export function parseHealthCheckFiles(healthSql: string): string[] | null {
  const start = healthSql.indexOf("select step, file");
  const end = healthSql.indexOf("order by step;");
  if (start < 0 || end < start) return null;
  const block = healthSql.slice(start, end);
  return [...block.matchAll(/\(\s*\d+\s*,\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
}

export function checkOrderFiles(orderText: string, healthSql: string): OrderProblem[] {
  const problems: OrderProblem[] = [];
  const seen = new Map<string, number[]>();
  for (const step of parseOrderSteps(orderText)) {
    const lines = seen.get(step.name) ?? [];
    lines.push(step.line);
    seen.set(step.name, lines);
  }
  for (const [name, lines] of seen) {
    if (lines.length > 1) problems.push({ code: "duplicate", name, lines });
  }
  const files = parseHealthCheckFiles(healthSql);
  if (!files || !files.includes(HEALTH_ROW)) {
    problems.push({ code: "missing-health-row", name: HEALTH_ROW });
  }
  return problems;
}

export function formatProblems(problems: OrderProblem[]): string {
  return problems
    .map((p) =>
      p.code === "duplicate"
        ? `order.txt lists '${p.name}' more than once (lines ${p.lines.join(", ")})`
        : `health-check row for '${p.name}' is missing from block 1 of supabase/maintenance/health-check.sql (/api/health calls public_stats())`,
    )
    .join("\n");
}

function main(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const orderPath = process.argv[2] ?? join(root, "supabase", "order.txt");
  const healthPath = process.argv[3] ?? join(root, "supabase", "maintenance", "health-check.sql");
  let orderText: string;
  let healthSql: string;
  try {
    orderText = readFileSync(orderPath, "utf8");
    healthSql = readFileSync(healthPath, "utf8");
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  const problems = checkOrderFiles(orderText, healthSql);
  if (problems.length > 0) {
    console.error(formatProblems(problems));
    process.exit(1);
  }
  console.log("order.txt has no duplicate step names, and the public-stats health-check row is present.");
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("check-order.ts") || entry.endsWith("check-order.js")) main();
