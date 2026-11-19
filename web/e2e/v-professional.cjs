// Someone who already works (Linear FIX-120). Brazework is for anyone who builds, so a professional
// with no club isn't sent to "Find your club" or told to "Join your club": after onboarding they
// land on Today, start with what they're building, and the next steps send them to a person who saw
// it. The landing page says who signs for a student, an employee and someone on their own.
const { step, browser, go, closeTour, hydrated, summary } = require("./lib.cjs");

(async () => {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage(); page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  const email = `pat${Date.now() % 100000}@voltline.test`;

  await step("landing: one record for someone studying, working and on their own, each with who signed", async () => {
    await go(page, "/");
    const who = page.locator("#who");
    for (const h of ["Studying", "Working", "On your own"]) await who.getByRole("heading", { name: h, exact: true }).waitFor();
    const signed = await who.getByText(/^Verified by /).count();
    if (signed !== 3) throw new Error(`expected 3 signed examples, got ${signed}`);
    await page.locator("#faq").getByRole("button", { name: "I already work. Is this for me?" }).waitFor();
    const text = await page.locator("main").innerText();
    if (/for students and clubs/i.test(text)) throw new Error("the landing page still says it's for students and clubs");
  }, page);

  await step("landing on a phone: the three stages stack and nothing scrolls sideways", async () => {
    const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
    await go(phone, "/");
    await phone.locator("#who").getByRole("heading", { name: "On your own", exact: true }).scrollIntoViewIfNeeded();
    const wide = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (wide > 1) throw new Error(`the page scrolls sideways by ${wide}px`);
    const tops = await phone.locator("#who li h3").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    if (!(tops[0] < tops[1] && tops[1] < tops[2])) throw new Error("the stages should stack on a phone: " + tops.join(","));
    await phone.context().close();
  }, page);

  await step("sign up as a professional with a work email", async () => {
    await go(page, "/signup");
    await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', "forge-test-pass-1");
    await page.locator('button[type="submit"]').click();
    await page.getByText("Check your inbox").first().waitFor({ timeout: 20000 });
  }, page);

  await step("About you: choosing Professional makes it a three-step path (no club step)", async () => {
    await go(page, "/feed");
    await page.waitForURL(/onboarding/, { timeout: 15000 });
    await page.getByRole("heading", { name: "About you" }).waitFor({ timeout: 15000 });
    await page.getByText("Step 2 of 4").waitFor();
    await hydrated(page.getByRole("button", { name: /professional/i }));
    await page.getByRole("button", { name: /professional/i }).click();
    await page.getByText("Employed, freelancing or building on your own.").waitFor();
    await page.getByText("Step 2 of 3").waitFor();
    await page.fill('input[name="firstName"]', "Pat"); await page.fill('input[name="lastName"]', "Okoro");
    await page.fill('input[name="birthday"]', "1996-03-12");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Step 3 of 3").waitFor({ timeout: 20000 });
  }, page);

  await step("onboarding asks for a profession, then goes straight to Today (no 'Find your club')", async () => {
    await page.waitForFunction(() => { const el = document.querySelector('input[name="headline"]'); return el && Object.keys(el).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 15000 });
    await page.getByText("Your profession").waitFor();
    await page.fill('input[name="headline"]', "Controls engineer at Voltline");
    const fieldBtn = page.getByRole("button", { name: /Mechanical|Aerospace/ }).first();
    if (await fieldBtn.isVisible().catch(() => false)) await fieldBtn.click();
    let need = await page.getByText(/Pick \d more interest/).count();
    for (let i = 0; need && i < 12; i++) { await page.locator('button[aria-pressed="false"]').nth(i).click().catch(() => {}); need = await page.getByText(/Pick \d more interest/).count(); }
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/feed/, { timeout: 20000 });
    if (/onboarding\/club/.test(page.url())) throw new Error("a professional was sent to Find your club");
  }, page);
  await closeTour(page);

  await step("Today starts with their work: the first-build box, and nothing says to join a club first", async () => {
    await hydrated(page.locator("#first-build"));
    const text = await page.locator("main").innerText();
    if (/Next: Join your club/.test(text)) throw new Error("Today told a professional to join a club first");
  }, page);

  await step("after the first build, the steps are about the work and a person who saw it", async () => {
    await page.fill("#first-build", "A pick-and-place cell for the battery line");
    await page.getByRole("button", { name: /Start my build/ }).first().click();
    const list = page.getByRole("region", { name: "Get started" });
    await list.waitFor({ timeout: 20000 });
    const text = await list.innerText();
    if (!/\/4/.test(text)) throw new Error("a professional's list should have 4 steps, got: " + text.replace(/\s+/g, " ").slice(0, 160));
    if (!text.includes("Next: Post an update about it")) throw new Error("the next step should be the update, got: " + text.replace(/\s+/g, " ").slice(0, 160));
    // The rest of the list opens on a tap.
    await list.getByRole("button", { name: /All steps/ }).click();
    await list.getByText("Ask someone who saw it to verify a milestone").waitFor({ timeout: 10000 });
    const all = await list.innerText();
    if (/club/i.test(all)) throw new Error("the list mentions a club: " + all.replace(/\s+/g, " ").slice(0, 240));
  }, page);

  summary();
  await b.close();
})();
