// GitHub, live in a project's build log (Linear FIX-92, phase 3). Real HTTP deliveries to
// /api/github/webhook, signed the way GitHub signs them (HMAC-SHA256 of the raw body with the App's
// webhook secret, set for the test stack in e2e/serve.sh). Ben has installed the App and linked
// bencho/test-stand to his project p1 (inserted here, as the server does when he connects it).
// Checks: unsigned or mis-signed deliveries are refused and change nothing; a merged pull request, a
// release and CI on main appear in p1's build log, for anyone who can see p1; a repeated delivery
// adds nothing; activity on a repo nobody linked is ignored; removing the repo from the App unlinks it.
const crypto = require("crypto"), { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");
const SECRET = "whsec_github_e2e";
const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const repo = { id: 77, full_name: "bencho/test-stand", html_url: "https://github.com/bencho/test-stand", default_branch: "main" };
const installation = { id: 9001 };

async function deliver(event, payload, { id = crypto.randomUUID(), secret = SECRET, tamper = false } = {}) {
  const body = JSON.stringify(payload);
  const sig = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  const res = await fetch(`${BASE}/api/github/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-event": event, "x-github-delivery": id, "x-hub-signature-256": sig },
    body: tamper ? body.replace("Add igniter sequencing", "Add igniter sequencing (edited)") : body,
  });
  return { status: res.status, json: await res.json().catch(() => ({})), id };
}
const events = () => Number(psql("select count(*) from build_events where project_id = 'p1'"));

(async () => {
  const ben = process.env.BEN_ID || psql("select id from auth.users where email = 'ben@forge.test'");
  psql(`insert into github_installations (installation_id, account_login, installed_by) values (9001, 'bencho', '${ben}') on conflict do nothing;
        insert into project_repos (project_id, installation_id, repo_id, full_name, html_url, default_branch, linked_by)
        values ('p1', 9001, 77, 'bencho/test-stand', 'https://github.com/bencho/test-stand', 'main', '${ben}') on conflict do nothing;`);
  const merged = { action: "closed", installation, repository: repo, pull_request: { number: 42, title: "Add igniter sequencing", html_url: "https://github.com/bencho/test-stand/pull/42", merged: true, merged_at: new Date(Date.now() - 3600e3).toISOString(), user: { login: "bencho" } } };

  await step("a delivery without GitHub's signature, or with a body changed after signing, is refused and stores nothing", async () => {
    const before = events();
    const wrongKey = await deliver("pull_request", merged, { secret: "not-the-secret" });
    const tampered = await deliver("pull_request", merged, { tamper: true });
    if (wrongKey.status !== 401 || tampered.status !== 401) throw new Error(`expected 401s, got ${wrongKey.status} and ${tampered.status}`);
    if (events() !== before) throw new Error("a refused delivery stored something");
  });

  let first;
  await step("a merged pull request, a release and CI passing on main go into p1's build log; the same delivery twice adds nothing", async () => {
    first = await deliver("pull_request", merged);
    if (first.status !== 200 || first.json.recorded !== 1) throw new Error(`merged PR: ${first.status} ${JSON.stringify(first.json)}`);
    const again = await deliver("pull_request", merged, { id: first.id });
    if (!again.json.duplicate) throw new Error(`a repeated delivery wasn't spotted: ${JSON.stringify(again.json)}`);
    const sameThing = await deliver("pull_request", merged); // a new delivery id, the same pull request
    if (sameThing.status !== 200) throw new Error(`same PR, new delivery: ${sameThing.status}`);
    const rel = await deliver("release", { action: "published", installation, repository: repo, release: { id: 555, tag_name: "v1.0.0", name: "First hot fire", html_url: "https://github.com/bencho/test-stand/releases/tag/v1.0.0", published_at: new Date(Date.now() - 1800e3).toISOString(), author: { login: "bencho" } } });
    const ci = await deliver("check_suite", { action: "completed", installation, repository: repo, check_suite: { head_branch: "main", head_sha: "abc1234def", conclusion: "success", updated_at: new Date().toISOString() } });
    if (rel.json.recorded !== 1 || ci.json.recorded !== 1) throw new Error(`release ${JSON.stringify(rel.json)} ci ${JSON.stringify(ci.json)}`);
    const rows = psql("select string_agg(source_id, ',' order by source_id) from build_events where project_id = 'p1'");
    if (rows !== "ci:abc1234def,pr:42,release:555") throw new Error(`stored: ${rows}`);
  });

  await step("activity on a repo nobody linked, or a branch that isn't the default, is ignored", async () => {
    const before = events();
    const other = await deliver("pull_request", { ...merged, repository: { ...repo, id: 99, full_name: "someone/else" } });
    const branch = await deliver("check_suite", { action: "completed", installation, repository: repo, check_suite: { head_branch: "experiment", head_sha: "fff", conclusion: "failure" } });
    if (!other.json.ignored || !branch.json.ignored || events() !== before) throw new Error(`other repo ${JSON.stringify(other.json)} branch ${JSON.stringify(branch.json)}`);
  });

  const b = await browser();
  const josh = await as(b, "josh@forge.test");
  await step("Josh sees it on Ben's project: live from the repo, newest first, each linked to GitHub", async () => {
    await go(josh, "/projects/p1");
    const log = josh.getByRole("region", { name: "Build log" });
    await log.getByText("Live from bencho/test-stand").waitFor({ timeout: 15000 });
    const pr = log.getByRole("link", { name: /Merged #42: Add igniter sequencing/ });
    if ((await pr.getAttribute("href")) !== "https://github.com/bencho/test-stand/pull/42") throw new Error("the PR doesn't link to GitHub");
    await log.getByRole("link", { name: /Released First hot fire/ }).waitFor();
    await log.getByRole("link", { name: /CI passed on main/ }).waitFor();
    const order = await log.locator("a[href^='https://github.com/bencho/test-stand/']").evaluateAll((as) => as.map((a) => a.textContent));
    const at = (s) => order.findIndex((t) => t.includes(s));
    if (!(at("CI passed") < at("Released First hot fire") && at("Released First hot fire") < at("Merged #42"))) throw new Error(`not newest first: ${order.join(" | ")}`);
  }, josh);

  await step("removing the repo from the App on GitHub unlinks it from the project", async () => {
    const r = await deliver("installation_repositories", { action: "removed", installation, repositories_removed: [{ id: 77 }] });
    if (r.json.unlinked !== 1 || psql("select count(*) from project_repos where project_id = 'p1'") !== "0") throw new Error(JSON.stringify(r.json));
  });

  await josh.context().close();
  await b.close();
  summary();
})();
