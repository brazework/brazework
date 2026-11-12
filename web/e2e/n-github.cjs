// GitHub, live in a project's build log (Linear FIX-92, phase 3). Real HTTP deliveries to
// /api/github/webhook, signed the way GitHub signs them (HMAC-SHA256 of the raw body with the App's
// webhook secret, set for the test stack in e2e/serve.sh). Ben has installed the App and linked
// bencho/test-stand to his project p1 (inserted here, as the server does when he connects it).
// Checks: unsigned or mis-signed deliveries are refused and change nothing; a merged pull request, a
// release and CI on main appear in p1's build log, for anyone who can see p1; a repeated delivery
// adds nothing; activity on a repo nobody linked is ignored; removing the repo from the App unlinks it.
//
// Then "Connect GitHub" end to end, against a stand-in GitHub on :3999 (the app is pointed at it by
// GITHUB_API_URL / GITHUB_WEB_URL in e2e/serve.sh). It plays GitHub's part: the install page sends
// Ben back with a code; the code becomes Ben's token; his token lists his installation; the App's JWT
// (checked here against the key's public half) gets an installation token that lists his repos and
// their history. Checks: Ben connects a repo and its merged pull requests and releases fill the log;
// a callback claiming an installation his GitHub account can't reach is refused; one without the
// cookie from his own browser is refused; Disconnect stops it.
const crypto = require("crypto"), http = require("http"), { execSync } = require("child_process");
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

