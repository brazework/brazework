// LinkedIn on the profile (supabase/linkedin-public.sql): a member's LinkedIn shows as a link under the
// record row by default, and "Show it on my profile" in Settings hides it.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const URL = "https://www.linkedin.com/in/ben-e2e-link";

(async () => {
  const ben = psql("select id from auth.users where email = 'ben@forge.test'");
  const before = psql(`select coalesce(linkedin_url, '') || '|' || linkedin_public from public.profiles where id = '${ben}'`);
  psql(`update public.profiles set linkedin_url = '${URL}', linkedin_public = true where id = '${ben}'`);
  const b = await browser();
  const josh = await as(b, "josh@forge.test");
  const benPage = await as(b, "ben@forge.test");
  try {
    await step("another member sees a clickable LinkedIn link on the profile, by default", async () => {
      await go(josh, `/u/${ben}`);
      const link = josh.locator("a[data-linkedin]");
      await link.waitFor({ timeout: 15000 });
      if ((await link.getAttribute("href")) !== URL) throw new Error(`the link goes to ${await link.getAttribute("href")}`);
      if ((await link.getAttribute("target")) !== "_blank") throw new Error("the link doesn't open in a new tab");
    }, josh);

    await step("Settings: turning off 'Show it on my profile' hides it", async () => {
      await go(benPage, "/settings#profile");
      const box = benPage.getByRole("checkbox", { name: "Show it on my profile" });
      await box.waitFor({ timeout: 15000 });
      if (!(await box.isChecked())) throw new Error("the switch isn't on by default");
      await box.uncheck();
      await benPage.getByRole("button", { name: "Save profile" }).click();
      await benPage.getByText("Profile saved.").waitFor({ timeout: 10000 });
      if (psql(`select linkedin_public from public.profiles where id = '${ben}'`) !== "f") throw new Error("the switch wasn't saved");
      await go(josh, `/u/${ben}`);
      await josh.getByRole("heading", { level: 1 }).waitFor({ timeout: 15000 });
      if (await josh.locator("a[data-linkedin]").count()) throw new Error("the link still shows after it was hidden");
    }, benPage);
  } finally {
    const [url, pub] = before.split("|");
    psql(`update public.profiles set linkedin_url = ${url ? `'${url}'` : "null"}, linkedin_public = ${pub === "f" ? "false" : "true"} where id = '${ben}'`);
  }

  await b.close();
  summary();
})();
