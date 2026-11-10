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
  await step("weekly digest: the cron needs its secret, counts a dry run, and respects Settings", async () => {
    const url = BASE + "/api/cron/digest";
    const secret = process.env.CRON_SECRET || "cron_forge_e2e";
    const anon = await fetch(url);
    if (anon.status !== 401) throw new Error("no secret should be refused, got " + anon.status);
    const run = async () => { const r = await fetch(url, { headers: { authorization: `Bearer ${secret}` } }); if (r.status !== 200) throw new Error("digest " + r.status + " " + (await r.text())); return r.json(); };
    const before = await run();
    if (before.emailOn !== false || before.dry !== true) throw new Error("without a key it should be a dry run: " + JSON.stringify(before));
    await go(josh, "/settings#email");
    const box = josh.locator("#email-weekly");
    if (!(await box.isChecked())) throw new Error("the digest should be on by default");
    await box.uncheck();
    await josh.getByText("Weekly emails are off.").waitFor({ timeout: 10000 });
    const after = await run();
    if (after.wouldSend + after.quiet !== before.wouldSend + before.quiet - 1) throw new Error(`turning it off should drop Josh: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    await box.check();
    await josh.getByText("You'll get your week by email.").waitFor({ timeout: 10000 });
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
    // Josh logged out in the step before; a fresh session for him.
    const j = await as(b, "josh@forge.test");
    await go(j, "/talent");
    await j.getByRole("link", { name: "Register your organization" }).waitFor();
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
