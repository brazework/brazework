// A project's milestone log on a profile folds to one line (FIX-240): a visitor sees it folded with its
// summary and latest signed result, opens and closes it, and a #milestone-… link opens the right log at
// the right milestone. On your own profile "Add milestone" stays in reach while it's folded, and a log
// with something waiting for a signature starts open. Ben gets a project of his own for this, with its
// own milestones, removed at the end so the other journeys see the seed as they expect.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = process.env.BEN_ID || psql("select id from auth.users where email = 'ben@forge.test'");

(async () => {
  const b = await browser();
  psql(`alter table public.milestones disable trigger user;
    insert into public.projects (id, owner_id, title, summary, status, tags) values ('plog', '${ben}', 'Log e2e test stand', 'A project for the milestone log journey.', 'in_progress', '{Rocketry}') on conflict (id) do nothing;
    insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, detail, achieved_on, status, reviewer_name, reviewed_at, private) values
      ('log0', 'plog', '${ben}', 'rkt', 'Rocketry Club', 'Log e2e: hot fire at 900 N', '', current_date, 'verified', 'Maya Patel', now() - interval '9 days', false),
      ('log1', 'plog', '${ben}', 'rkt', 'Rocketry Club', 'Log e2e: igniter test passed', '', current_date - 30, 'verified', 'Maya Patel', now() - interval '29 days', false),
      ('log2', 'plog', '${ben}', 'rkt', 'Rocketry Club', 'Log e2e: nozzle reprinted', '', current_date - 60, 'verified', 'Maya Patel', now() - interval '59 days', false)
    on conflict (id) do nothing;
    alter table public.milestones enable trigger user;`);
  const log = (page) => page.locator("article").filter({ hasText: "Log e2e test stand" }).locator("[data-milestone-log]");

  const maya = await as(b, "maya@forge.test");
  await step("a visitor sees the log folded to its summary, with the latest signed result under it", async () => {
    await go(maya, `/u/${ben}`);
    const l = log(maya);
    const toggle = l.getByRole("button", { name: /3 milestones · 3 signed · latest / });
    await toggle.waitFor({ timeout: 15000 });
    if ((await toggle.getAttribute("aria-expanded")) !== "false") throw new Error("the log should start folded for a visitor");
    if (!/Log e2e: hot fire at 900 N · Verified by Maya Patel, Rocketry Club/.test(await l.locator("[data-log-latest]").innerText())) throw new Error("the latest signed result isn't shown under the summary");
    if (await l.getByText("Log e2e: nozzle reprinted").isVisible()) throw new Error("a folded log shows its milestones");
  }, maya);

  await step("the visitor opens it from the keyboard, sees every milestone newest first, and closes it", async () => {
    const l = log(maya);
    const toggle = l.getByRole("button", { name: /3 milestones/ });
    await toggle.focus();
    await maya.keyboard.press("Enter");
    if ((await toggle.getAttribute("aria-expanded")) !== "true") throw new Error("Enter didn't open it");
    const order = await l.locator("ol > li[id^='milestone-']").evaluateAll((els) => els.map((e) => e.id));
    if (order.join(",") !== "milestone-log0,milestone-log1,milestone-log2") throw new Error("log order: " + order.join(","));
    if (await l.locator("[data-log-latest]").count()) throw new Error("the preview stays while the log is open");
    await toggle.click();
    if ((await toggle.getAttribute("aria-expanded")) !== "false") throw new Error("it didn't close");
    if (await l.getByText("Log e2e: nozzle reprinted").isVisible()) throw new Error("closed, but its milestones still show");
  }, maya);

  await step("a link to a milestone opens its project's log and scrolls to it", async () => {
    await go(maya, `/u/${ben}#milestone-log2`);
    const row = maya.locator("#milestone-log2");
    await row.waitFor({ state: "visible", timeout: 15000 });
    if ((await log(maya).getByRole("button", { name: /3 milestones/ }).getAttribute("aria-expanded")) !== "true") throw new Error("the deep link didn't open the log");
    await maya.waitForFunction(() => { const r = document.getElementById("milestone-log2").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, null, { timeout: 5000 });
  }, maya);

  await step("the proof list links each result into its log", async () => {
    await go(maya, `/u/${ben}`);
    // Its title in the proof list opens the log at that milestone. The list shows three results and
    // folds the rest; earlier journeys add results of their own, so open the fold if it's in there.
    const proof = maya.locator("#proof"), link = proof.getByRole("link", { name: "Log e2e: hot fire at 900 N" });
    if (!(await link.isVisible())) await proof.locator("details > summary").click();
    await link.click();
    await maya.locator("#milestone-log0").waitFor({ state: "visible", timeout: 10000 });
  }, maya);

  await step("print shows the whole log, folded or not", async () => {
    await go(maya, `/u/${ben}`);
    await maya.emulateMedia({ media: "print" });
    if (!(await maya.locator("#milestone-log2").isVisible())) throw new Error("print hides a folded log");
    await maya.emulateMedia({ media: "screen" });
  }, maya);

  await step("on a phone it folds and opens the same way", async () => {
    await maya.setViewportSize({ width: 390, height: 844 });
    await go(maya, `/u/${ben}`);
    const toggle = log(maya).getByRole("button", { name: /3 milestones/ });
    await toggle.click();
    await maya.locator("#milestone-log1").waitFor({ state: "visible", timeout: 10000 });
    const wide = await maya.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (wide) throw new Error("the page scrolls sideways on a phone");
  }, maya);
  await maya.context().close();

  const page = await as(b, "ben@forge.test");
  await step("your own folded log keeps Add milestone in reach", async () => {
    await go(page, `/u/${ben}`);
    const card = page.locator("article").filter({ hasText: "Log e2e test stand" });
    if ((await log(page).getByRole("button", { name: /3 milestones/ }).getAttribute("aria-expanded")) !== "false") throw new Error("nothing waits, so it should start folded");
    await card.getByRole("button", { name: "Add milestone" }).waitFor({ timeout: 10000 });
  }, page);

  await step("your own log starts open while a milestone waits for a signature", async () => {
    psql(`alter table public.milestones disable trigger user;
      insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, detail, achieved_on, status, private) values
        ('log3', 'plog', '${ben}', 'rkt', 'Rocketry Club', 'Log e2e: waiting for the club', '', current_date - 1, 'pending', false) on conflict (id) do nothing;
      alter table public.milestones enable trigger user;`);
    await go(page, `/u/${ben}`);
    const toggle = log(page).getByRole("button", { name: /4 milestones · 3 signed/ });
    await toggle.waitFor({ timeout: 15000 });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") throw new Error("a log with something waiting should start open for its owner");
    await page.getByText("Log e2e: waiting for the club").waitFor({ state: "visible" });
  }, page);

  psql("alter table public.milestones disable trigger user; delete from public.milestones where id in ('log0', 'log1', 'log2', 'log3'); delete from public.projects where id = 'plog'; alter table public.milestones enable trigger user;");
  await b.close();
  summary();
})();