// ---------- A stand-in GitHub ----------
const GH = { lastState: "", jwtOk: 0, hold: false }; // hold: the install page records the state and stops there
const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
function startGitHub() {
  const pub = (() => { try { return crypto.createPublicKey(Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY || "", "base64").toString()); } catch { return null; } })();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost:3999");
    const auth = req.headers.authorization || "";
    const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    let body = ""; for await (const c of req) body += c;
    if (url.pathname === "/apps/brazework-e2e/installations/new") {
      GH.lastState = url.searchParams.get("state") || "";
      if (GH.hold) { res.writeHead(200, { "content-type": "text/html" }); return res.end("<p>Install Brazework</p>"); }
      res.writeHead(302, { location: `${BASE}/api/github/callback?code=good-code&installation_id=9101&setup_action=install&state=${encodeURIComponent(GH.lastState)}` });
      return res.end();
    }
    if (url.pathname === "/login/oauth/access_token") return JSON.parse(body || "{}").code === "good-code" ? json(200, { access_token: "user-token-ben" }) : json(200, { error: "bad_verification_code" });
    if (url.pathname === "/user") return auth === "Bearer user-token-ben" ? json(200, { id: 501, login: "bencho" }) : json(401, {});
    if (url.pathname === "/user/installations") return auth === "Bearer user-token-ben" ? json(200, { installations: [{ id: 9101, account: { login: "bencho", type: "User" } }] }) : json(401, {});
    if (url.pathname === "/app/installations/9101/access_tokens" && req.method === "POST") {
      // Only a JWT signed with the App's key gets a token, as on GitHub.
      const [h, b, sig] = auth.replace(/^Bearer /, "").split(".");
      const ok = pub && h && b && sig && crypto.createVerify("RSA-SHA256").update(`${h}.${b}`).verify(pub, Buffer.from(sig, "base64url")) && JSON.parse(Buffer.from(b, "base64url").toString()).iss === "1";
      if (!ok) return json(401, { message: "Bad JWT" });
      GH.jwtOk++;
      return json(201, { token: "inst-token-9101", expires_at: new Date(Date.now() + 3600e3).toISOString() });
    }
    if (auth !== "Bearer inst-token-9101") return json(401, {});
    if (url.pathname === "/installation/repositories") return json(200, { repositories: [{ id: 88, full_name: "bencho/flight-computer", html_url: "https://github.com/bencho/flight-computer", default_branch: "main", private: false, pushed_at: ago(1) }] });
    if (url.pathname === "/repos/bencho/flight-computer/pulls") return json(200, [
      { number: 7, title: "Kalman filter for altitude", html_url: "https://github.com/bencho/flight-computer/pull/7", merged_at: ago(2), user: { login: "bencho" } },
      { number: 6, title: "Abandoned idea", html_url: "https://github.com/bencho/flight-computer/pull/6", merged_at: null, user: { login: "bencho" } },
    ]);
    if (url.pathname === "/repos/bencho/flight-computer/releases") return json(200, [{ id: 31, tag_name: "v0.3", name: "Flight computer v0.3", html_url: "https://github.com/bencho/flight-computer/releases/tag/v0.3", draft: false, prerelease: false, published_at: ago(1), author: { login: "bencho" } }]);
    json(404, {});
  });
  return new Promise((ok) => server.listen(3999, "127.0.0.1", () => ok(server)));
}


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

  // ---------- Connect GitHub, end to end ----------
  const gh = await startGitHub();
  const benPage = await as(b, "ben@forge.test");
  const avionics = psql(`select id from projects where owner_id = '${ben}' and title = 'Recovery avionics'`);
  await step("Ben connects GitHub to Recovery avionics: installs, signs in, picks the repo, and its merged PRs and releases fill the log", async () => {
    await go(benPage, `/projects/${avionics}`);
    const card = benPage.getByRole("region", { name: "Connect GitHub" });
    await card.getByRole("link", { name: "Connect GitHub" }).click();
    await benPage.waitForURL((u) => u.searchParams.get("github") === "pick", { timeout: 20000 });
    if (psql("select installed_by || ':' || account_login from github_installations where installation_id = 9101") !== `${ben}:bencho`) throw new Error("the installation wasn't recorded as Ben's");
    await card.getByText("bencho/flight-computer").waitFor({ timeout: 15000 });
    await card.getByRole("button", { name: "Connect" }).click();
    const log = benPage.getByRole("region", { name: "Build log" });
    await log.getByText("bencho/flight-computer is live in this log").waitFor({ timeout: 20000 });
    await log.getByRole("link", { name: /Merged #7: Kalman filter for altitude/ }).waitFor();
    await log.getByRole("link", { name: /Released Flight computer v0\.3/ }).waitFor();
    if (await log.getByText(/Abandoned idea/).count()) throw new Error("an unmerged pull request was logged");
    if (!GH.jwtOk) throw new Error("the App's JWT was never accepted");
  }, benPage);

  await step("a callback that claims an installation Ben's GitHub account can't reach is refused, and so is one from another browser", async () => {
    GH.hold = true; // start a round trip (cookie + state) and stop on the install page
    await benPage.goto(`${BASE}/api/github/connect?project=${avionics}`);
    GH.hold = false;
    await benPage.goto(`${BASE}/api/github/callback?code=good-code&installation_id=9999&setup_action=install&state=${encodeURIComponent(GH.lastState)}`);
    if (new URL(benPage.url()).searchParams.get("github") !== "denied") throw new Error(`expected denied, at ${benPage.url()}`);
    if (psql("select count(*) from github_installations where installation_id = 9999") !== "0") throw new Error("a foreign installation was recorded");
    // Josh replays Ben's state from his own browser: no matching cookie.
    const joshCtx = await b.newContext();
    const res = await joshCtx.request.get(`${BASE}/api/github/callback?code=good-code&installation_id=9101&state=${encodeURIComponent(GH.lastState)}`, { maxRedirects: 0 });
    if (!/github=expired|\/login/.test(res.headers()["location"] || "")) throw new Error(`a replayed state from another browser went to ${res.headers()["location"]}`);
    await joshCtx.close();
  }, benPage);

  await step("Disconnect stops the repo feeding the project; what it logged stays", async () => {
    await go(benPage, `/projects/${avionics}`);
    await benPage.getByRole("button", { name: "Disconnect" }).click();
    await benPage.getByRole("region", { name: "Connect GitHub" }).getByText("bencho/flight-computer").waitFor({ timeout: 15000 });
    if (psql(`select count(*) from project_repos where project_id = '${avionics}'`) !== "0") throw new Error("still linked");
    if (psql(`select count(*) from build_events where project_id = '${avionics}'`) === "0") throw new Error("the history went with it");
  }, benPage);

  await benPage.context().close();
  gh.close();
  await b.close();
  summary();
})();
