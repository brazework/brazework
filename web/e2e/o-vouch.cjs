// Vouches (supabase/vouches.sql, Linear FIX-94): proof without a club.
// 1. The person asked opens their link signed out, sees the milestone and its evidence, answers the
//    two questions and vouches; the milestone is verified with their name, role and domain; the link
//    can't be used again.
// 2. The member sees "Vouched for by …" on their profile.
// 3. Asking from the app: free mail is refused, and when the email can't go out (it's off in this
//    stack), nothing is left waiting.
// The ask is seeded straight into the database with a known link, because the real link only ever
// exists in the email.
const crypto = require("crypto"), { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = psql("select id from auth.users where email = 'ben@forge.test'");
const token = crypto.randomBytes(32).toString("base64url");
const hash = crypto.createHash("sha256").update(token).digest("hex");
const title = `Vouch e2e: thrust stand within 2% (${Date.now()})`;

(async () => {
  const b = await browser();

  await step("seed: a clubless milestone and an ask with a known link", async () => {
    const ms = psql(`select set_config('request.jwt.claim.sub', '${ben}', false);
      insert into public.milestones (project_id, community_id, title, detail, evidence, private)
      values ('p1', null, '${title}', 'Calibrated against reference weights', 'https://github.com/acme/rig/pull/9', false) returning id;`).split("\n").pop();
    psql(`insert into public.milestone_vouches (milestone_id, requested_by, email, relationship, token_hash) values ('${ms}', '${ben}', 'prof.lee@utexas.edu', 'professor', '${hash}');`);
  });

  await step("the person asked opens the link signed out and vouches", async () => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/vouch/${token}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: title }).waitFor({ timeout: 15000 });
    if (!(await page.getByText("github.com/acme/rig/pull/9").isVisible())) throw new Error("the evidence link isn't shown");
    const ref = await page.evaluate(() => document.querySelector('meta[name="referrer"]')?.getAttribute("content"));
    if (ref !== "no-referrer") throw new Error(`the page should not send its URL on as a referrer (got ${ref})`);
    await page.getByLabel("Your name").fill("Dr. Priya Lee");
    await page.getByLabel("Your role").fill("Assistant Professor");
    await page.getByLabel("What did you see them do?").fill("I watched the calibration run in the propulsion lab; the readings matched the reference weights.");
    await page.getByLabel("How do you know their work?").fill("I'm his research advisor");
    await page.getByRole("button", { name: "Vouch", exact: true }).click();
    await page.getByText("Your vouch is on their record").waitFor({ timeout: 15000 });
    const row = psql(`select status || '|' || vouched_by from public.milestones where title = '${title}'`);
    if (row !== "verified|Dr. Priya Lee, Assistant Professor · utexas.edu") throw new Error("milestone after vouching: " + row);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("You've already vouched for this").waitFor({ timeout: 10000 });
    await ctx.close();
  });

  await step("an unknown link shows nothing", async () => {
    const ctx = await b.newContext(); const page = await ctx.newPage();
    await page.goto(`${BASE}/vouch/${"x".repeat(43)}`, { waitUntil: "networkidle" });
    await page.getByText("This link isn't valid.").waitFor({ timeout: 10000 });
    await ctx.close();
  });

  const page = await as(b, "ben@forge.test");
  await step("the member sees who vouched on their profile", async () => {
    await go(page, `/u/${ben}`);
    await page.getByText("Vouched for by Dr. Priya Lee, Assistant Professor · utexas.edu").first().waitFor({ timeout: 15000 });
  }, page);

  await step("asking from the app: free mail is refused; with email off, nothing is left waiting", async () => {
    await go(page, `/u/${ben}`);
    await page.getByRole("button", { name: "Add milestone" }).first().click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByRole("radio", { name: /Someone who saw it/ }).click();
    const t2 = `Vouch e2e ask (${Date.now()})`;
    await dialog.locator('input[name="title"]').fill(t2);
    await dialog.locator('input[name="evidence"]').fill("https://github.com/acme/rig/pull/11");
    await dialog.locator('input[name="vouchEmail"]').fill("prof.lee@gmail.com");
    await dialog.getByRole("button", { name: "Ask them to vouch" }).click();
    await dialog.getByRole("alert").waitFor({ timeout: 15000 });
    const msg1 = await dialog.getByRole("alert").innerText();
    if (!/university or company address|isn't available/.test(msg1)) throw new Error("unexpected message for free mail: " + msg1);
    await dialog.locator('input[name="vouchEmail"]').fill("prof.lee@utexas.edu");
    await dialog.getByRole("button", { name: "Ask them to vouch" }).click();
    await page.waitForTimeout(1500);
    const left = psql(`select count(*) from public.milestones where title = '${t2}'`);
    if (left !== "0") throw new Error(`a milestone was left waiting on an ask that never went out (${left})`);
  }, page);

  await b.close();
  summary();
})();
