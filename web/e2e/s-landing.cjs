// The landing page (redesign 2026-11): short, with the product to play with in the hero. Signed out,
// on a laptop and a phone: typing a build puts it on the milestone card and carries it into sign-up;
// the example signs itself, another build waits for its signer, and Sign signs it; the 3D view is one
// of three; how it works, who it's for and where each starts; the page stays short; with reduced
// motion, nothing waits on an animation.
const { BASE, step, browser, go, hydrated, summary } = require("./lib.cjs");

(async () => {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));

  await step("hero: the example milestone signs itself, and what you type lands on the card and goes with you to sign-up", async () => {
    await go(page, "/");
    const card = page.locator("#hero-card");
    await card.getByText(/Signed by J\. Reyes/).waitFor({ timeout: 10000 });
    await hydrated(page.locator("#hero-build"));
    await page.locator("#hero-build").fill("Thrust stand calibrated to 0.4 percent");
    await card.getByText("Thrust stand calibrated to 0.4 percent").waitFor();
    await card.getByText(/Waiting for J\. Reyes/).waitFor();
    const href = await page.locator("#top").getByRole("link", { name: /Get it signed/ }).getAttribute("href");
    if (new URL(href, BASE).searchParams.get("build") !== "Thrust stand calibrated to 0.4 percent") throw new Error(`the button doesn't carry the build: ${href}`);
  }, page);

  await step("hero: another build waits for its own signer, and Sign signs it", async () => {
    const builds = page.getByRole("group", { name: "Example builds" });
    await builds.getByRole("button", { name: "Robot arm" }).click();
    if ((await builds.getByRole("button", { name: "Robot arm" }).getAttribute("aria-pressed")) !== "true") throw new Error("Robot arm isn't marked as the build");
    const card = page.locator("#hero-card");
    await card.getByText(/Benchtop cobot arm/).waitFor();
    await card.getByRole("button", { name: "Sign as Dana R." }).click();
    await card.getByText(/Signed by Dana R\./).waitFor();
  }, page);

  await step("hero: the 3D build draws (or says it can't), and its view is one of Render, Section or Stress", async () => {
    await page.waitForFunction(() => ["ready", "failed"].includes(document.querySelector("#cad-stage")?.getAttribute("data-state") ?? ""), null, { timeout: 30000 });
    if ((await page.locator("#cad-stage").getAttribute("data-state")) === "ready" && !(await page.locator("#cad-stage canvas").count())) throw new Error("ready, but no canvas");
    for (const mode of ["Section", "Stress", "Render"]) {
      await page.getByRole("radio", { name: mode }).click();
      const on = await page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { checked: true }).allInnerTexts();
      if (on.length !== 1 || !on[0].includes(mode)) throw new Error(`after ${mode}, the views marked are ${on.join(", ")}`);
    }
  }, page);

  await step("how it works: three steps straight after the hero; the signed state shows once you scroll to it, and the nav says where you are", async () => {
    const how = page.locator("#how");
    await how.getByRole("heading", { name: "Log it. Get it signed. Keep it." }).waitFor();
    const order = await page.locator("main > section").evaluateAll((els) => els.map((el) => el.id));
    if (order[0] !== "top" || order[1] !== "how") throw new Error(`the page starts ${order.slice(0, 3).join(", ")}`);
    const states = how.locator("ol > li figcaption");
    if ((await states.count()) !== 3) throw new Error("expected three steps");
    // At the top of the page the line hasn't reached any step yet.
    await states.nth(2).waitFor({ state: "hidden" });
    await states.nth(2).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 300);
    await states.nth(2).waitFor({ state: "visible", timeout: 10000 });
    if (!/Signed by Dana R\./.test(await states.nth(2).innerText())) throw new Error("the third step isn't the signed one");
    await page.locator('header a[aria-current="location"]').filter({ hasText: "How it works" }).waitFor();
    await go(page, "/");
  }, page);

  await step("who it's for: builders, clubs and companies, each with where to start", async () => {
    const sec = page.locator("#for");
    for (const h of ["Builders", "Clubs", "Companies"]) await sec.getByRole("heading", { name: h, exact: true }).waitFor();
    await sec.getByRole("link", { name: /Bring your club/ }).click();
    await page.locator("#founding").getByRole("heading", { name: /first clubs/ }).waitFor();
    await go(page, "/");
    await page.locator("#for").getByRole("link", { name: /Company pricing/ }).click();
    await page.waitForURL(/\/pricing#pricing-companies$/, { timeout: 15000 });
    await page.getByText("$15,000").first().waitFor();
    await go(page, "/");
  }, page);

  await step("the page is short: a few screens on a laptop", async () => {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (h > 950 * 5) throw new Error(`the page is ${h}px tall, more than five screens`);
  }, page);

  await step("the AI guide: a signed-out visitor follows the footer to /ai and finds the setup, what to ask, the rules and all 20 fields", async () => {
    await go(page, "/");
    await page.locator("footer").getByRole("link", { name: "Connect your AI" }).click();
    await page.waitForURL(/\/ai$/, { timeout: 15000 });
    await page.getByRole("heading", { level: 1, name: /Your AI fills in your record/ }).waitFor();
    for (const h of ["Set it up in two minutes", "What to ask", "What it never does", "Your field"]) await page.getByRole("heading", { name: h, exact: true }).waitFor();
    await page.getByText(/\/api\/mcp$/).first().waitFor();
    // Ask your AI to set it up: one tap opens Claude or ChatGPT with the prompt, and the prompt can be read first.
    const ask = page.getByRole("region", { name: "Ask your AI to set it up" }).first();
    for (const [name, host] of [["Ask Claude", "https://claude.ai/new?q="], ["Ask ChatGPT", "https://chatgpt.com/?q="]]) {
      const href = (await ask.getByRole("link", { name }).getAttribute("href")) ?? "";
      if (!href.startsWith(host) || !decodeURIComponent(href).includes("/api/mcp") || /forge_|Bearer/.test(href)) throw new Error(`${name} link: ${href.slice(0, 120)}`);
    }
    await ask.getByText("Read the prompt").click();
    await ask.getByText(/add it only after I say yes/).waitFor();
    await ask.getByRole("button", { name: "Copy the prompt" }).click();
    await ask.getByRole("status").waitFor({ timeout: 5000 });
    await page.getByText("/start", { exact: true }).waitFor();
    const fields = await page.getByRole("navigation", { name: "Fields" }).getByRole("link").count();
    if (fields !== 20) throw new Error(`${fields} field links, expected 20`);
    await page.getByRole("navigation", { name: "Fields" }).getByRole("link", { name: "Medicine" }).click();
    await page.getByRole("heading", { name: "Medicine", exact: true }).waitFor();
    if (!(await page.locator("#medicine").isVisible())) throw new Error("the Medicine section isn't shown");
  }, page);

  await step("the page raised no errors", async () => { if (page.errs.length) throw new Error(page.errs[0]); }, page);

  // A phone: the build box is full size, the hero keeps its height while you play with it, nothing scrolls sideways.
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await step("phone: the build box is a full-size field, the hero holds its height, and nothing scrolls sideways", async () => {
    await go(phone, "/");
    const box = await phone.locator("#hero-build").boundingBox();
    if (!box || box.height < 44) throw new Error(`the build box is ${box && Math.round(box.height)}px tall`);
    const hero = phone.locator("#top");
    const before = Math.round((await hero.boundingBox()).height);
    await phone.getByRole("group", { name: "Example builds" }).getByRole("button", { name: "Gearbox" }).click();
    await phone.locator("#hero-card").getByRole("button", { name: /Sign as/ }).click();
    await phone.locator("#hero-card").getByText(/Signed by Prof\. Alvarez/).waitFor();
    const after = Math.round((await hero.boundingBox()).height);
    if (Math.abs(after - before) > 2) throw new Error(`the hero changed height: ${before} to ${after}px`);
    if (await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("phone has horizontal overflow");
  }, phone);

  await step("phone: the steps swipe sideways without making the page wider", async () => {
    const how = phone.locator("#how");
    const next = how.getByRole("button", { name: "Next card" });
    await hydrated(next);
    for (const value of ["2 of 3", "3 of 3"]) {
      await next.click();
      await how.getByText(value, { exact: true }).waitFor({ timeout: 5000 });
    }
    if (!(await next.isDisabled())) throw new Error("the last card still allows moving forward");
    if (await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("the page overflows sideways");
  }, phone);

  // Reduced motion: everything is simply there.
  const still = await (await b.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: "reduce" })).newPage();
  const reducedErrors = [];
  still.on("pageerror", (error) => reducedErrors.push(error.message));
  await step("reduced motion: the hero's milestone is signed from the start, and every step's state shows", async () => {
    await still.goto(BASE + "/", { waitUntil: "networkidle" });
    // No waiting on an animation; the timeout only covers hydrating on a slow machine (CI).
    await still.locator("#hero-card").getByText(/Signed by J\. Reyes/).waitFor({ timeout: 10000 });
    await still.locator("#how ol > li figcaption").nth(2).waitFor({ state: "visible", timeout: 10000 });
    if (reducedErrors.length) throw new Error(reducedErrors[0]);
  }, still);

  await b.close();
  summary();
})();
