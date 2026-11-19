// Build-first onboarding (the Product Hunt launch, docs/superpowers/specs/2026-11-19-product-hunt-launch-design.md):
// after About you, the way in is the first milestone. What you built (carried from the landing page,
// field guessed) → proof → who saw it → your profile, with the milestone on it.
// 1. Product Hunt visitors are welcomed on the landing page and sign-up.
// 2. A student types a build on the landing page, signs up, and finds it waiting; the field is guessed.
// 3. Asking a professor fails here (email is off in this stack) and says so; sending it to a club
//    instead works, and the retry doesn't start a second project.
// 4. A second newcomer with no proof finishes with a draft, and the welcome says so.
// 5. /pricing is public and says the record is free.
const { execSync } = require("child_process");
const { step, browser, go, hydrated, summary } = require("./lib.cjs");
const psql = (sql) => execSync(`docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -tA`, { input: sql }).toString().trim();

(async () => {
  const b = await browser();
  const n = Date.now() % 100000;
  const BUILD = `A line-following robot for the spring expo ${n}`;

  async function newcomer(page, email, first) {
    await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', "forge-test-pass-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByText("Check your inbox").first().waitFor({ timeout: 20000 });
    await go(page, "/onboarding");
    await page.getByRole("heading", { name: "About you" }).waitFor({ timeout: 15000 });
    await page.getByText("Step 2 of 5").waitFor();
    await hydrated(page.getByRole("button", { name: /student/i }));
    await page.getByRole("button", { name: /student/i }).click();
    await page.fill('input[name="firstName"]', first); await page.fill('input[name="lastName"]', "Build");
    await page.fill('input[name="birthday"]', "2003-05-01");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Step 3 of 5").waitFor({ timeout: 20000 });
    await hydrated(page.locator("#first-build-text"));
  }

  // 1 + 2: from Product Hunt, with a build typed on the landing page.
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  const email = `eli${n}@forge.edu`;
  await step("a visitor from Product Hunt is welcomed on the landing page", async () => {
    await go(page, "/?ref=producthunt");
    await page.getByRole("status", { name: "Welcome from Product Hunt" }).waitFor({ timeout: 15000 });
    const box = page.locator("#hero-build");
    await hydrated(box);
    await box.fill(BUILD);
    await page.getByRole("link", { name: /Start with this build/ }).click();
    await page.waitForURL((u) => u.pathname === "/signup", { timeout: 20000 });
    await page.getByRole("status", { name: "Welcome from Product Hunt" }).waitFor({ timeout: 15000 });
  }, page);
  await step("after About you, 'What did you build?' has the landing page's build and a guessed field", async () => {
    await newcomer(page, email, "Eli");
    await page.getByRole("heading", { name: /What did you build/ }).waitFor();
    if ((await page.locator("#first-build-text").inputValue()) !== BUILD) throw new Error("the landing page's build isn't waiting");
    await page.getByRole("radio", { name: "Engineering", checked: true }).waitFor();
    await page.getByRole("button", { name: /Next: proof/ }).click();
  }, page);
  await step("proof: a link", async () => {
    await page.getByText("Step 4 of 5").waitFor({ timeout: 10000 });
    await page.getByRole("radio", { name: /A link/ }).click();
    await page.getByPlaceholder("https://github.com/you/your-project").fill(`https://github.com/eli/robot-${n}`);
    await page.getByRole("button", { name: /Next: who saw it/ }).click();
    await page.getByText("Step 5 of 5").waitFor({ timeout: 10000 });
  }, page);
  await step("asking a professor says why it didn't go (email is off here); nothing is half-saved", async () => {
    await page.getByRole("radio", { name: /A professor or mentor/ }).click();
    await page.locator('input[name="signerEmail"]').fill("prof.lee@utexas.edu");
    await page.getByRole("button", { name: "Ask for a signature" }).click();
    await page.getByRole("alert").waitFor({ timeout: 20000 });
    const msg = await page.getByRole("alert").innerText();
    if (!/isn't available|couldn't send/.test(msg)) throw new Error("unexpected message: " + msg);
    const left = psql(`select count(*) from public.milestones m join public.profiles p on p.id = m.owner_id join auth.users u on u.id = p.id where u.email = '${email}'`);
    if (left !== "0") throw new Error(`a milestone was left waiting on an ask that never went out (${left})`);
  }, page);
  let club = "";
  await step("sending it to a club instead joins the club and lands on the profile, waiting for its officers", async () => {
    await page.getByRole("radio", { name: /My club/ }).click();
    const first = page.getByRole("radiogroup", { name: "Your club" }).getByRole("radio").first();
    await first.waitFor({ timeout: 10000 });
    club = (await first.locator("span.truncate").innerText()).trim();
    await first.click();
    await page.getByRole("button", { name: new RegExp(`Send to`) }).click();
    await page.waitForURL(/\/u\/[0-9a-f-]{36}\?welcome=1/, { timeout: 30000 });
    await page.getByRole("region", { name: "Welcome to Brazework" }).getByText(/waiting for .* officers to verify it/).waitFor({ timeout: 15000 });
  }, page);
  await step("one project (the retry reused it), one pending milestone for that club, profile filled in", async () => {
    const q = (sql) => psql(sql.replace("ME", `(select id from auth.users where email = '${email}')`));
    if (q("select count(*) from public.projects where owner_id = ME") !== "1") throw new Error("expected exactly one project");
    const ms = q("select m.status || '|' || c.name from public.milestones m join public.communities c on c.id = m.community_id where m.owner_id = ME");
    if (ms !== `pending|${club}`) throw new Error(`milestone: ${ms}, club picked: ${club}`);
    const p = q("select field || '|' || headline || '|' || onboarded || '|' || cardinality(interests) from public.profiles where id = ME");
    if (p !== "Engineering|Engineering student|t|3") throw new Error("profile: " + p);
  }, page);
  await ctx.close();

  // 4: no proof yet.
  const ctx2 = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage(); p2.errs = []; p2.on("pageerror", (e) => p2.errs.push(e.message));
  await step("on a phone, with no proof yet: the field is guessed, and it finishes as a draft", async () => {
    await go(p2, "/signup");
    await newcomer(p2, `fay${n}@forge.edu`, "Fay");
    await p2.locator("#first-build-text").fill("A podcast on our town's history");
    await p2.getByRole("radio", { name: "Media & Communication", checked: true }).waitFor();
    await p2.getByRole("button", { name: /Next: proof/ }).click();
    await p2.getByRole("radio", { name: /Add it later/ }).click();
    await p2.getByRole("button", { name: /Next: who saw it/ }).click();
    await p2.getByText(/A signature needs proof to look at/).waitFor({ timeout: 10000 });
    await p2.getByRole("button", { name: "Finish" }).click();
    await p2.waitForURL(/\/u\/[0-9a-f-]{36}\?welcome=1/, { timeout: 30000 });
    await p2.getByRole("region", { name: "Welcome to Brazework" }).getByText(/as a draft/).waitFor({ timeout: 15000 });
  }, p2);
  await step("someone who hasn't built anything yet can set up their profile instead", async () => {
    await go(p2, "/signup");
    await p2.context().clearCookies();
    await go(p2, "/signup");
    await newcomer(p2, `gus${n}@forge.edu`, "Gus");
    await p2.getByRole("link", { name: /Set up your profile instead/ }).click();
    await p2.getByRole("heading", { name: /What do you build/ }).waitFor({ timeout: 15000 });
    await p2.getByText("Step 3 of 4").waitFor();
  }, p2);
  await ctx2.close();

  // 5: pricing.
  const ctx3 = await b.newContext();
  const p3 = await ctx3.newPage(); p3.errs = [];
  await step("/pricing is public: free for builders, Plus coming, and who pays", async () => {
    await go(p3, "/pricing");
    await p3.getByRole("heading", { name: /Free for the people who build/ }).waitFor({ timeout: 15000 });
    for (const t of ["Builders", "Clubs, networks and schools", "Companies", "Coming soon", "From $300"]) await p3.getByText(t, { exact: false }).first().waitFor();
    if (await p3.getByText(/\bPro\b/).count()) throw new Error("the price list says Pro, which means pro verification");
  }, p3);
  await ctx3.close();

  summary();
  await b.close();
})();
