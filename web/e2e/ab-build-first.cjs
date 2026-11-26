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
    await page.locator("#top").getByRole("link", { name: /Get it signed/ }).click();
    await page.waitForURL((u) => u.pathname === "/signup", { timeout: 20000 });
    await page.getByRole("status", { name: "Welcome from Product Hunt" }).waitFor({ timeout: 15000 });
  }, page);
  await step("after About you, 'What did you build?' has the landing page's build and a guessed field", async () => {
    await newcomer(page, email, "Eli");
    await page.getByRole("heading", { name: /What did you build/ }).waitFor();
    if ((await page.locator("#first-build-text").inputValue()) !== BUILD) throw new Error("the landing page's build isn't waiting");
    const fields = page.locator('summary[aria-label="Edit field and date"]');
    await fields.getByText("Engineering", { exact: true }).waitFor();
    await fields.click();
    await page.getByRole("radio", { name: "Engineering", checked: true }).waitFor();
    await fields.click();
    await page.getByRole("button", { name: /Next: proof/ }).click();
  }, page);
  await step("proof: a link", async () => {
    await page.getByText("Step 4 of 5").waitFor({ timeout: 10000 });
    await page.getByRole("radio", { name: /A link/ }).click();
    // Engineering's own tools lead (lib/proof-tools.ts); picking one shows what its link looks like.
    const where = page.getByRole("group", { name: "Where your proof is" });
    if ((await where.getByRole("button").first().innerText()) !== "Onshape") throw new Error("Engineering's proof tools don't lead with Onshape");
    await where.getByRole("button", { name: "Onshape", exact: true }).click();
    await page.getByPlaceholder("https://cad.onshape.com/documents/…").waitFor();
    await page.getByText(/view-only link sharing/).waitFor();
    await page.getByLabel("Link to your proof").fill(`https://github.com/eli/robot-${n}`);
    await page.getByRole("button", { name: /Next: who saw it/ }).click();
    await page.getByText("Step 5 of 5").waitFor({ timeout: 10000 });
  }, page);
  await step("asking a professor says why it didn't go (email is off here); nothing is half-saved", async () => {
    await page.getByRole("radio", { name: /A professor or mentor/ }).click();
    await page.locator('input[name="signerEmail"]').fill("prof.lee@utexas.edu");
    await page.getByRole("button", { name: "Ask for a signature" }).click();
    // The wizard's own alert (Next's route announcer is an alert too).
    const alert = page.locator('p[role="alert"]');
    await alert.waitFor({ timeout: 20000 });
    const msg = await alert.innerText();
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
  await step("share it the same day: a waiting card that says it isn't signed yet, and by whom it will be", async () => {
    // The milestone's own Share (the profile header has one too).
    await page.locator("ol li", { hasText: BUILD }).getByRole("button", { name: /^Share$/ }).click();
    const dialog = page.getByRole("dialog", { name: "Share this result" });
    await dialog.getByText(/waiting for a signature/).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: "Create link" }).click();
    const link = await dialog.getByLabel("Link to this result").inputValue({ timeout: 15000 });
    const out = await (await b.newContext()).newPage();
    await out.goto(link, { waitUntil: "networkidle" });
    await out.getByText(`Not signed yet · waiting for ${club} to verify`).waitFor({ timeout: 15000 });
    await out.getByText(/nobody has signed it yet/).waitFor();
    await out.context().close();
  }, page);
  await step("one project (the retry reused it), one pending milestone for that club, profile filled in", async () => {
    const q = (sql) => psql(sql.replace("ME", `(select id from auth.users where email = '${email}')`));
    if (q("select count(*) from public.projects where owner_id = ME") !== "1") throw new Error("expected exactly one project");
    const ms = q("select m.status || '|' || c.name from public.milestones m join public.communities c on c.id = m.community_id where m.owner_id = ME");
    if (ms !== `pending|${club}`) throw new Error(`milestone: ${ms}, club picked: ${club}`);
    const p = q("select field || '|' || headline || '|' || onboarded || '|' || cardinality(interests) from public.profiles where id = ME");
    if (p !== "Engineering|Engineering student|true|3") throw new Error("profile: " + p);
    // Leave the seed clubs as later journeys expect them: nothing waiting in their officers' inboxes.
    q("delete from public.milestones where owner_id = ME");
    q("delete from public.community_members where uid = ME");
  }, page);
  await ctx.close();

  // 4: no proof yet.
  const ctx2 = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage(); p2.errs = []; p2.on("pageerror", (e) => p2.errs.push(e.message));
  await step("on a phone, with no proof yet: the field is guessed, and it finishes as a draft", async () => {
    await go(p2, "/signup");
    await newcomer(p2, `fay${n}@forge.edu`, "Fay");
    await p2.locator("#first-build-text").fill("A podcast on our town's history");
    await p2.locator('summary[aria-label="Edit field and date"]').getByText("Media & Communication", { exact: true }).waitFor();
    await p2.getByRole("button", { name: /Next: proof/ }).click();
    await p2.getByRole("radio", { name: /Add it later/ }).click();
    await p2.getByRole("button", { name: /Next: who saw it/ }).click();
    await p2.getByText(/A signature needs proof to look at/).waitFor({ timeout: 10000 });
    await p2.getByRole("button", { name: "Save draft" }).click();
    await p2.waitForURL(/\/u\/[0-9a-f-]{36}\?welcome=1/, { timeout: 30000 });
    await p2.getByRole("region", { name: "Welcome to Brazework" }).getByText(/as a draft/).waitFor({ timeout: 15000 });
    const welcome = p2.getByRole("region", { name: "Welcome to Brazework" });
    await welcome.getByRole("link", { name: "View your record" }).waitFor();
    await welcome.getByRole("button", { name: "Add evidence", exact: true }).click();
    await welcome.getByLabel("Evidence link").fill("https://example.com/podcast-evidence");
    await welcome.getByRole("button", { name: "Save evidence" }).click();
    await welcome.getByRole("button", { name: "Ask someone to sign", exact: true }).waitFor();
    await welcome.getByRole("button", { name: "Ask someone to sign", exact: true }).click();
    await welcome.getByLabel(/Signer.s email/).fill("witness@example.edu");
    await welcome.getByRole("button", { name: "Send signature request" }).click();
    await welcome.getByRole("alert").getByText(/email isn.t available/i).waitFor();
  }, p2);
  await step("with evidence and no signer, Save result and ask later offers a signing action", async () => {
    await p2.context().clearCookies();
    await go(p2, "/signup");
    await newcomer(p2, `ava${n}@forge.edu`, "Ava");
    await p2.locator("#first-build-text").fill("Finished a classroom audio project");
    await p2.getByRole("button", { name: /Next: proof/ }).click();
    await p2.getByLabel("Link to your proof").fill("https://example.com/audio-project");
    await p2.getByRole("button", { name: /Next: who saw it/ }).click();
    await p2.getByRole("radio", { name: /Not yet/ }).click();
    await p2.getByRole("button", { name: "Save result and ask later" }).click();
    const welcome = p2.getByRole("region", { name: "Welcome to Brazework" });
    await welcome.getByRole("button", { name: "Ask someone to sign", exact: true }).waitFor();
    await welcome.getByRole("link", { name: "View your record" }).waitFor();
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
  await step("/pricing is public: schools pay first, students and clubs never, then companies", async () => {
    await go(p3, "/pricing");
    await p3.getByRole("heading", { name: /Schools pay/ }).waitFor({ timeout: 15000 });
    for (const t of ["Students and clubs", "Companies", "Semester pilot", "$1,500", "$6,000", "From $18,000", "Every student and every club", "Starter", "Book a pilot", "$15,000"]) await p3.getByText(t, { exact: false }).first().waitFor();
    const order = await p3.locator("h3[id^=pricing-]").evaluateAll((els) => els.map((el) => el.id));
    if (order.join() !== "pricing-schools,pricing-builders,pricing-companies") throw new Error(`price list order: ${order.join()}`);
    if (await p3.getByRole("link", { name: "Get Plus" }).count()) throw new Error("Plus is still on the public price list");
    if (await p3.getByText(/\bPro\b/).count()) throw new Error("the price list says Pro, which means pro verification");
    const allowance = p3.getByText(/Free includes 15 credits a day/);
    await allowance.waitFor();
    const details = await allowance.innerText();
    for (const text of ["1 credit", "2 credits", "3 credits", "Web and iPhone share one balance"]) {
      if (!details.includes(text)) throw new Error(`Ember pricing is missing ${text}`);
    }
  }, p3);
  await step("Plus explains the waitlist and its Ember balance", async () => {
    await go(p3, "/plus");
    await p3.getByText(/Plus also includes 50 Ember credits a day/).waitFor();
    await p3.getByRole("link", { name: "Log in to join the waitlist" }).waitFor();
  }, p3);
  await ctx3.close();

  summary();
  await b.close();
})();
