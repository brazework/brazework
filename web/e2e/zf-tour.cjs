// The guided tour (FIX-236): while it runs the page underneath can't scroll or be clicked; every step
// of the welcome tour spotlights a real element on today's pages, with the card clear of it; closing at any step (Done, ✕ or
// Escape) gives the page back; "Take the tour" in the menu on your photo replays it.
// Maya's "seen the welcome tour" row is removed so the tour starts the way it does for a new member.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const unsee = () => psql("delete from public.seen_tours where key = 'welcome' and user_id = (select id from auth.users where email = 'maya@forge.test')");
const seen = () => psql("select count(*) from public.seen_tours where key = 'welcome' and user_id = (select id from auth.users where email = 'maya@forge.test')");

// The welcome tour as a new member sees it (lib/tours.ts welcomeSteps), with the anchor each step lights.
const STEPS = [
  [/^Welcome to Brazework/, null],
  ["Five places", "menu"],
  ["Ask Jig, or log what you did", "search"],
  ["Your feed", "feed-tabs"],
  ["Share progress", "composer"],
  ["Projects", "projects"],
  ["Proof", "proof"],
  ["Your record", "share"],
  ["Clubs", "clubs"],
  ["Ask your AI", "ai-tools"],
  ["Notifications", "bell"],
  ["You're all set", null],
];

const card = (page) => page.getByRole("dialog", { name: /./ }).filter({ has: page.getByRole("button", { name: "Close tour" }) });
const locked = (page) => page.evaluate(() => getComputedStyle(document.documentElement).overflow === "hidden" && !!document.querySelector("[data-tour-lock]"));

// The spotlight has settled around the step's (visible) target.
async function lit(page, target) {
  await page.waitForFunction((t) => {
    const spot = document.querySelector("[data-tour-spot]");
    const el = [...document.querySelectorAll(`[data-tour="${t}"]`)].find((e) => e.getClientRects().length > 0);
    if (!spot || !el) return false;
    const s = spot.getBoundingClientRect(), r = el.getBoundingClientRect();
    const near = (a, b) => Math.abs(a - b) < 12;
    // Clamped to the screen, so compare what's visible of the target.
    return near(s.left, Math.max(r.left - 6, 4)) && near(s.top, Math.max(r.top - 6, 4)) && r.bottom > 0 && r.top < innerHeight;
  }, target, { timeout: 15000 });
}

// The card has moved clear of the spotlight (it slides there, so give it a moment).
async function clear(page, what) {
  await page.waitForFunction(() => {
    const c = document.querySelector("[data-tour-card]")?.getBoundingClientRect(), s = document.querySelector("[data-tour-spot]")?.getBoundingClientRect();
    if (!c || !s) return false;
    return !(Math.min(c.right, s.right - 6) > Math.max(c.left, s.left + 6) && Math.min(c.bottom, s.bottom - 6) > Math.max(c.top, s.top + 6));
  }, null, { timeout: 5000 }).catch(() => { throw new Error(`the card covers what it points at (${what})`); });
}

(async () => {
  const b = await browser();

  const page = await as(b, "maya@forge.test");
  await step("the welcome tour starts for someone who hasn't seen it, and locks the page", async () => {
    unsee();
    await go(page, "/feed");
    await card(page).getByRole("heading", { name: STEPS[0][0] }).waitFor({ timeout: 15000 });
    if (!(await locked(page))) throw new Error("the page isn't locked while the tour runs");
    const before = await page.evaluate(() => scrollY);
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 1500);
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(400);
    if ((await page.evaluate(() => scrollY)) !== before) throw new Error("the page scrolled under the tour");
    // A click on the sidebar lands on the lock, not the link.
    const hit = await page.evaluate(() => { const a = document.querySelector('nav[aria-label="Main"] a[href="/messages"]'); const r = a.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.hasAttribute("data-tour-lock"); });
    if (!hit) throw new Error("the page underneath can still be clicked");
  }, page);

  await step("every step lights a real, current element, with the page locked throughout", async () => {
    for (let n = 0; n < STEPS.length; n++) {
      const [title, target] = STEPS[n];
      await card(page).getByRole("heading", { name: title, exact: typeof title === "string" }).waitFor({ timeout: 20000 });
      const count = await card(page).getByText(new RegExp(`^${n + 1} / ${STEPS.length}$`)).count();
      if (!count) throw new Error(`step ${n + 1} (${title}) isn't numbered ${n + 1} / ${STEPS.length}: a step was skipped`);
      if (target) { await lit(page, target); await clear(page, title); }
      if (!(await locked(page))) throw new Error(`the page unlocked at step ${n + 1} (${title})`);
      await card(page).getByRole("button", { name: n === STEPS.length - 1 ? "Done" : "Next" }).click();
    }
    await card(page).waitFor({ state: "detached", timeout: 10000 });
    if (await locked(page)) throw new Error("the page is still locked after Done");
    await page.waitForTimeout(800);
    if (seen() !== "1") throw new Error("finishing the tour wasn't remembered");
  }, page);

  await step("Take the tour in the menu on your photo replays it, and ✕ gives the page back", async () => {
    await go(page, "/feed");
    await page.getByRole("button", { name: /profile, settings and log out/ }).first().click();
    await page.getByRole("button", { name: "Take the tour" }).click();
    await card(page).getByRole("heading", { name: STEPS[0][0] }).waitFor({ timeout: 15000 });
    await card(page).getByRole("button", { name: "Next" }).click();
    await lit(page, "menu");
    await card(page).getByRole("button", { name: "Close tour" }).click();
    await card(page).waitFor({ state: "detached", timeout: 10000 });
    if (await locked(page)) throw new Error("the page is still locked after closing");
    const before = await page.evaluate(() => scrollY);
    await page.mouse.move(700, 600);
    await page.mouse.wheel(0, 800);
    await page.waitForFunction((y) => scrollY !== y, before, { timeout: 5000 });
  }, page);

  // A phone: the places are the tab bar at the bottom, so the card moves up out of its way.
  const phone = await as(b, "maya@forge.test", { width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  await step("phone: the tour lights the tab bar with the card above it, and Escape mid-tour unlocks", async () => {
    unsee();
    await go(phone, "/feed");
    await card(phone).getByRole("heading", { name: STEPS[0][0] }).waitFor({ timeout: 15000 });
    if (!(await locked(phone))) throw new Error("the page isn't locked on a phone");
    await card(phone).getByRole("button", { name: "Next" }).click();
    await card(phone).getByRole("heading", { name: "Five places" }).waitFor();
    await lit(phone, "menu");
    await clear(phone, "the tab bar");
    await card(phone).getByRole("button", { name: "Next" }).click();
    await card(phone).getByRole("heading", { name: "Ask Jig, or log what you did" }).waitFor();
    await lit(phone, "search");
    await clear(phone, "the Ask Jig bar");
    await phone.keyboard.press("Escape");
    await card(phone).waitFor({ state: "detached", timeout: 10000 });
    if (await locked(phone)) throw new Error("the page is still locked after Escape");
    const before = await phone.evaluate(() => scrollY);
    await phone.evaluate(() => scrollBy(0, 600));
    if ((await phone.evaluate(() => scrollY)) === before) throw new Error("the page can't scroll after the tour");
  }, phone);

  await b.close();
  summary();
})();
