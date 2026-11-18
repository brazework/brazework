// The weekly database watch (.github/workflows/db-watch.yml). Read-only: it asks Supabase's
// Security and Performance advisors about production, compares their warnings with the ones we've
// accepted (supabase/maintenance/advisor-baseline.json), and adds what the workflow found with the
// read-only health check (steps missing, tables without row-level security). Anything new is
// written to the run's summary, filed or updated as one Linear issue ("Database watch"), and fails
// the run so GitHub emails us. It never changes the database: fixes go in as a new step, by PR.
//
// Run by hand:  SUPABASE_ACCESS_TOKEN=… node .github/scripts/db-watch.mjs
// Accept today's warnings as the new normal (after deciding each is fine):  … --write-baseline
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fileOrComment } from "./linear-issue.mjs";

const BASELINE = new URL("../../supabase/maintenance/advisor-baseline.json", import.meta.url);
const LEVELS = new Set(["WARN", "ERROR"]); // INFO (unused indexes and the like) moves too much to watch

// One finding → a stable key. The advisor's detail names the object ("Function `public.x` has…"),
// so it's the key, without the quoting that differs between the API and the dashboard.
export const keyOf = (detail) => String(detail ?? "").replace(/[\\`]/g, "").trim();

// Both shapes the advisors come in: one entry per finding (the API), or grouped with findings[].
export function flatten(lints) {
  return lints.flatMap((l) => (Array.isArray(l.findings) ? l.findings.map((f) => ({ ...l, ...f, findings: undefined })) : [l]))
    .map((l) => ({ name: l.name, level: l.level, title: l.title, key: keyOf(l.detail), remediation: l.remediation }));
}

// What's new since the baseline, and what the baseline lists that's gone (fixed: trim it).
export function compare(lints, baseline) {
  const ignore = new Set(baseline.ignore ?? []);
  const accepted = new Set(Object.entries(baseline.accepted ?? {}).flatMap(([name, keys]) => keys.map((k) => `${name}|${k}`)));
  const seen = new Set();
  const fresh = [];
  for (const l of flatten(lints)) {
    if (!LEVELS.has(l.level) || ignore.has(l.name)) continue;
    const id = `${l.name}|${l.key}`;
    seen.add(id);
    if (!accepted.has(id)) fresh.push(l);
  }
  const gone = [...accepted].filter((id) => !seen.has(id));
  return { fresh, gone };
}

export function baselineFrom(lints, ignore = []) {
  const accepted = {};
  for (const l of flatten(lints)) {
    if (!LEVELS.has(l.level) || ignore.includes(l.name)) continue;
    (accepted[l.name] ??= []).push(l.key);
  }
  for (const k of Object.keys(accepted)) accepted[k] = [...new Set(accepted[k])].sort();
  return { ignore, accepted };
}

/** @param {{ fresh: any[], gone: string[], missingSteps?: string[], noRls?: string[], tables?: any[] }} r */
export function report({ fresh, gone, missingSteps = [], noRls = [], tables = [] }) {
  const lines = [];
  const problems = fresh.length + missingSteps.length + noRls.length;
  lines.push(problems ? `**${problems} new thing${problems === 1 ? "" : "s"} to look at.**` : "**All clear.** Nothing new since the accepted list.");
  if (noRls.length) lines.push("", "### Tables anyone could read or write (row-level security off)", ...noRls.map((t) => `- \`${t}\``));
  if (missingSteps.length) lines.push("", "### Database steps production is missing", ...missingSteps.map((s) => `- ${s}`), "", "Run **Database steps (production)** from Actions, or check why it failed.");
  if (fresh.length) {
    const byName = Object.groupBy(fresh, (l) => l.name);
    lines.push("", "### New advisor warnings");
    for (const [name, ls] of Object.entries(byName)) {
      lines.push("", `**${ls[0].title}** (${ls[0].level}, ${ls.length}) · [how to fix](${ls[0].remediation})`, ...ls.slice(0, 20).map((l) => `- ${l.key}`));
      if (ls.length > 20) lines.push(`- …and ${ls.length - 20} more`);
    }
    lines.push("", "Fix them in a new step under `supabase/` (by PR), or, if one is fine as it is, accept it with `--write-baseline` and say why in the PR.");
  }
  if (gone.length) lines.push("", `${gone.length} accepted warning${gone.length === 1 ? " is" : "s are"} gone (fixed). Refresh the accepted list with \`--write-baseline\` when convenient.`);
  if (tables.length) lines.push("", "### Biggest tables", "| table | rows (est.) | size |", "|---|---:|---:|", ...tables.map((t) => `| ${t.table} | ${t.rows_estimate} | ${t.total_size} |`));
  return { problems, text: lines.join("\n") };
}

async function advisors(ref, token) {
  const out = [];
  for (const kind of ["security", "performance"]) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/advisors/${kind}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Supabase ${kind} advisors: HTTP ${res.status} ${await res.text()}`);
    const body = await res.json();
    out.push(...(body.lints ?? body.result?.lints ?? []));
  }
  return out;
}

const rows = (path) => {
  if (!path || !existsSync(path)) return [];
  const j = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(j) ? j : (j.rows ?? []);
};

// One open "Database watch" issue at a time: later runs comment on it instead of piling up.
const linear = (title, body) => fileOrComment({ prefix: "Database watch", title, body });

async function main() {
  const ref = process.env.PROJECT_REF || "uwiwkjoonculpxjmzsfj";
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("Set SUPABASE_ACCESS_TOKEN (a Supabase personal access token).");
  const lints = await advisors(ref, token);
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : { ignore: [], accepted: {} };

  if (process.argv.includes("--write-baseline")) {
    writeFileSync(BASELINE, JSON.stringify(baselineFrom(lints, baseline.ignore ?? []), null, 2) + "\n");
    return console.log(`Wrote ${BASELINE.pathname}`);
  }

  const { fresh, gone } = compare(lints, baseline);
  const missingSteps = rows(process.env.STEPS_JSON).filter((r) => r.status !== "applied").map((r) => `${r.step} ${r.file}`);
  const noRls = rows(process.env.NO_RLS_JSON).map((r) => r.table_without_rls);
  const tables = rows(process.env.TABLES_JSON);
  const { problems, text } = report({ fresh, gone, missingSteps, noRls, tables });
  const md = `## Database watch\n\n${text}\n`;
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  if (problems) {
    const run = process.env.GITHUB_RUN_ID ? `\n\n[The run](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})` : "";
    await linear(`Database watch: ${problems} new thing${problems === 1 ? "" : "s"} in production`, text + run);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
