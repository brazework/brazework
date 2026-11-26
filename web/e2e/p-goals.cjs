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
    const row = psql(`select kind || '|' || target || '|' || ('internships' = any (p.open_to)) from public.member_goals g join public.profiles p on p.id = g.uid where g.uid = '${ben}' and g.status = 'active'`);
    if (row !== "internship|power electronics|true") throw new Error("goal row: " + row);
  }, page);

  await step("Torch does the next step: the button hands it to the Ask Torch bar, about this goal", async () => {
    const card = page.getByRole("region", { name: "Your goal" }).first();
    const torch = card.getByRole("button", { name: /^(Add it with Torch|Nudge them with Torch|Find my next milestone|Find who to send it to|What should I do next\?)$/ });
    await torch.waitFor({ timeout: 10000 });
    await card.getByText("nothing happens until you approve").waitFor();
    await torch.click();
    const answer = page.getByRole("region", { name: "Torch's answer" });
    await answer.getByText(/working toward a summer internship in power electronics/).first().waitFor({ timeout: 15000 });
    await answer.getByRole("button", { name: "Close Torch's answer" }).click();
    await card.getByRole("button", { name: "Plan my week" }).waitFor();
  }, page);

  await step("a goal in your own words goes to Torch to set up", async () => {
    await page.getByRole("region", { name: "Your goal" }).first().getByRole("button", { name: "Goal options" }).click();
    await page.getByRole("menuitem", { name: "Change goal" }).click();
    const card = page.getByRole("region", { name: "Your goal" }).first();
    const send = card.getByRole("button", { name: /^Ask Torch to set it up/ });
    if (await send.isEnabled()) throw new Error("an empty goal can be sent to Torch");
    await card.getByLabel("Where are you headed?").fill("a summer internship at a robotics startup");
    await send.click();
    await page.getByRole("region", { name: "Torch's answer" }).getByText(/a summer internship at a robotics startup/).first().waitFor({ timeout: 15000 });
    await page.getByRole("region", { name: "Torch's answer" }).getByRole("button", { name: "Close Torch's answer" }).click();
  }, page);

  await step("the goal is on Home too", async () => {
    await go(page, "/feed");
    await page.getByText("a summer internship in power electronics").first().waitFor({ timeout: 15000 });
  }, page);

  await step("Your week checks in on the goal: how much is signed, under the goal card", async () => {
    await go(page, "/feed");
    const rail = page.getByRole("complementary", { name: "Your week and what's coming up" });
    await rail.getByText(/^\d of 3 signed toward your goal\./).waitFor({ timeout: 15000 });
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
