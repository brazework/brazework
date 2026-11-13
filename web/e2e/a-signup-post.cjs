const { BASE, step, browser, as, go, closeTour, summary } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage(); page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  const email = `dana${Date.now() % 100000}@forge.edu`;
  const schoolDomain = `college${Date.now() % 100000}.qc.ca`;
  await step("a student email the app doesn't recognize offers 'Request your school'", async () => {
    await go(page, "/signup");
    await page.getByRole("button", { name: /student/i }).first().click();
    await page.fill('input[name="firstName"]', "Sam"); await page.fill('input[name="lastName"]', "Roy");
    await page.fill('input[name="birthday"]', "2003-05-01");
    await page.fill('input[name="email"]', `sam@${schoolDomain}`); await page.fill('input[name="password"]', "forge-test-pass-1");
    await page.locator('button[type="submit"]').click();
    await page.getByText(/Use your university email/).waitFor({ timeout: 15000 });
    await page.locator("#request-school").click();
    await page.waitForURL(/\/request-school/);
    if ((await page.locator("#school-domain").inputValue()) !== schoolDomain) throw new Error("domain not prefilled");
    await page.fill("#school-name", "Test College");
    await page.getByRole("button", { name: "Request my school" }).click();
    await page.getByText(/^Requested\./).waitFor({ timeout: 15000 });
    require("fs").writeFileSync(require("path").join(__dirname, ".results", "school-domain.txt"), schoolDomain);
  }, page);
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
    await page.waitForURL(/\/onboarding\/club/, { timeout: 20000 });
  }, page);
  await step("then 'Find your club', with clubs to join, before the feed", async () => {
    await page.getByRole("heading", { name: "Find your club" }).waitFor();
    await page.getByText("Rocketry Club").first().waitFor({ timeout: 10000 });
    await page.getByRole("link", { name: /Skip for now/ }).click();
    await page.waitForURL(/\/feed/, { timeout: 20000 });
  }, page);
  await closeTour(page);
  await step("feed is never empty for a new member", async () => {
    await page.locator("article").first().waitFor({ timeout: 10000 });
  }, page);
  const body = `Hello Brazework! Thanks @Ben Cho for the static fire writeup ${Date.now() % 1000}`;
  await step("Home shows the first-five-minutes checklist, starting with your club", async () => {
    const list = page.getByRole("region", { name: "Get started" });
    await list.waitFor({ timeout: 15000 });
    const text = await list.innerText();
    if (!text.includes("Next: Join your club")) throw new Error("the next step should be Join your club, got: " + text.slice(0, 120));
    if (!text.includes("0/5")) throw new Error("progress should start at 0/5");
  }, page);
  await step("post with an @mention (autocomplete picks Ben)", async () => {
    const box = page.locator("#create-box");
    await box.click(); await box.pressSequentially("Hello Brazework! Thanks @Be", { delay: 25 });
    await page.getByRole("option", { name: /Ben Cho/ }).waitFor({ timeout: 10000 });
    await box.press("Enter");
    await box.pressSequentially(`for the static fire writeup ${Date.now() % 1000}`, { delay: 5 });
    if (!(await box.inputValue()).includes("@Ben Cho ")) throw new Error("mention not inserted: " + (await box.inputValue()));
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await page.locator("article a", { hasText: "@Ben Cho" }).first().waitFor({ timeout: 15000 });
  }, page);
  await step("your new post shows first in Everyone (desktop and phone)", async () => {
    await go(page, "/feed");
    const first = await page.locator("article").first().innerText();
    if (!first.includes("Hello Brazework! Thanks")) throw new Error("first post is: " + first.slice(0, 80));
    const phone = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, storageState: await page.context().storageState() });
    const pp = await phone.newPage();
    await go(pp, "/feed");
    const firstPhone = await pp.locator("article").first().innerText();
    await phone.close();
    if (!firstPhone.includes("Hello Brazework! Thanks")) throw new Error("phone first post is: " + firstPhone.slice(0, 80));
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
    await ben.getByText("Hello Brazework! Thanks").first().waitFor();
  }, ben);
  await step("Ben answers Maya's question right in his feed", async () => {
    await go(ben, "/feed");
    const q = ben.locator("article").filter({ hasText: "Kalman filtering" }).first();
    await q.getByRole("button", { name: /^Answer/ }).click();
    await q.getByPlaceholder("Write an answer…").fill("Start with a complementary filter.");
    await q.getByPlaceholder("Write an answer…").press("Enter");
    await q.getByText("Start with a complementary filter.").waitFor({ timeout: 10000 });
    await ben.waitForLoadState("networkidle");
    // Saved exactly once: checked on the post's own page. Home's feed is virtualized and ranked, so
    // after the answer the question can sit below the cards that are rendered (CI saw exactly that).
    const href = await q.locator('a[href^="/post/"]').first().getAttribute("href");
    await go(ben, href);
    const saved = ben.getByText("Start with a complementary filter.");
    await saved.first().waitFor({ timeout: 15000 }).catch(() => { throw new Error("answer missing after reload"); });
    if ((await saved.count()) !== 1) throw new Error(`answer shown ${await saved.count()} times after reload`);
  }, ben);
  console.log("page errors:", [...page.errs, ...ben.errs].slice(0, 5));
  await step("a photo without a description gets a prompt; describing it clears the prompt", async () => {
    const file = require("path").join(require("os").tmpdir(), "forge-e2e-photo.png");
    // A real 64x64 PNG, so the upload and conversion run exactly as for a phone photo.
    const zlib = require("zlib"), w = 64, h = 64, raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = x * 4; raw[i + 1] = y * 4; raw[i + 2] = 160; }
    const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (b) => { let r = 0xffffffff; for (const x of b) r = table[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    require("fs").writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
    await go(page, "/feed");
    await page.locator('input[type="file"][accept^="image"]').first().setInputFiles(file);
    const prompt = page.getByRole("button", { name: "Add description" });
    await prompt.waitFor({ timeout: 20000 });
    await prompt.click();
    await page.locator("#alt-text").fill("Blue and green gradient test card");
    await page.getByText("Save", { exact: true }).click();
    await prompt.waitFor({ state: "detached", timeout: 10000 });
    await page.getByText(/· alt/).first().waitFor();
  }, page);
  await step("the photo post saves and shows in the feed (the database accepts what the upload records)", async () => {
    const text = `Gradient test card ${Date.now() % 100000}`;
    await page.locator("#create-box").fill(text);
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#create-box")?.value === "", null, { timeout: 30000 });
    const card = page.locator("article").filter({ hasText: text }).first();
    await card.waitFor({ timeout: 15000 });
    if (!(await card.locator("img").count())) throw new Error("the post saved without its photo");
  }, page);
  await step("a 7 MB video uploads resumably (TUS, with progress), posts with a poster frame, and doesn't preload (FIX-10)", async () => {
    // The 2-second test clip padded with an MP4 "free" box to 7 MB, so it takes the resumable path (over 6 MB).
    const fs = require("fs"), path = require("path");
    const clip = fs.readFileSync(path.join(__dirname, "fixtures", "test-run.mp4"));
    const pad = Buffer.alloc(7 * 1024 * 1024 - clip.length); pad.writeUInt32BE(pad.length, 0); pad.write("free", 4);
    const file = path.join(require("os").tmpdir(), "forge-e2e-run.mp4");
    fs.writeFileSync(file, Buffer.concat([clip, pad]));
    const resumable = [];
    page.on("request", (r) => { if (r.url().includes("/storage/v1/upload/resumable")) resumable.push(r.method()); });
    await go(page, "/feed");
    await page.locator('input[type="file"][accept^="video"]').first().setInputFiles(file);
    const text = `Static fire clip ${Date.now() % 100000}`;
    await page.locator("#create-box").fill(text);
    const post = page.getByRole("button", { name: "Post", exact: true });
    await page.waitForFunction(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Post"); return b && !b.disabled; }, null, { timeout: 60000 });
    if (!resumable.includes("POST")) throw new Error(`a 7 MB video didn't use the resumable upload (saw: ${resumable.join(",") || "nothing"})`);
    await post.click();
    await page.waitForFunction(() => document.querySelector("#create-box")?.value === "", null, { timeout: 30000 });
    const card = page.locator("article").filter({ hasText: text }).first();
    await card.waitFor({ timeout: 15000 });
    const v = card.locator("video").first();
    await v.waitFor({ timeout: 15000 });
    const st = await v.evaluate((el) => ({ poster: el.getAttribute("poster"), preload: el.getAttribute("preload"), paused: el.paused, src: el.currentSrc || el.getAttribute("src") }));
    if (!st.poster) throw new Error("the video posted without a poster frame");
    if (st.preload !== "none" || !st.paused) throw new Error(`the video should wait for a tap: ${JSON.stringify(st)}`);
    const size = await page.evaluate(async (u) => Number((await fetch(u, { method: "HEAD" })).headers.get("content-length")), st.src);
    if (size !== 7 * 1024 * 1024) throw new Error(`the stored video is ${size} bytes, not the 7 MB uploaded`);
    const poster = await page.evaluate(async (u) => (await fetch(u)).status, st.poster);
    if (poster !== 200) throw new Error(`the poster doesn't load (${poster})`);
  }, page);
  summary();
  await b.close();
})();
