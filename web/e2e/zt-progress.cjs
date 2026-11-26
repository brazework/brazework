// Progress (the dashboard's first view, lib/progress.ts): a student and a builder who isn't one each
// see what they built, how much is verified and by whom, the tools behind it and their goal, in plain
// sentences; someone with nothing logged gets the first step; engagement moved to Reach; who looked
// stays; nothing scrolls sideways on a phone. Seeded by fixtures/progress-seed.sql, removed after.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { step, browser, as, go, summary } = require("./lib.cjs");

const db = `${process.env.E2E_STACK || "forge-e2e"}-db`;
const psqlFile = (f) => execSync(`docker exec -i ${db} psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q`, { input: fs.readFileSync(path.join(__dirname, "fixtures", f)) });

(async () => {
  psqlFile("progress-seed.sql");
  const b = await browser();
  try {
    const maya = await as(b, "maya@forge.test");
    await step("a student: what she logged this month, how much is verified, by her club and a professor, and the tools behind it", async () => {
      await go(maya, "/dashboard");
      await maya.getByRole("heading", { level: 1, name: "Progress" }).waitFor({ timeout: 15000 });
      const sum = maya.getByRole("list", { name: "Summary" });
      await sum.getByText("You logged 4 milestones in the last 30 days, and 3 are verified.").waitFor();
      await sum.getByText(/Verification took .+, typically, and 1 milestone waits for whoever saw it\./).waitFor();
      await maya.getByText("75%").waitFor();
      const who = maya.getByRole("list", { name: "Who verified" });
      for (const [label, n] of [["Club officers", "2"], ["Professors and TAs", "1"]]) await who.getByRole("listitem").filter({ hasText: label }).getByText(n, { exact: true }).waitFor();
      const tools = maya.getByRole("list", { name: "Tools" });
      for (const t of ["Python", "ROS 2", "SolidWorks"]) await tools.getByText(t, { exact: true }).waitFor();
      await maya.getByText("Grades from your courses never appear here.", { exact: false }).waitFor();
      // Who looked, by company, still sits under it.
      await maya.getByRole("heading", { name: /Companies that looked/ }).waitFor();
    }, maya);

    await step("Reach: likes, comments and views moved to the second tab, and the period carries over", async () => {
      await maya.getByRole("navigation", { name: "Period" }).getByRole("link", { name: "90 days" }).click();
      await maya.waitForURL((u) => u.searchParams.get("range") === "90d", { timeout: 15000 });
      await maya.getByRole("navigation", { name: "Dashboard views" }).getByRole("link", { name: "Reach" }).click();
      await maya.waitForURL((u) => u.searchParams.get("view") === "reach" && u.searchParams.get("range") === "90d", { timeout: 15000 });
      await maya.getByText(/Likes per/).first().waitFor({ timeout: 15000 });
      if (await maya.getByRole("list", { name: "Summary" }).count()) throw new Error("Reach still shows the Progress summary");
    }, maya);

    const cara = await as(b, "cara@forge.test");
    await step("a builder who isn't a student: vouched for by a manager and a mentor, toward her goal", async () => {
      await go(cara, "/dashboard");
      const sum = cara.getByRole("list", { name: "Summary" });
      await sum.getByText("You logged 2 milestones in the last 30 days, and 2 are verified.").waitFor({ timeout: 15000 });
      await sum.getByText(/2 verified milestones since you set your goal: .*backend\./).waitFor();
      const who = cara.getByRole("list", { name: "Who verified" });
      for (const label of ["Managers and coworkers", "Mentors"]) await who.getByText(label).waitFor();
      if (await who.getByText(/Club officers|Professors/).count()) throw new Error("a vouched builder is shown club or class verifiers");
      for (const t of ["Go", "Postgres", "k6"]) await cara.getByRole("list", { name: "Tools" }).getByText(t, { exact: true }).waitFor();
    }, cara);

    const josh = await as(b, "josh@forge.test");
    await step("nothing logged yet: the first step, not empty charts", async () => {
      await go(josh, "/dashboard");
      await josh.getByText("Your progress starts with one milestone").waitFor({ timeout: 15000 });
      await josh.getByRole("link", { name: /Go to your projects/ }).waitFor();
      if (await josh.locator("[data-testid=progress]").count()) throw new Error("empty Progress still draws the charts");
    }, josh);

    const phone = await as(b, "maya@forge.test", { width: 375, height: 812 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await step("phone: the whole page fits, and the summary comes first", async () => {
      await go(phone, "/dashboard");
      await phone.getByRole("list", { name: "Summary" }).waitFor({ timeout: 15000 });
      if (await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("the dashboard scrolls sideways on a phone");
    }, phone);

    await step("no page errors", async () => {
      const errs = [maya, cara, josh, phone].flatMap((p) => p.errs);
      if (errs.length) throw new Error(errs[0]);
    });
  } finally {
    psqlFile("progress-unseed.sql");
    await b.close();
  }
  summary();
})();
