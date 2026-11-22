// A club's link to its university (FIX-237, supabase/school-link-email.sql):
// 1. Starting a club, "This club operates under a university" sends the ask with the club; from an
//    address that isn't at the school, the club is still made and Manage → School says why.
// 2. In Manage → School, an officer signed in with a personal address is told to use their school
//    email and can't send; signed in with their confirmed school address, they can.
// 3. The reviewer (a Brazework admin, until the school has its account) sees which officers' school
//    addresses back the ask, and verifies it.
// 4. The club shows "Verified club of <school>" on its page and on its card in Clubs.
// Ben's sign-in email is switched to a school address for part of this and always put back.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const setBen = (addr) => psql(`update auth.users set email = '${addr}', email_confirmed_at = now() where id = (select id from auth.users where email in ('ben@forge.test', 'ben@hartford.edu'))`);
const SCHOOL = "University of Hartford";

(async () => {
  const b = await browser();
  const maya = await as(b, "maya@forge.test");
  const ben = await as(b, "ben@forge.test");
  try {
    await step("starting a club under a university from a personal address: the club is made, and School says why", async () => {
      const name = `Hartford Baja ${Date.now() % 100000}`;
      await go(maya, "/communities?tab=create");
      await maya.locator('input[name="name"]').fill(name);
      await maya.locator('textarea[name="about"]').fill("We build an off-road car for Baja SAE.");
      await maya.getByText("This club operates under a university").click();
      await maya.locator('input[name="schoolName"]').fill(SCHOOL);
      await maya.locator('input[name="schoolWebsite"]').fill("https://hartford.edu");
      await maya.locator('input[name="schoolEvidence"]').fill("https://hartford.edu/clubs/baja");
      await maya.getByText(/The request goes from an @hartford\.edu email/).waitFor({ timeout: 5000 });
      await maya.getByRole("button", { name: "Create community" }).click();
      await maya.waitForURL(/\/manage\?tab=school/, { timeout: 20000 });
      await maya.getByText(/Your club is created, but the school request wasn't sent\. Ask from your @hartford\.edu email/).waitFor({ timeout: 10000 });
      const left = psql(`select count(*) from public.club_school_links l join public.communities c on c.id = l.community_id where c.name = '${name}'`);
      if (left !== "0") throw new Error("a request was sent from an address that isn't at the school");
    }, maya);

    await step("Manage → School: a personal address can't send it; the officer's school address can", async () => {
      await go(ben, "/c/rkt/manage?tab=school");
      await ben.getByLabel("School", { exact: true }).fill(SCHOOL);
      await ben.getByLabel("School website").fill("https://www.hartford.edu");
      await ben.getByLabel(/Proof the club is part of the school/).fill("https://hartford.edu/clubs/rocketry");
      await ben.getByRole("note").filter({ hasText: "@hartford.edu" }).waitFor({ timeout: 5000 });
      if (!(await ben.getByRole("button", { name: "Ask to be verified" }).isDisabled())) throw new Error("the ask can be sent from a personal address");
      setBen("ben@hartford.edu");
      await go(ben, "/c/rkt/manage?tab=school");
      await ben.getByLabel("School", { exact: true }).fill(SCHOOL);
      await ben.getByLabel("School website").fill("https://www.hartford.edu");
      await ben.getByLabel(/Proof the club is part of the school/).fill("https://hartford.edu/clubs/rocketry");
      await ben.getByText(/Sent from your confirmed address, ben@hartford\.edu/).waitFor({ timeout: 5000 });
      await ben.getByRole("button", { name: "Ask to be verified" }).click();
      await ben.getByText(/Waiting for review: University of Hartford/).waitFor({ timeout: 15000 });
      const row = psql("select status || '|' || requester_email from public.club_school_links where community_id = 'rkt'");
      if (row !== "pending|ben@hartford.edu") throw new Error("the request: " + row);
    }, ben);

    await step("the reviewer sees the officers with a confirmed school address, and verifies the club", async () => {
      await go(maya, "/admin");
      const ask = maya.locator("div").filter({ hasText: "Rocketry Club" }).filter({ hasText: "1 officer with a confirmed @hartford.edu address" }).last();
      await ask.waitFor({ timeout: 15000 });
      if (!(await ask.getByText(/ben@hartford\.edu · sent the request/).isVisible())) throw new Error("the reviewer can't see who sent it");
      await maya.locator("div").filter({ hasText: "Rocketry Club" }).filter({ has: maya.getByRole("button", { name: "Verify" }) }).last().getByRole("button", { name: "Verify" }).click();
      await new Promise((r) => setTimeout(r, 1500));
      if (psql("select status from public.club_school_links where community_id = 'rkt'") !== "verified") throw new Error("the club wasn't verified");
    }, maya);

    await step("the club shows its university, on its page and its card in Clubs", async () => {
      await go(ben, "/c/rkt");
      await ben.getByText(`Verified club of ${SCHOOL}`).first().waitFor({ timeout: 15000 });
      await go(ben, "/communities");
      await ben.locator("article, li, div").filter({ hasText: "Rocketry Club" }).getByText(`Verified club of ${SCHOOL}`).first().waitFor({ timeout: 15000 });
    }, ben);
  } finally {
    setBen("ben@forge.test");
    psql("delete from public.club_school_links where community_id = 'rkt'");
  }

  await b.close();
  summary();
})();
