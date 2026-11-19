// Money paths (lib/money.ts, supabase/money.sql). Stripe is off in this stack, so every paid path
// takes its request form, which is what launch looks like until the founders add the keys:
// 1. /pricing: one primary call to action per audience, and a paid one for each.
// 2. /book signed out asks to log in and comes back; signed in, a pilot request lands in the admin
//    queue with the account's email (none typed), and the founders see it on /admin.
// 3. /plus: the waitlist, while Plus isn't on sale.
// 4. Dashboard: companies that looked, 7 days on Free; an older look from a verified company is
//    counted, not named, in one quiet line that links to Plus (plus-teaser.sql).
// 5. A public club's page offers "Sponsor this chapter" to visitors, not to its members.
// 6. Find builders: a verified company's admin can ask for seats in one tap.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");
const psql = (sql) => execSync(`docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -tA`, { input: sql }).toString().trim();

(async () => {
  const b = await browser();
  const guest = await (await b.newContext()).newPage(); guest.errs = [];

  await step("/pricing: builders, companies and schools each have a paid path and one primary button", async () => {
    await go(guest, "/pricing");
    for (const label of ["Log your first build", "Get Plus", "Book a pilot", "Sponsor a chapter", "Bring your club", "Book a demo"]) await guest.getByRole("link", { name: label }).first().waitFor({ timeout: 10000 });
    if ((await guest.getByRole("link", { name: "Book a pilot" }).first().getAttribute("href")) !== "/book?kind=talent") throw new Error("Book a pilot goes to the wrong place");
  }, guest);

  await step("/book signed out asks to log in, and the link comes back to the same request", async () => {
    await go(guest, "/book?kind=talent");
    const href = await guest.getByRole("link", { name: "Log in to continue" }).getAttribute("href");
    if (href !== `/login?next=${encodeURIComponent("/book?kind=talent")}`) throw new Error(`login link: ${href}`);
  }, guest);

  const cara = await as(b, "cara@forge.test");
  await step("Cara books a pilot: no email field, a reply to her account email, and it lands in the admin queue", async () => {
    await go(cara, "/book?kind=talent");
    if (await cara.locator('input[type="email"], input[name="email"]').count()) throw new Error("the form asks for an email");
    await cara.getByRole("radio", { name: /Search seats for my company/, checked: true }).waitFor();
    await cara.locator('input[name="org"]').fill("Acme Aerospace");
    await cara.locator('textarea[name="note"]').fill("Two recruiters, summer interns");
    await cara.getByRole("button", { name: "Send request" }).click();
    await cara.getByText(/Requested\. Josh or Ian will reply to cara@forge\.test/).waitFor({ timeout: 15000 });
    const row = psql("select detail from public.admin_queue where kind = 'sales' and detail like 'Find builders%Two recruiters%' order by id desc limit 1");
    if (!row.includes("cara@forge.test") || !row.includes("Acme Aerospace")) throw new Error(`queue: ${row}`);
  }, cara);

  await step("a public club offers visitors 'Sponsor this chapter', which books it for that club", async () => {
    await go(cara, "/c/rkt");
    await cara.getByRole("link", { name: "Sponsor this chapter" }).click();
    await cara.waitForURL(/\/book\?kind=chapter&club=rkt/, { timeout: 15000 });
    await cara.getByText("For").filter({ hasText: "Rocketry Club" }).first().waitFor({ timeout: 10000 });
  }, cara);

  await step("Find builders: a verified company's admin asks for seats in one tap", async () => {
    await go(cara, "/talent");
    await cara.getByText("Search signed work for your whole team:").waitFor({ timeout: 15000 });
    await cara.getByRole("button", { name: "add seats" }).click();
    await cara.getByText(/Pilot requested for Acme Aerospace|We have your request/).waitFor({ timeout: 15000 });
  }, cara);

  const ben = await as(b, "ben@forge.test");
  await step("members of the club don't see the sponsor line", async () => {
    await go(ben, "/c/rkt");
    await ben.getByRole("heading", { name: "Rocketry Club" }).first().waitFor({ timeout: 15000 });
    if (await ben.getByRole("link", { name: "Sponsor this chapter" }).count()) throw new Error("a member was offered the sponsor line");
  }, ben);

  await step("dashboard: companies that looked this week, and an honest count of the older ones with Plus", async () => {
    // A throwaway verified company, run by Maya, looked at Ben 20 days ago: outside Free's 7 days, so
    // it's counted but not named. Removed afterwards so later journeys see the data they expect.
    const seed = `insert into public.organizations (id, type, name, domain, verification_status) values ('e2e-teaser', 'company', 'Teaser Test Co', 'teaser-e2e.test', 'verified') on conflict do nothing;
      insert into public.organization_admins (org_id, uid) select 'e2e-teaser', id from auth.users where email = 'maya@forge.test' on conflict do nothing;
      insert into public.profile_views (profile_id, viewer, day, viewed_at)
        select b.id, m.id, current_date - 20, now() - interval '20 days' from auth.users b, auth.users m
         where b.email = 'ben@forge.test' and m.email = 'maya@forge.test' on conflict do nothing;`;
    const unseed = `delete from public.profile_views where viewer = (select id from auth.users where email = 'maya@forge.test') and day = current_date - 20;
      delete from public.organization_admins where org_id = 'e2e-teaser'; delete from public.organizations where id = 'e2e-teaser';`;
    psql(seed);
    try {
      await go(ben, "/dashboard");
      await ben.getByRole("heading", { name: /Companies that looked/ }).waitFor({ timeout: 15000 });
      await ben.getByText("last 7 days").waitFor();
      await ben.getByText(/more compan(y|ies) looked in the last 90 days/).waitFor();
      await ben.getByRole("link", { name: "See who with Plus" }).waitFor();
      if (await ben.getByText("Teaser Test Co").count()) throw new Error("Free named a company it should only count");
    } finally { psql(unseed); }
  }, ben);

  await step("/plus while it isn't on sale: Ben joins the waitlist", async () => {
    await go(ben, "/plus");
    await ben.getByRole("button", { name: "Join the waitlist" }).click();
    await ben.getByText(/on the Plus waitlist/).waitFor({ timeout: 15000 });
  }, ben);

  const maya = await as(b, "maya@forge.test");
  await step("the founders see the requests on /admin", async () => {
    await go(maya, "/admin");
    await maya.getByText("Sales request").first().waitFor({ timeout: 15000 });
    await maya.getByText(/cara@forge\.test/).first().waitFor();
  }, maya);

  summary();
  await b.close();
})();
