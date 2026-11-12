// Goals (supabase/goals.sql, Linear FIX-95): Ben picks what he's working toward on his profile and sees
// his path and next step; it's on Home too; Josh sees "Working toward …" on Ben's profile; reaching it
// closes it with a note, and the card asks what's next. The goal ticks "Open to: internships".
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");
const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = psql("select id from auth.users where email = 'ben@forge.test'");

(async () => {
  const b = await browser();
  psql(`update public.member_goals set status = 'dropped' where uid = '${ben}' and status = 'active';`);
  const page = await as(b, "ben@forge.test");

  await step("Ben sets a goal on his profile and sees his path", async () => {
    await go(page, `/u/${ben}`);
    const card = page.getByRole("region", { name: "Your goal" }).first();
    await card.getByText("What are you working toward?").waitFor({ timeout: 15000 });
    await card.getByRole("radio", { name: "Internship" }).click();
    await card.getByPlaceholder("e.g. power electronics, robotics, CRISPR").fill("power electronics");
    await card.getByRole("button", { name: "Set my goal" }).click();
    await page.getByText("a summer internship in power electronics").first().waitFor({ timeout: 15000 });
    await page.getByText("Next step:").first().waitFor();
    if (!(await page.getByRole("link", { name: "Ask Ember" }).first().isVisible())) throw new Error("Ask Ember link missing");
    const row = psql(`select kind || '|' || target || '|' || ('internships' = any (p.open_to)) from public.member_goals g join public.profiles p on p.id = g.uid where g.uid = '${ben}' and g.status = 'active'`);
    if (row !== "internship|power electronics|true") throw new Error("goal row: " + row);
  }, page);

  await step("the goal is on Home too", async () => {
    await go(page, "/feed");
    await page.getByText("a summer internship in power electronics").first().waitFor({ timeout: 15000 });
  }, page);

  const josh = await as(b, "josh@forge.test");
  await step("Josh sees what Ben is working toward", async () => {
    await go(josh, `/u/${ben}`);
    await josh.getByText("Working toward a summer internship in power electronics").waitFor({ timeout: 15000 });
  }, josh);

  await step("Ben reaches it: closed with a note, and the card asks what's next", async () => {
    await go(page, `/u/${ben}`);
    await page.getByRole("button", { name: "Goal options" }).first().click();
    await page.getByRole("menuitem", { name: "I got it!" }).click();
    await page.getByPlaceholder("e.g. Accepted an offer at Volt Systems").fill("Accepted an offer at Volt Systems");
    await page.getByRole("button", { name: "Mark it reached" }).click();
    await page.getByText("What's next?").first().waitFor({ timeout: 15000 });
    await page.getByText("Reached a summer internship in power electronics.").first().waitFor();
    const st = psql(`select status || '|' || met_note from public.member_goals where uid = '${ben}' order by id desc limit 1`);
    if (st !== "met|Accepted an offer at Volt Systems") throw new Error("after reaching: " + st);
  }, page);

  await b.close();
  summary();
})();
