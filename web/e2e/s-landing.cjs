// The landing page's demos (components/landing, Linear FIX-117). Signed out, on a laptop and a phone:
// the hero's milestone gets signed and a company asks to talk; the app tour's loop runs from Clubs
// (verify) to Record to Inbox (accept); Ember answers and waits for the OK; the club checklist ticks;
// the company search only finds signed work. With reduced motion, nothing waits on an animation.
const { BASE, step, browser, go, hydrated, summary } = require("./lib.cjs");

(async () => {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  const tab = (p, name) => p.locator("#app").getByRole("tab", { name: new RegExp(`^${name}`) }).locator("visible=true").first();

  await step("hero: the example milestone is signed, then a company asks to talk, and you can answer", async () => {
    await go(page, "/");
    const stage = page.locator("#hero-preview");
    await hydrated(page.locator("#hero-build"));
    await stage.getByText("A line-following robot").waitFor();
    // The AI moment: asked in plain words, the draft with its evidence, sent to the club, then the officer verifies.
    await stage.getByText("Your AI drafts it").waitFor();
    await stage.getByText("Sent to Rocketry Club").waitFor({ timeout: 10000 });
    await stage.getByRole("list", { name: "Evidence" }).getByText(/github\.com/).waitFor();
    await stage.getByText("Verified", { exact: true }).waitFor({ timeout: 10000 });
    // The title block under the sheet fills in: on the record once it's signed, then who found it.
    const record = stage.locator('dl[aria-label="Where this record stands"]');
    await record.getByText("On the record").waitFor();
    await record.getByText("Ben C.").waitFor();
    await stage.getByRole("button", { name: "Accept" }).click({ timeout: 10000 });
    await record.getByText("Acme Aerospace").waitFor();
    await stage.getByText(/You're talking/).waitFor();
  }, page);

  await step("hero: the chips tell it for someone else (an analyst whose manager signs), and pressing Sign yourself signs it", async () => {
    const stage = page.locator("#hero-preview");
    // Six ways of working, one chip each (lib/landing-demo.ts HERO_STORIES); picking one stops the autoplay.
    const ways = stage.getByRole("group", { name: "Ways people use Brazework" });
    if ((await ways.getByRole("button").count()) !== 6) throw new Error("expected six story chips");
    await ways.getByRole("button", { name: /^Analyst/ }).click();
    await stage.getByRole("list", { name: "Evidence" }).getByText(/claude\.ai/).waitFor({ timeout: 10000 });
    await stage.getByText("Dana Ruiz", { exact: true }).waitFor();
    await stage.getByRole("button", { name: "Sign", exact: true }).click();
    await stage.getByText("Signed", { exact: true }).waitFor();
    await stage.getByRole("button", { name: "Accept" }).waitFor({ timeout: 10000 });
  }, page);

  await step("tour: before anything is signed, Record and Inbox say so", async () => {
    const app = page.locator("#app");
    await tab(page, "Record").click();
    await app.getByText(/isn't here yet/).waitFor();
    await tab(page, "Inbox").click();
    await app.getByText("No requests yet").waitFor();
  }, page);

  await step("tour: the hint opens Clubs; verifying puts the milestone on Record", async () => {
    const app = page.locator("#app");
    await app.getByRole("button", { name: "Open Clubs" }).click();
    await app.getByRole("heading", { name: "Rocketry Club" }).waitFor();
    await app.getByRole("button", { name: "Verify" }).click();
    await app.getByText(/It's on Maya's record/).waitFor();
    await tab(page, "Record").click();
    const panel = app.locator("#tour-panel");
    await panel.getByText("Beat the course in 41.2 seconds").waitFor();
    await panel.getByText("Verified by Rocketry Club").waitFor();
    if (await panel.getByText(/isn't here yet/).count()) throw new Error("Record still says the run is waiting");
  }, page);

  await step("tour: the request is in Inbox; accepting it finishes the loop", async () => {
    const app = page.locator("#app");
    await app.getByRole("button", { name: "Open Inbox" }).click();
    await app.getByText(/Free to talk about our robotics internship/).waitFor();
    await app.getByRole("button", { name: "Accept" }).click();
    await app.getByText(/Thursday afternoon works/).waitFor();
    await app.getByText("That's the loop: built, signed, found.").waitFor();
    await app.getByRole("button", { name: "Start the tour over" }).click();
    await app.getByRole("button", { name: "Open Clubs" }).waitFor();
  }, page);

  await step("Ember: it answers, shows a card, and does nothing until you press the button", async () => {
    const ember = page.locator("#ember");
    await ember.getByRole("button", { name: "Find clubs for me" }).click();
    await ember.getByText("Checked clubs at your school").waitFor();
    const act = ember.getByRole("button", { name: "Ask to join" });
    await act.click({ timeout: 15000 });
    await ember.getByText("Request sent to Robotics Society").waitFor();
  }, page);

  await step("clubs: the setup card ticks rules and the invite link, and shows the message to paste", async () => {
    const clubs = page.locator("#clubs");
    await clubs.getByText("1 of 5 done", { exact: false }).waitFor();
    await clubs.getByRole("button", { name: "Use starter rules" }).click();
    await clubs.getByRole("button", { name: "Get invite link" }).click();
    await clubs.getByText("3 of 5 done", { exact: false }).waitFor();
    await clubs.getByText(/We're moving Rocketry Club to Brazework/).waitFor();
  }, page);

  await step("companies: search finds signed work only, and a message is a request", async () => {
    const co = page.locator("#companies");
    await co.getByLabel("Find builders").fill("pcb");
    await co.getByText('1 person with signed work matching "pcb"').waitFor();
    await co.getByText("Theo Nguyen").waitFor();
    if (await co.getByText("Maya Patel").count()) throw new Error("the search didn't narrow the list");
    await co.getByRole("button", { name: "Message" }).click();
    await co.getByText(/It waits in their Requests/).waitFor();
    await co.getByLabel("Find builders").fill("blockchain");
    await co.getByText(/No signed work matches that/).waitFor();
  }, page);

  await step("the page raised no errors", async () => { if (page.errs.length) throw new Error(page.errs[0]); }, page);

  // A phone: the tour's places are the app's tab bar, and the hero's box is full height.
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await step("phone: the build box is a full-size field and the tour runs from the tab bar", async () => {
    await go(phone, "/");
    const box = await phone.locator("#hero-build").boundingBox();
    if (!box || box.height < 44) throw new Error(`the build box is ${box && Math.round(box.height)}px tall`);
    await tab(phone, "Clubs").click();
    await phone.locator("#app").getByRole("button", { name: "Verify" }).click();
    await phone.locator("#app").getByText(/It's on Maya's record/).waitFor();
    const cut = await phone.locator("#app").getByText(/It's on Maya's record/).evaluate((el) => { const r = el.getBoundingClientRect(), p = document.querySelector("#tour-panel").getBoundingClientRect(); return r.bottom > p.bottom; });
    if (cut) throw new Error("the verified line is cut off by the frame");
  }, phone);

  await step("the AI guide: a signed-out visitor follows the footer to /ai and finds the setup, what to ask, the rules and all 20 fields", async () => {
    await go(page, "/");
    await page.locator("footer").getByRole("link", { name: "Connect your AI" }).click();
    await page.waitForURL(/\/ai$/, { timeout: 15000 });
    await page.getByRole("heading", { level: 1, name: /Your AI fills in your record/ }).waitFor();
    for (const h of ["Set it up in two minutes", "What to ask", "What it never does", "Your field"]) await page.getByRole("heading", { name: h, exact: true }).waitFor();
    await page.getByText(/\/api\/mcp$/).first().waitFor();
    await page.getByText("/start", { exact: true }).waitFor();
    const fields = await page.getByRole("navigation", { name: "Fields" }).getByRole("link").count();
    if (fields !== 20) throw new Error(`${fields} field links, expected 20`);
    await page.getByRole("navigation", { name: "Fields" }).getByRole("link", { name: "Medicine" }).click();
    await page.getByRole("heading", { name: "Medicine", exact: true }).waitFor();
    if (!(await page.locator("#medicine").isVisible())) throw new Error("the Medicine section isn't shown");
  }, page);

  // Reduced motion: the whole sequence is simply there.
  const still = await (await b.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: "reduce" })).newPage();
  await step("reduced motion: the hero shows every step at once", async () => {
    await still.goto(BASE + "/", { waitUntil: "networkidle" });
    const stage = still.locator("#hero-preview");
    await stage.getByText("Verified", { exact: true }).waitFor({ timeout: 3000 });
    await stage.getByText("Sent to Rocketry Club").waitFor({ timeout: 3000 });
    await stage.getByRole("button", { name: "Accept" }).click({ timeout: 3000 });
    await stage.locator('dl[aria-label="Where this record stands"]').getByText("Acme Aerospace").waitFor({ timeout: 3000 });
  }, still);

  await b.close();
  summary();
})();
