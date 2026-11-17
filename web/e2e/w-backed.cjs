// Backed by GitHub (Linear FIX-121): the middle level of proof. Ben has connected his GitHub account
// (id 501) and linked bencho/flight-computer to his project p1 (inserted here, as the server does).
// A stand-in GitHub on :3999 answers for that repo: PR #12 is his and merged, PR #13 is someone
// else's, commit c0ffee1 is his but only on a branch, release v1.0 was published by a CI bot from
// his commit. Checks: "No one yet" backs his own merged work and shows "Backed by GitHub", never
// "Verified"; someone else's work, an unmerged commit and the same PR twice are refused in plain
// words and nothing is saved; Maya sees the backed milestone on his profile; a company sees it only
// when it asks for "Signed or backed", labelled as not signed.
const crypto = require("crypto"), http = require("http"), { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");
const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const BEN = "ben@forge.test", MAYA = "maya@forge.test", CARA = "cara@forge.test";
const REPO = "bencho/flight-computer", INST = 9201;

function startGitHub() {
  const pub = (() => { try { return crypto.createPublicKey(Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY || "", "base64").toString()); } catch { return null; } })();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost:3999");
    const auth = req.headers.authorization || "";
    const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    for await (const _ of req); // drain
    if (url.pathname === `/app/installations/${INST}/access_tokens` && req.method === "POST") {
      const [h, b, sig] = auth.replace(/^Bearer /, "").split(".");
      const ok = pub && h && b && sig && crypto.createVerify("RSA-SHA256").update(`${h}.${b}`).verify(pub, Buffer.from(sig, "base64url"));
      return ok ? json(201, { token: "inst-token-backed", expires_at: new Date(Date.now() + 3600e3).toISOString() }) : json(401, { message: "Bad JWT" });
    }
    if (auth !== "Bearer inst-token-backed") return json(401, {});
    const r = `/repos/${REPO}`;
    if (url.pathname === `${r}/pulls/12`) return json(200, { user: { id: 501 }, merged: true });
    if (url.pathname === `${r}/pulls/13`) return json(200, { user: { id: 777 }, merged: true });
    if (url.pathname === `${r}/pulls/14`) return json(200, { user: { id: 501 }, merged: false });
    if (url.pathname === `${r}/commits/c0ffee1`) return json(200, { sha: "c0ffee1000000000000000000000000000000000", author: { id: 501 } });
    if (url.pathname === `${r}/compare/main...c0ffee1000000000000000000000000000000000`) return json(200, { status: "ahead" });
    if (url.pathname === `${r}/releases/tags/v1.0`) return json(200, { author: { id: 41898282, type: "Bot" }, draft: false });
    if (url.pathname === `${r}/commits/v1.0`) return json(200, { sha: "beef", author: { id: 501 } });
    return json(404, { message: "Not Found" });
  });
  return new Promise((ok) => server.listen(3999, () => ok(server)));
}

