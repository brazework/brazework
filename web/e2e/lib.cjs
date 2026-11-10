const { chromium } = require("playwright-core");
const BASE = process.env.BASE || "http://localhost:3200";
const OUT = require("path").join(__dirname, ".results");
require("fs").mkdirSync(OUT, { recursive: true });
const results = [];
async function step(name, fn, page) {
  const t = Date.now();
  try { await fn(); results.push(["PASS", name, Date.now() - t]); console.log("PASS", name); }
  catch (e) { results.push(["FAIL", name, Date.now() - t, e.message.split("\n")[0]]); console.log("FAIL", name, "→", e.message.split("\n")[0].slice(0, 160)); if (page) await page.screenshot({ path: `${OUT}/fail-${name.replace(/\W+/g, "-").slice(0, 40)}.png` }).catch(() => {}); }
}
// Uses your installed Chrome (no browser download). Set E2E_BROWSER=chromium to use Playwright's.
async function browser() { return chromium.launch(process.env.E2E_BROWSER === "chromium" ? {} : { channel: "chrome" }); }
// Logging in happens outside any step, so a slow sign-in on a busy CI machine would end the whole spec:
// try twice, and if both fail, say what the login page showed.
async function as(b, email, viewport = { width: 1440, height: 950 }) {
  for (let attempt = 1; ; attempt++) {
    const ctx = await b.newContext({ viewport });
    const page = await ctx.newPage();
    page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
    try {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', "forge-test-pass-1");
      await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);
      await closeTour(page);
      return page;
    } catch (e) {
      const shown = await page.locator('[role="alert"]').first().textContent({ timeout: 1000 }).catch(() => "");
      await ctx.close();
      if (attempt >= 2) throw new Error(`logging in as ${email} failed twice (${e.message.split("\n")[0]}${shown ? `; the page said: ${shown}` : ""})`);
      console.log(`retrying login for ${email}: ${e.message.split("\n")[0]}`);
    }
  }
}
async function closeTour(page) { await page.waitForTimeout(900); const t = page.getByRole("button", { name: "Close tour" }); if (await t.isVisible().catch(() => false)) await t.click(); }
// Navigate, then wait until React has hydrated the page (its root element carries React props),
// so typing behaves like a person who waits a beat.
async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForFunction(() => { const el = document.querySelector("main input, main textarea, main button"); return !el || Object.keys(el).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 15000 }).catch(() => {});
}
// Wait until React is attached to this element (streamed parts of a page hydrate after the rest).
async function hydrated(locator) {
  await locator.waitFor();
  await locator.evaluate((el) => new Promise((ok) => { const t = setInterval(() => { if (Object.keys(el).some((k) => k.startsWith("__reactProps"))) { clearInterval(t); ok(); } }, 50); }));
}
function summary() { const f = results.filter((r) => r[0] === "FAIL"); console.log(`\n${results.length - f.length}/${results.length} passed`); for (const r of f) console.log("  FAIL", r[1], "→", (r[3] || "").slice(0, 200)); }
module.exports = { BASE, step, browser, as, go, closeTour, hydrated, summary, results };
