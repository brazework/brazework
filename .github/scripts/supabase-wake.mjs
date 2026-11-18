// Wakes staging before its database steps (.github/workflows/db-migrate.yml, Linear FIX-83).
// Staging lives in a free Supabase organization, so it costs nothing, and free projects pause after
// about a week without use. This asks Supabase where the project stands and, if it's paused, restores
// it and waits until it's healthy.
//
// The cost rule: it only ever wakes a project whose organization is on the Free plan. Staging in a
// paid organization costs about $10 a month, so a paused one there is left alone and the run says so.
// A project that's already running is used wherever it lives: someone chose to pay for it.
//
// Writes ready=true|false to $GITHUB_OUTPUT. Staging it can't reach (the token's account isn't in
// staging's organization, or the project is gone) is a loud warning and ready=false, never a failure:
// production must not be held back because the rehearsal couldn't happen. It exits 1 only when
// staging answers with something wrong (a failed restore, a broken state), which is worth stopping for.
//
//   SUPABASE_ACCESS_TOKEN=… node .github/scripts/supabase-wake.mjs <project ref>
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RUNNING = new Set(["ACTIVE_HEALTHY"]);
const ASLEEP = new Set(["INACTIVE", "PAUSED"]);
const ON_THE_WAY = new Set(["COMING_UP", "RESTORING", "UPGRADING", "RESIZING", "ACTIVE_UNHEALTHY", "PAUSING", "GOING_DOWN", "UNKNOWN"]);

/** HTTP statuses that mean "this token can't see staging": a setup problem, not a failed step. */
export const unreachable = (httpStatus) => [401, 403, 404].includes(httpStatus);

/**
 * What to do with a project, from its status and its organization's plan.
 * @returns {"ready" | "wake" | "wait" | "skip-paid" | "fail"}
 */
export function decide({ status, plan }) {
  if (RUNNING.has(status)) return "ready";
  if (ASLEEP.has(status)) return plan === "free" ? "wake" : "skip-paid";
  if (ON_THE_WAY.has(status)) return "wait";
  return "fail";
}

async function api(path, init = {}) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "content-type": "application/json", ...init.headers },
  });
  if (!res.ok) throw Object.assign(new Error(`Supabase ${init.method ?? "GET"} ${path}: HTTP ${res.status} ${await res.text()}`), { httpStatus: res.status });
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const ref = process.argv[2];
  if (!ref) throw new Error("Pass the project ref.");
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error("Set SUPABASE_ACCESS_TOKEN.");
  const out = (ready, note) => {
    console.log(note);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ready=${ready}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${note}\n\n`);
  };

  let project, org;
  try {
    project = await api(`/projects/${ref}`);
    org = await api(`/organizations/${project.organization_slug ?? project.organization_id}`);
  } catch (e) {
    if (!unreachable(e.httpStatus)) throw e;
    console.log(`::warning title=Staging skipped::The SUPABASE_ACCESS_TOKEN account can't reach staging (${ref}): HTTP ${e.httpStatus}. Invite that account to staging's organization (Administrator), then Run workflow again.`);
    return out(false, `Staging (${ref}) couldn't be reached with this token (HTTP ${e.httpStatus}), so it was skipped and production went ahead. Invite the token's Supabase account to staging's organization as Administrator.`);
  }
  let status = project.status;
  let restored = false;
  const deadline = Date.now() + 10 * 60_000;
  for (;; status = (await api(`/projects/${ref}`)).status) {
    const next = decide({ status, plan: org.plan });
    if (next === "ready") return out(true, `Staging (${ref}) is running.`);
    if (next === "skip-paid") {
      return out(false, `Staging (${ref}) is paused in "${org.name}", a ${org.plan} organization, where waking it costs about $10 a month. Skipped. Move it to the free staging organization (CONTRIBUTING.md) to have it woken automatically.`);
    }
    if (next === "fail") throw new Error(`Staging (${ref}) is ${status}: look at it in the Supabase dashboard.`);
    if (next === "wake" && !restored) {
      console.log(`Staging (${ref}) is paused in a free organization: waking it.`);
      await api(`/projects/${ref}/restore`, { method: "POST" });
      restored = true;
    }
    if (Date.now() > deadline) throw new Error(`Staging (${ref}) is still ${status} after 10 minutes.`);
    await sleep(15_000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