(async () => {
  const gh = await startGitHub();
  const ben = psql(`select id from auth.users where email = '${BEN}'`);
  psql(`insert into public.github_installations (installation_id, account_login, account_type, installed_by, github_user_id) values (${INST}, 'bencho', 'User', '${ben}', 501) on conflict (installation_id) do update set installed_by = excluded.installed_by, github_user_id = 501, suspended_at = null;
        insert into public.project_repos (project_id, installation_id, repo_id, full_name, html_url, default_branch) values ('p1', ${INST}, 4242, '${REPO}', 'https://github.com/${REPO}', 'main') on conflict do nothing;`);
  const b = await browser();
  const page = await as(b, BEN);

  const add = async (title, evidence) => {
    await go(page, `/u/${ben}`);
    const card = page.locator("article, li, div").filter({ hasText: "Liquid engine test stand" }).filter({ has: page.getByRole("button", { name: /Add milestone/ }) }).last();
    await card.getByRole("button", { name: /Add milestone/ }).click();
    const dlg = page.locator("dialog[open]");
    await dlg.getByRole("radio", { name: /No one yet/ }).click();
    await dlg.locator('input[name="title"]').fill(title);
    await dlg.locator('input[name="evidence"]').fill(evidence);
    await dlg.getByRole("button", { name: "Back it with GitHub" }).click();
    return dlg;
  };
  const count = (t) => Number(psql(`select count(*) from public.milestones where title = '${t.replace(/'/g, "''")}'`));

  await step("his own merged pull request backs the milestone, labelled 'Backed by GitHub', never 'Verified'", async () => {
    const dlg = await add("Telemetry parser merged", `https://github.com/${REPO}/pull/12`);
    await dlg.waitFor({ state: "detached", timeout: 20000 });
    await go(page, `/u/${ben}`);
    const badge = page.locator("[data-backed]").filter({ hasText: `Backed by GitHub · PR #12 in ${REPO}` }).first();
    await badge.waitFor({ timeout: 15000 });
    const item = page.locator("li").filter({ has: badge }).first();
    if (/Verified/.test(await item.innerText())) throw new Error("backed work reads as verified");
    if (psql(`select status from public.milestones where title = 'Telemetry parser merged'`) !== "logged") throw new Error("it should be logged, asking nobody");
  }, page);

  await step("someone else's work, an unmerged pull request and a commit only on a branch are refused, and nothing is saved", async () => {
    for (const [title, link, says] of [
      ["Someone else's parser", `https://github.com/${REPO}/pull/13`, /someone else made this/],
      ["Parser not merged yet", `https://github.com/${REPO}/pull/14`, /isn't merged yet/],
      ["Commit on a branch", `https://github.com/${REPO}/commit/c0ffee1`, /isn't on the repo's main branch/],
      ["Not GitHub", "https://example.com/video", /isn't a GitHub commit, pull request or release/],
    ]) {
      const dlg = await add(title, link);
      await dlg.getByRole("alert").filter({ hasText: says }).waitFor({ timeout: 15000 });
      if (count(title)) throw new Error(`"${title}" was saved`);
    }
  }, page);

  await step("the same pull request can't back a second milestone", async () => {
    const dlg = await add("Parser merged, again", `https://github.com/${REPO}/pull/12`);
    await dlg.getByRole("alert").filter({ hasText: /already backs another milestone/ }).waitFor({ timeout: 15000 });
    if (count("Parser merged, again")) throw new Error("the duplicate was saved");
  }, page);

  await step("a release a CI bot published counts for the person whose commit it tags", async () => {
    const dlg = await add("Flight computer v1.0", `https://github.com/${REPO}/releases/tag/v1.0`);
    await dlg.waitFor({ state: "detached", timeout: 20000 });
    if (psql(`select count(*) from public.milestone_backings where kind = 'release' and ref = 'v1.0'`) !== "1") throw new Error("the release wasn't backed");
  }, page);

  await step("another member sees Ben's backed work on his profile, labelled", async () => {
    const maya = await as(b, MAYA);
    await go(maya, `/u/${ben}`);
    await maya.locator("[data-backed]").filter({ hasText: "PR #12" }).first().waitFor({ timeout: 15000 });
    if (await maya.getByText("Someone else's parser").count()) throw new Error("refused work shows");
    await maya.context().close();
  }, page);

  const cara = await as(b, CARA);
  await step("company search: signed only by default; 'Signed or backed' adds it, marked not signed", async () => {
    await go(cara, "/talent?q=telemetry");
    await cara.getByText(/0 people with verified work/).waitFor({ timeout: 15000 });
    await cara.getByRole("link", { name: "Signed or backed by GitHub" }).click();
    await cara.waitForURL(/level=backed/);
    const card = cara.locator("article").filter({ hasText: "Telemetry parser merged" }).first();
    await card.waitFor({ timeout: 15000 }).catch(async (e) => { console.log("PAGE:", cara.url(), (await cara.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 600)); throw e; });
    await card.getByText(/Backed by GitHub · PR #12 in bencho\/flight-computer · not signed/).waitFor();
    await card.getByText(/backed/).first().waitFor();
  }, cara);
  await cara.context().close();

  summary();
  await b.close();
  gh.close();
})();
