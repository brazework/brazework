const { BASE, step, browser, as, go, closeTour, summary } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage(); page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  const email = `dana${Date.now() % 100000}@forge.edu`;
  await step("sign up as a new student", async () => {
    await go(page, "/signup");
    await page.getByRole("button", { name: /student/i }).first().click();
    await page.fill('input[name="firstName"]', "Dana"); await page.fill('input[name="lastName"]', "Reyes");
    await page.fill('input[name="birthday"]', "2003-05-01");
    await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', "forge-test-pass-1");
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
  }, page);
  await step("sign-up asks to confirm the email", async () => {
    await page.getByText("Check your inbox").first().waitFor({ timeout: 20000 });
  }, page);
  await step("once confirmed (auto-confirmed locally), the app opens on onboarding", async () => {
    await go(page, "/feed");
    await page.waitForURL(/onboarding/, { timeout: 15000 });
    await page.waitForFunction(() => { const el = document.querySelector('input[name="headline"]'); return el && Object.keys(el).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 15000 });
  }, page);
  await step("finish onboarding (field, 3 interests)", async () => {
    await page.fill('input[name="headline"]', "Mechanical Engineering, junior");
    const fieldBtn = page.getByRole("button", { name: /Mechanical|Aerospace/ }).first();
    if (await fieldBtn.isVisible().catch(() => false)) await fieldBtn.click();
    for (const t of ["Rocketry", "Robotics", "CAD"]) { const c = page.getByRole("button", { name: new RegExp(`^#?${t}$`) }).first(); if (await c.isVisible().catch(() => false)) await c.click(); }
    let need = await page.getByText(/Pick \d more interest/).count();
    for (let i = 0; need && i < 12; i++) { await page.locator('button[aria-pressed="false"]').nth(i).click().catch(() => {}); need = await page.getByText(/Pick \d more interest/).count(); }
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/feed/, { timeout: 20000 });
  }, page);
  await closeTour(page);
  await step("feed is never empty for a new member", async () => {
    await page.locator("article").first().waitFor({ timeout: 10000 });
  }, page);
  const body = `Hello Forge! Thanks @Ben Cho for the static fire writeup ${Date.now() % 1000}`;
  await step("Home shows the first-five-minutes checklist, starting with your club", async () => {
    const list = page.getByRole("region", { name: "Get started" });
    await list.waitFor({ timeout: 15000 });
    const current = list.locator('[aria-current="step"]');
    if (!(await current.innerText()).includes("Join your club")) throw new Error("step 1 should be Join your club, got: " + (await current.innerText()));
    if (!(await list.innerText()).includes("0 of 5 done")) throw new Error("progress should start at 0 of 5");
  }, page);
  await step("post with an @mention (autocomplete picks Ben)", async () => {
    const box = page.locator("#create-box");
    await box.click(); await box.pressSequentially("Hello Forge! Thanks @Be", { delay: 25 });
    await page.getByRole("option", { name: /Ben Cho/ }).waitFor({ timeout: 10000 });
    await box.press("Enter");
    await box.pressSequentially(`for the static fire writeup ${Date.now() % 1000}`, { delay: 5 });
    if (!(await box.inputValue()).includes("@Ben Cho ")) throw new Error("mention not inserted: " + (await box.inputValue()));
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await page.locator("article a", { hasText: "@Ben Cho" }).first().waitFor({ timeout: 15000 });
  }, page);
  await step("your new post shows first in For you (desktop and phone)", async () => {
    await go(page, "/feed");
    const first = await page.locator("article").first().innerText();
    if (!first.includes("Hello Forge! Thanks")) throw new Error("first post is: " + first.slice(0, 80));
    const phone = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, storageState: await page.context().storageState() });
    const pp = await phone.newPage();
    await go(pp, "/feed");
    const firstPhone = await pp.locator("article").first().innerText();
    await phone.close();
    if (!firstPhone.includes("Hello Forge! Thanks")) throw new Error("phone first post is: " + firstPhone.slice(0, 80));
  }, page);
  await step("mention renders as a profile link", async () => {
    const href = await page.locator("article a", { hasText: "@Ben Cho" }).first().getAttribute("href");
    if (!/^\/u\/[0-9a-f-]{36}$/.test(href)) throw new Error(href);
  }, page);
  const ben = await as(b, "ben@forge.test");
  await step("Ben gets a real 'mentioned you' notification", async () => {
    await go(ben, "/notifications");
    await ben.getByText(/Dana Reyes mentioned you in a post/).first().waitFor({ timeout: 10000 });
  }, ben);
  await step("notification opens the post", async () => {
    await ben.getByText(/Dana Reyes mentioned you in a post/).first().click();
    await ben.waitForURL(/\/post\//, { timeout: 10000 });
    await ben.getByText("Hello Forge! Thanks").first().waitFor();
  }, ben);
  await step("Ben answers Maya's question right in his feed", async () => {
    await go(ben, "/feed");
    const q = ben.locator("article").filter({ hasText: "Kalman filtering" }).first();
    await q.getByRole("button", { name: /^Answer/ }).click();
    await q.getByPlaceholder("Write an answer…").fill("Start with a complementary filter.");
    await q.getByPlaceholder("Write an answer…").press("Enter");
    await q.getByText("Start with a complementary filter.").waitFor({ timeout: 10000 });
    await ben.waitForLoadState("networkidle");
    await go(ben, "/feed");
    const again = ben.locator("article").filter({ hasText: "Kalman filtering" }).first();
    if ((await again.getByText("Start with a complementary filter.").count()) !== 1) throw new Error("answer missing or duplicated after reload");
  }, ben);
  console.log("page errors:", [...page.errs, ...ben.errs].slice(0, 5));
  summary();
  await b.close();
})();
