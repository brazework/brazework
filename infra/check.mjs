// Is production still what the repo says? (Linear FIX-82). Reads the live settings of Supabase
// (auth, storage), Vercel (project, domains, cron, env var NAMES) and brazework.com's DNS, compares
// them with infra/desired.json and prints every difference. Read-only: it never changes anything.
//
//   SUPABASE_ACCESS_TOKEN=… node infra/check.mjs            exit 0: no drift · 1: drift · 2: couldn't read
//   SUPABASE_ACCESS_TOKEN=… node infra/check.mjs --capture  write today's live state to infra/desired.json
//                                                           (only to bless a change on purpose; review the git diff)
// Vercel: uses VERCEL_TOKEN if set, otherwise the logged-in `vercel` CLI. Secrets are never read or
// stored: env vars are compared by name only, and the SMTP password isn't fetched.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { diff, splitList } from "./diff.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIRED = join(HERE, "desired.json");
const SB_PROJECT = "uwiwkjoonculpxjmzsfj", TEAM = "ixcoleman123", PROJECT = "forge-app", DOMAIN = "brazework.com";
// The Supabase auth settings the repo owns. Anything else in Supabase is left alone.
const AUTH_KEYS = ["site_url", "uri_allow_list", "disable_signup", "external_email_enabled", "mailer_autoconfirm", "mailer_secure_email_change_enabled",
  "password_min_length", "rate_limit_email_sent", "smtp_host", "smtp_port", "smtp_user", "smtp_admin_email", "smtp_sender_name", "smtp_max_frequency"];

async function supabase(path) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("Set SUPABASE_ACCESS_TOKEN (read access to the Supabase Management API).");
  const r = await fetch(`https://api.supabase.com/v1/projects/${SB_PROJECT}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Supabase ${path}: ${r.status}`);
  return r.json();
}
async function vercel(path) {
  const sep = path.includes("?") ? "&" : "?";
  if (process.env.VERCEL_TOKEN) {
    const r = await fetch(`https://api.vercel.com${path}${sep}teamId=${TEAM}`, { headers: { authorization: `Bearer ${process.env.VERCEL_TOKEN}` } });
    if (!r.ok) throw new Error(`Vercel ${path}: ${r.status}`);
    return r.json();
  }
  const out = execFileSync("vercel", ["api", `${path}${sep}teamId=${TEAM}`, "--scope", TEAM], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(out.slice(out.indexOf("{")));
}

async function live() {
  const [auth, storage, project, domains, records, envs] = await Promise.all([
    supabase("/config/auth"), supabase("/config/storage"),
    vercel(`/v9/projects/${PROJECT}`), vercel(`/v9/projects/${PROJECT}/domains`),
    vercel(`/v4/domains/${DOMAIN}/records?limit=100`), vercel(`/v10/projects/${PROJECT}/env`),
  ]);
  return {
    supabase: {
      auth: Object.fromEntries(AUTH_KEYS.map((k) => [k, k === "uri_allow_list" ? splitList(auth[k]) : auth[k] ?? null])),
      storage: { fileSizeLimit: storage.fileSizeLimit },
    },
    vercel: {
      rootDirectory: project.rootDirectory,
      crons: (project.crons?.definitions ?? []).map((c) => ({ path: c.path, schedule: c.schedule })),
      domains: (domains.domains ?? []).map((d) => ({ name: d.name, redirect: d.redirect ?? null, redirectStatusCode: d.redirectStatusCode ?? null })),
      // Names only, and which environments: values are secrets and never leave Vercel.
      env: (envs.envs ?? []).map((e) => ({ key: e.key, target: [...(e.target ?? [])].sort() })),
    },
    // Records Vercel manages itself (creator "system": the site's ALIAS and CAA) aren't ours to own.
    dns: (records.records ?? []).filter((r) => r.creator !== "system")
      .map((r) => ({ type: r.type, name: r.name, value: r.value, ...(r.mxPriority ? { mxPriority: r.mxPriority } : {}) })),
  };
}

try {
  const now = await live();
  if (process.argv.includes("--capture")) {
    writeFileSync(DESIRED, JSON.stringify(now, null, 2) + "\n");
    console.log(`Wrote ${DESIRED}. Review it with git diff before committing.`);
    process.exit(0);
  }
  const drift = diff(JSON.parse(readFileSync(DESIRED, "utf8")), now);
  if (!drift.length) { console.log("No drift: production matches infra/desired.json."); process.exit(0); }
  console.log(`Drift: ${drift.length} difference(s) between infra/desired.json and production:`);
  for (const d of drift) console.log(`  ${d.path}\n    repo: ${JSON.stringify(d.want)}\n    live: ${JSON.stringify(d.got)}`);
  process.exit(1);
} catch (e) {
  console.error(`Couldn't read production: ${e.message}`);
  process.exit(2);
}
