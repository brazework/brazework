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
    await josh.getByText("Profile saved.").waitFor({ timeout: 10000 });
    // A real reload: going to the same URL with only a #hash change never reloads (that made this pass
    // even when saving failed).
    await josh.reload({ waitUntil: "networkidle" });
    if ((await josh.locator('input[name="headline"]').first().inputValue()) !== "Aero student, wind tunnels and rockets") throw new Error("headline not saved");
  }, josh);
  await step("a video with captions shows a captions control and its transcript", async () => {
    await go(josh, "/post/vidcap1");
    await josh.getByRole("button", { name: "Hide captions" }).waitFor({ timeout: 10000 }); // on by default
    await josh.getByText("Transcript", { exact: true }).click();
    await josh.getByText("a clean two-second burn").waitFor();
    // Under the video, the build strip: the project, its club-verified proof, a spec and a tool.
    await josh.getByRole("link", { name: /Liquid engine test stand/ }).first().waitFor({ timeout: 10000 });
    await josh.getByText(/\d verified · Rocketry Club/).first().waitFor();
    await josh.getByText("Peak thrust", { exact: true }).waitFor();
    await josh.getByText("LabVIEW", { exact: true }).first().waitFor();
  }, josh);
  await step("settings: graduation year saves and shows on the profile", async () => {
    await go(josh, "/settings#profile");
    await josh.locator('select[name="grad_year"]').selectOption("2027");
    await josh.getByRole("button", { name: "Save profile" }).click();
    await josh.getByText("Profile saved.").waitFor({ timeout: 10000 });
    await josh.reload({ waitUntil: "networkidle" });
    if ((await josh.locator('select[name="grad_year"]').inputValue()) !== "2027") throw new Error("graduation year not saved");
    await go(josh, "/profile");
    await josh.getByText("Class of 2027").first().waitFor({ timeout: 10000 });
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
    // Class year: Ben's card says it, the chip filters to it, and another year finds no one.
    await card.getByText(/Class of 2026/).waitFor();
    await cara.getByRole("link", { name: "Class of 2026" }).click();
    await cara.waitForURL(/year=2026/);
    await cara.locator("article").filter({ hasText: "Ben Cho" }).waitFor();
    await go(cara, "/talent?year=2031");
    await cara.getByText("No one matches that yet").waitFor();
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
  const ben = await as(b, "ben@forge.test");
  await step("preview profile: Ben sees his profile as others do, without his private milestone or owner tools", async () => {
    await go(ben, `/u/${process.env.BEN_ID}`);
    // exact: getByText otherwise matches substrings, case-insensitively, and the preview's own
    // banner says "private milestones".
    await ben.getByText("Private milestone", { exact: true }).first().waitFor({ timeout: 15000 }); // his own view shows it
    await ben.getByRole("link", { name: "Preview" }).click();
    await ben.waitForURL(/view=visitor/);
    await ben.getByText("This is how other members see your profile").waitFor({ timeout: 15000 });
    // Only what's on screen, once the page has settled: Next keeps the page you came from in the DOM
    // (React <Activity>), and for a moment the outgoing owner view is still fading out.
    const onScreen = () => ben.getByText("Private milestone", { exact: true }).evaluateAll((els) => els.filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden").length);
    let seen = await onScreen();
    for (let i = 0; i < 20 && seen; i++) { await ben.waitForTimeout(500); seen = await onScreen(); }
    if (seen) throw new Error("the preview shows a private milestone");
    if (await ben.getByRole("link", { name: "Dashboard" }).count()) throw new Error("the preview shows owner tools");
    await ben.getByRole("link", { name: "Done previewing" }).click();
    await ben.waitForURL((u) => !/view=visitor/.test(u.toString()));
    await ben.getByRole("link", { name: "Dashboard" }).waitFor({ timeout: 15000 });
  }, ben);
  await step("the weekly loop: a company looks at Ben; once he hides the checklist, Home shows his progress, who looked and his builds", async () => {
    await go(cara, `/u/${process.env.BEN_ID}`); // Cara is an admin of Acme Aerospace, a verified company
    await go(ben, "/feed");
    const hide = ben.getByRole("button", { name: "Hide your first five minutes" });
    if (await hide.count()) await hide.click();
    const hero = ben.getByRole("region", { name: "Your progress" });
    await hero.waitFor({ timeout: 15000 });
    await hero.getByRole("heading", { name: "Welcome back, Ben" }).waitFor();
    await hero.getByText("week streak", { exact: true }).waitFor();
    // One sentence about him, from real rows: the company that looked.
    await hero.getByText(/Acme Aerospace looked at your profile/).waitFor({ timeout: 10000 });
    // His builds as cards, each with a one-tap reel.
    const builds = ben.getByRole("region", { name: "Your builds" });
    await builds.getByRole("link", { name: "Start a new build" }).waitFor();
    if (!(await builds.getByRole("link", { name: "Reel" }).count())) throw new Error("no build cards on Home");
    // Hidden for good: a reload keeps the checklist away.
    await ben.reload({ waitUntil: "networkidle" });
    if (await ben.getByRole("button", { name: "Hide your first five minutes" }).count()) throw new Error("the checklist came back after a reload");
    // The club's leaderboard: verified milestones this term, from real rows.
    await go(ben, "/c/rkt");
    await ben.getByRole("region", { name: "Builders this term" }).getByText("Ben Cho").first().waitFor({ timeout: 15000 });
  }, ben);
  await step("project reel: Play reel tells the build as a story, with the club's proof, and closes back to the project", async () => {
    await go(ben, "/projects/p1");
    await ben.getByRole("link", { name: "Play reel" }).click();
    const reel = ben.getByRole("dialog", { name: "Project reel" });
    await reel.waitFor({ timeout: 15000 });
    await reel.getByText("Liquid engine test stand").first().waitFor();
    // Step through to the proof: the officer's name is stamped on it.
    for (let n = 0; n < 8 && !(await reel.getByText(/Signed by Maya Patel/).count()); n++) await ben.keyboard.press("ArrowRight");
    await reel.getByText(/Signed by Maya Patel/).first().waitFor({ timeout: 5000 });
    await ben.keyboard.press("Escape");
    await ben.waitForURL(/\/projects\/p1$/, { timeout: 10000 });
  }, ben);
  await step("the uptime check (/api/health) says the app and database are up, signed out, uncached", async () => {
    const res = await fetch(BASE + "/api/health");
    const body = await res.json();
    if (res.status !== 200 || body.ok !== true || body.db !== "ok") throw new Error(`${res.status} ${JSON.stringify(body)}`);
    if (!/no-store/.test(res.headers.get("cache-control") || "")) throw new Error("cacheable: " + res.headers.get("cache-control"));
  });
  console.log("page errors:", josh.errs.slice(0, 5));
  summary();
  await b.close();
})();
