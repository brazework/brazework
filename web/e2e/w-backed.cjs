// Backed by GitHub (Linear FIX-121): the middle level of proof. Ben has connected his GitHub account
// (id 501) and linked bencho/flight-computer to his project p1 (inserted here, as the server does).
// A stand-in GitHub on :3999 answers for that repo: PR #12 is his and merged, PR #13 is someone
// else's, commit c0ffee1 is his but only on a branch, release v1.0 was published by a CI bot from
// his commit. Checks: "No one yet" backs his own merged work and shows "Backed by GitHub", never
// "Verified", and names the reviewers who approved that pull request on GitHub (approved-by.sql);
// someone else's work, an unmerged commit and the same PR twice are refused in plain
// words and nothing is saved; Maya sees the backed milestone on his profile; a company sees it only
// when it asks for "Signed or backed", labelled as not signed. And his last 90 days: his own merged
// pull requests are offered on the project page and one tap adds them, the private repo's hidden.
const crypto = require("crypto"), http = require("http"), { execSync } = require("child_process");
const { step, browser, as, go, openLogs, summary } = require("./lib.cjs");
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
    if (url.pathname === `${r}/pulls/12`) return json(200, { user: { id: 501 }, merged: true, base: { repo: { private: false } } });
    // Who reviewed PR #12: Sam approved; Lee asked for changes, then approved; Kim's approval was
    // dismissed; a bot and Ben himself "approved" too. Only Sam and Lee count (lib/backing.ts).
    if (url.pathname === `${r}/pulls/12/reviews`) return json(200, [
      { user: { id: 601, login: "sam-rivera", type: "User" }, state: "APPROVED", submitted_at: "2026-11-01T11:00:00Z" },
      { user: { id: 602, login: "lee-park", type: "User" }, state: "CHANGES_REQUESTED", submitted_at: "2026-11-01T09:00:00Z" },
      { user: { id: 602, login: "lee-park", type: "User" }, state: "APPROVED", submitted_at: "2026-11-02T09:00:00Z" },
      { user: { id: 603, login: "kim-ito", type: "User" }, state: "APPROVED", submitted_at: "2026-11-01T08:00:00Z" },
      { user: { id: 603, login: "kim-ito", type: "User" }, state: "DISMISSED", submitted_at: "2026-11-02T08:00:00Z" },
      { user: { id: 501, login: "bencho", type: "User" }, state: "APPROVED", submitted_at: "2026-11-01T12:00:00Z" },
      { user: { id: 900, login: "ci-approver[bot]", type: "Bot" }, state: "APPROVED", submitted_at: "2026-11-01T12:30:00Z" },
    ]);
    // Your last 90 days (lib/recent-work-pick.ts): Ben's login, and two more merged pull requests of
    // his. #21 is in the open with Sam's approval; #22 says its repo is private and two people approved.
    if (url.pathname === "/user/501") return json(200, { login: "bencho", id: 501 });
    if (url.pathname === `${r}/pulls/21`) return json(200, { user: { id: 501 }, merged: true, base: { repo: { private: false } } });
    if (url.pathname === `${r}/pulls/21/reviews`) return json(200, [{ user: { id: 601, login: "sam-rivera", type: "User" }, state: "APPROVED", submitted_at: "2026-11-10T11:00:00Z" }]);
    if (url.pathname === `${r}/pulls/22`) return json(200, { user: { id: 501 }, merged: true, base: { repo: { private: true } } });
    if (url.pathname === `${r}/pulls/22/reviews`) return json(200, [
      { user: { id: 601, login: "sam-rivera", type: "User" }, state: "APPROVED", submitted_at: "2026-11-12T11:00:00Z" },
      { user: { id: 602, login: "lee-park", type: "User" }, state: "APPROVED", submitted_at: "2026-11-12T12:00:00Z" },
    ]);
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
    await openLogs(page); // a long log on the profile is folded (FIX-240)
    const badge = page.locator("[data-backed]").filter({ hasText: `Backed by GitHub · PR #12 in ${REPO}` }).first();
    await badge.waitFor({ timeout: 15000 });
    const item = page.locator("li").filter({ has: badge }).first();
    if (/Verified/.test(await item.innerText())) throw new Error("backed work reads as verified");
    if (psql(`select status from public.milestones where title = 'Telemetry parser merged'`) !== "logged") throw new Error("it should be logged, asking nobody");
  }, page);

  await step("the pull request's reviewers on GitHub are named as having approved it, with nobody asked to sign", async () => {
    const kept = psql(`select approvals || '|' || array_to_string(approvers, ',') || '|' || repo_private from public.milestone_backings where kind = 'pull_request' and ref = '12'`);
    if (kept !== "2|sam-rivera,lee-park|false") throw new Error("approvals kept: " + kept);
    const badge = page.locator("[data-backed]").filter({ hasText: "PR #12" }).first();
    await badge.locator("[data-approved]").filter({ hasText: "approved by @sam-rivera and @lee-park" }).waitFor({ timeout: 15000 });
    const text = await page.locator("li").filter({ has: badge }).first().innerText();
    if (/Verified|Signed by|Vouched/.test(text)) throw new Error("an approval on GitHub reads as a signature: " + text.replace(/\s+/g, " ").slice(0, 200));
    // Only the approval part: the repo is bencho/flight-computer, so the whole line names Ben's account.
    const approved = await badge.locator("[data-approved]").innerText();
    if (/kim-ito|bencho|ci-approver/.test(approved)) throw new Error("someone who didn't approve is named: " + approved);
    if (!/isn't a signature given to Brazework/.test((await badge.getAttribute("title")) ?? "")) throw new Error("the badge doesn't say what an approval is");
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

  await step("your last 90 days: his own merged pull requests are offered on the project, and one tap puts them on his record", async () => {
    // What linking the repo logs (lib/github-actions.ts): two of Ben's merges and a teammate's.
    psql(`insert into public.build_events (project_id, repo_id, kind, title, url, actor, ref, occurred_at, source_id) values
      ('p1', 4242, 'pr_merged', 'Merged #21: Thrust curve fit within 1.5%', 'https://github.com/${REPO}/pull/21', 'bencho', '21', now() - interval '6 days', 'pr:21'),
      ('p1', 4242, 'pr_merged', 'Merged #22: Valve timing controller', 'https://github.com/${REPO}/pull/22', 'bencho', '22', now() - interval '3 days', 'pr:22'),
      ('p1', 4242, 'pr_merged', 'Merged #23: A teammate''s change', 'https://github.com/${REPO}/pull/23', 'someone-else', '23', now() - interval '2 days', 'pr:23'),
      ('p1', 4242, 'pr_merged', 'Merged #20: Long ago', 'https://github.com/${REPO}/pull/20', 'bencho', '20', now() - interval '120 days', 'pr:20')
      on conflict do nothing;`);
    await go(page, "/projects/p1");
    const card = page.getByRole("region", { name: "From GitHub: your last 90 days" });
    await card.waitFor({ timeout: 20000 });
    const list = card.getByRole("list", { name: "Pull requests you merged" });
    if ((await list.getByRole("checkbox").count()) !== 2) throw new Error("offered: " + (await list.innerText()).replace(/\s+/g, " "));
    await list.getByText("Valve timing controller").waitFor();
    await list.getByText("Thrust curve fit within 1.5%").waitFor();
    if (await card.getByText(/teammate|Long ago|Telemetry parser/).count()) throw new Error("a teammate's, an old or an already-backed pull request is offered");
    await card.getByRole("button", { name: "Add 2 to my record" }).click();
    await page.getByRole("status").filter({ hasText: "Added 2 to your record, backed by GitHub. 1 is from a private repo, so only you see it until you choose to show it." }).waitFor({ timeout: 30000 });
    const rows = psql(`select m.title || '|' || m.status || '|' || m.private || '|' || b.approvals || '|' || array_to_string(b.approvers, ',') || '|' || b.repo_private
      from public.milestones m join public.milestone_backings b on b.milestone_id = m.id where b.ref in ('21', '22') order by b.ref`).split("\n");
    if (rows[0] !== "Thrust curve fit within 1.5%|logged|false|1|sam-rivera|false") throw new Error("the public one: " + rows[0]);
    if (rows[1] !== "Valve timing controller|logged|true|2||true") throw new Error("the private one should be hidden, with a count and no names: " + rows[1]);
    await go(page, "/projects/p1");
    if (await page.getByRole("region", { name: "From GitHub: your last 90 days" }).count()) throw new Error("the card still offers what was just added");
    await page.locator("[data-backed]").filter({ hasText: "PR #21" }).locator("[data-approved]").filter({ hasText: "approved by @sam-rivera" }).first().waitFor({ timeout: 15000 });
    await page.locator("[data-backed]").filter({ hasText: "PR #22" }).locator("[data-approved]").filter({ hasText: "approved by 2 reviewers" }).first().waitFor({ timeout: 15000 });
  }, page);

  await step("another member sees Ben's backed work on his profile, labelled", async () => {
    const maya = await as(b, MAYA);
    await go(maya, `/u/${ben}`);
    // p1 has several milestones by now, so its log is folded for a visitor (FIX-240).
    await openLogs(maya);
    await maya.locator("[data-backed]").filter({ hasText: "PR #12" }).first().waitFor({ timeout: 15000 });
    if (await maya.getByText("Someone else's parser").count()) throw new Error("refused work shows");
    // What he added from his last 90 days: the public one shows; the private repo's stays his own.
    await maya.locator("[data-backed]").filter({ hasText: "PR #21" }).first().waitFor({ timeout: 15000 });
    if (await maya.getByText("Valve timing controller").count()) throw new Error("work from a private repo shows to another member");
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
    await card.getByText(/Backed by GitHub · PR #12 in bencho\/flight-computer · approved by @sam-rivera and @lee-park · not signed/).waitFor();
    await card.getByText(/backed/).first().waitFor();
  }, cara);
  await cara.context().close();

  summary();
  await b.close();
  gh.close();
})();
