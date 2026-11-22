// LinkedIn on the profile (supabase/linkedin-public.sql): a member's LinkedIn stays private until they
// tick "Show it on my profile" in Settings; then it shows as a link under the record row.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const URL = "https://www.linkedin.com/in/ben-e2e-link";

(async () => {
  const ben = psql("select id from auth.users where email = 'ben@forge.test'");
  const before = psql(`select coalesce(linkedin_url, '') || '|' || linkedin_public from public.profiles where id = '${ben}'`);
  psql(`update public.profiles set linkedin_url = '${URL}', linkedin_public = false where id = '${ben}'`);
  const b = await browser();
  const josh = await as(b, "josh@forge.test");
  const benPage = await as(b, "ben@forge.test");
  try {
    await step("by default the LinkedIn link stays private", async () => {
      await go(josh, `/u/${ben}`);
      await josh.getByRole("heading", { level: 1 }).waitFor({ timeout: 15000 });
      if (await josh.locator("a[data-linkedin]").count()) throw new Error("the link shows before its owner chose to show it");
    }, josh);

    await step("Settings: ticking 'Show it on my profile' shows a clickable link to other members", async () => {
      await go(benPage, "/settings#profile");
      const box = benPage.getByRole("checkbox", { name: "Show it on my profile" });
      await box.waitFor({ timeout: 15000 });
      if (await box.isChecked()) throw new Error("the switch is on by default");
      await box.check();
      await benPage.getByRole("button", { name: "Save profile" }).click();
      await benPage.getByText("Profile saved.").waitFor({ timeout: 10000 });
      if (psql(`select linkedin_public from public.profiles where id = '${ben}'`) !== "t") throw new Error("the switch wasn't saved");
      await go(josh, `/u/${ben}`);
      const link = josh.locator("a[data-linkedin]");
      await link.waitFor({ timeout: 15000 });
      if ((await link.getAttribute("href")) !== URL) throw new Error(`the link goes to ${await link.getAttribute("href")}`);
      if ((await link.getAttribute("target")) !== "_blank") throw new Error("the link doesn't open in a new tab");
    }, benPage);
  } finally {
    const [url, pub] = before.split("|");
    psql(`update public.profiles set linkedin_url = ${url ? `'${url}'` : "null"}, linkedin_public = ${pub === "t" ? "true" : "false"} where id = '${ben}'`);
  }

  await b.close();
  summary();
})();
