// Résumé verify links (supabase/verify-links.sql): what a recruiter sees from a résumé.
// 1. Signed out, on a phone: /v/<id> shows the work, the evidence, who verified it, their role and
//    when, that it's still valid, and a QR code; it isn't indexed, and it fits the screen.
// 2. Private work and unknown links show no record.
// 3. A revoked milestone keeps its page, marked revoked, without the reason.
// 4. Ben finds "Verify link" on his profile (link, QR, open the page); hiding the milestone takes the
//    page down at once, even though it was just cached.
const { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = psql("select id from auth.users where email = 'ben@forge.test'");
const maya = psql("select id from auth.users where email = 'maya@forge.test'");
const rid = `vrev-${Date.now()}`;

(async () => {
  const b = await browser();

  await step("seed: a verified milestone that gets revoked", async () => {
    psql(`set session_replication_role = replica;
      insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, evidence, achieved_on, status, reviewer_id, reviewer_name, reviewer_role, reviewed_at, private)
      values ('${rid}', 'p1', '${ben}', 'rkt', 'Rocketry Club', 'Verify e2e: igniter timing', 'https://github.com/acme/rig/pull/7', current_date - 3, 'verified', '${maya}', 'Maya P.', 'admin', now() - interval '2 days', false);
      set session_replication_role = origin;
      select set_config('request.jwt.claim.sub', '${maya}', false);
      select public.revoke_milestone('${rid}', 'Secret reason: the timing log was edited.');`);
  });

  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const anon = await ctx.newPage();

  await step("signed out on a phone: the record, who verified it, their role, when, and a QR code", async () => {
    const t = Date.now();
    const res = await anon.goto(`${BASE}/v/m1`, { waitUntil: "networkidle" });
    if (!res || res.status() !== 200) throw new Error(`status ${res && res.status()}`);
    await anon.getByRole("heading", { level: 1, name: "Static fire at 1.2 kN" }).waitFor({ timeout: 15000 });
    await anon.getByRole("status").filter({ hasText: "Verified and still valid" }).waitFor({ timeout: 5000 });
    await anon.getByText("Maya Patel", { exact: false }).first().waitFor();
    await anon.getByText("Liquid engine test stand", { exact: false }).first().waitFor();
    if (!(await anon.getByRole("img", { name: "QR code for this verification page" }).isVisible())) throw new Error("no QR code");
    const robots = await anon.evaluate(() => document.querySelector('meta[name="robots"]')?.getAttribute("content"));
    if (!/noindex/.test(robots ?? "")) throw new Error(`the page should not be indexed (robots: ${robots})`);
    const wide = await anon.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    if (wide > 1) throw new Error(`scrolls sideways by ${wide}px`);
    if (/\/login/.test(anon.url())) throw new Error("signed-out visitors were sent to log in");
    console.log(`  (loaded in ${Date.now() - t} ms)`);
  }, anon);

  await step("private work and unknown links show no record", async () => {
    await anon.goto(`${BASE}/v/m3`, { waitUntil: "networkidle" });
    await anon.getByRole("heading", { name: "No public record at this link" }).waitFor({ timeout: 15000 });
    if (await anon.getByText("Private milestone").count()) throw new Error("a private milestone's title leaked");
    await anon.goto(`${BASE}/v/not-a-real-id`, { waitUntil: "networkidle" });
    await anon.getByRole("heading", { name: "No public record at this link" }).waitFor({ timeout: 15000 });
  }, anon);

  await step("a revoked milestone says so, with the date but not the reason", async () => {
    await anon.goto(`${BASE}/v/${rid}`, { waitUntil: "networkidle" });
    await anon.getByRole("status").filter({ hasText: /^Revoked on .+ It no longer counts as proof/ }).waitFor({ timeout: 15000 });
    if (await anon.getByText("Secret reason", { exact: false }).count()) throw new Error("the revocation's reason is shown");
  }, anon);

  const page = await as(b, "ben@forge.test");
  await step("Ben's Verify link: the link, its QR code, and the page", async () => {
    await go(page, `/u/${ben}`);
    await page.getByRole("button", { name: "Verify link" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Verify link for your résumé" });
    await dialog.waitFor({ timeout: 10000 });
    const url = await dialog.getByRole("textbox", { name: "Verify link" }).inputValue();
    if (!/\/v\/m[12]$/.test(url)) throw new Error("unexpected link: " + url);
    if (!(await dialog.getByRole("img", { name: /^QR code for / }).isVisible())) throw new Error("no QR code in the dialog");
  }, page);

  await step("hiding the milestone takes its page down at once", async () => {
    await anon.goto(`${BASE}/v/m1`, { waitUntil: "networkidle" });
    await anon.getByRole("heading", { level: 1, name: "Static fire at 1.2 kN" }).waitFor({ timeout: 15000 });
    await go(page, `/u/${ben}`);
    const hide = page.getByRole("button", { name: /On your profile · Hide/ });
    const row = page.locator("li").filter({ hasText: "Static fire at 1.2 kN" }).filter({ has: hide }).last();
    await row.getByRole("button", { name: /On your profile · Hide/ }).click();
    await page.getByRole("status").filter({ hasText: "Hidden from your profile." }).first().waitFor({ timeout: 15000 });
    await anon.goto(`${BASE}/v/m1`, { waitUntil: "networkidle" });
    await anon.getByRole("heading", { name: "No public record at this link" }).waitFor({ timeout: 15000 });
  }, page);

  // Leave the seed as the other journeys expect it.
  psql(`update public.milestones set private = false where id = 'm1'; delete from public.milestones where id = '${rid}';`);
  await b.close();
  summary();
})();
