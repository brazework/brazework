const { BASE, step, browser, as, go, summary } = require("./lib.cjs");
const pw = require("playwright-core");
(async () => {
  const b = await browser();
  const josh = await as(b, "josh@forge.test");
  await step("search finds clubs and people", async () => {
    await go(josh, "/search?q=rocket");
    await josh.getByText("Rocketry Club").first().waitFor({ timeout: 10000 });
    await go(josh, "/search?q=ben");
    await josh.getByText("Ben Cho").first().waitFor({ timeout: 10000 });
  }, josh);
  await step("settings: who can message me saves and sticks", async () => {
    await go(josh, "/settings#messaging");
    await josh.locator('input[name="who"]').nth(2).check();
    await josh.waitForLoadState("networkidle"); await josh.waitForTimeout(800);
    await go(josh, "/settings#messaging");
    if (!(await josh.locator('input[name="who"]').nth(2).isChecked())) throw new Error("setting did not stick");
    await josh.locator('input[name="who"]').nth(0).check(); await josh.waitForLoadState("networkidle");
  }, josh);
  await step("settings: profile headline saves", async () => {
    await go(josh, "/settings#profile");
    const h = josh.locator('input[name="headline"]').first();
    await h.fill("Aero student, wind tunnels and rockets");
    await josh.getByRole("button", { name: "Save profile" }).click();
    await josh.waitForLoadState("networkidle"); await josh.waitForTimeout(800);
    await go(josh, "/settings#profile");
    if ((await josh.locator('input[name="headline"]').first().inputValue()) !== "Aero student, wind tunnels and rockets") throw new Error("headline not saved");
  }, josh);
  await step("Ember & your data section is there", async () => {
    await go(josh, "/settings#ember");
    await josh.getByText("What it never reads:").waitFor();
  }, josh);
  await step("log out ends the session", async () => {
    await go(josh, "/feed");
    await josh.locator('form[action="/auth/signout"] button').first().click();
    await josh.waitForURL((u) => !u.pathname.startsWith("/feed"), { timeout: 15000 });
    await go(josh, "/feed");
    await josh.waitForURL(/\/login/, { timeout: 10000 });
  }, josh);
  const cara = await as(b, "cara@forge.test");
  await step("a verified company finds Ben by verified work, never his private milestone", async () => {
    await go(cara, "/talent?q=labview");
    const card = cara.locator("article").filter({ hasText: "Ben Cho" });
    await card.getByText("Static fire at 1.2 kN").waitFor({ timeout: 15000 });
    await card.getByText(/Verified by Maya Patel/).first().waitFor();
    if (await cara.getByText("Private milestone").count()) throw new Error("private milestone shown");
    await go(cara, "/talent?q=quantum");
    await cara.getByText("No one matches that yet").waitFor();
    await go(josh, "/talent");
    await josh.getByRole("link", { name: "Register your organization" }).waitFor();
  }, cara);
  await step("signed-out visitors can't open app pages", async () => {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    for (const path of ["/feed", "/messages", "/settings", "/talent", "/u/00000000-0000-0000-0000-000000000000", "/copilot"]) {
      await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
      if (!/\/login/.test(p.url())) throw new Error(`${path} -> ${p.url()}`);
    }
  });
  console.log("page errors:", josh.errs.slice(0, 5));
  summary();
  await b.close();
})();
