// Founding members (FIX-241, supabase/founding-members.sql): a member with a founding number shows a
// "Founding member #N" badge on their profile, to themselves and to others, and a small mark beside
// their name in people search.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();

(async () => {
  const b = await browser();
  const [ben, n] = psql("select id || '|' || coalesce(founding_number::text, '') from public.profiles where id = (select id from auth.users where email = 'ben@forge.test')").split("|");
  const josh = await as(b, "josh@forge.test");
  await step("a founding member's profile shows the badge with their number", async () => {
    if (!n) throw new Error("Ben, a member who finished signing up, has no founding number");
    await go(josh, `/u/${ben}`);
    const badge = josh.locator("[data-founding]").first();
    await badge.waitFor({ timeout: 15000 });
    const text = (await badge.innerText()).replace(/\s+/g, " ").trim();
    if (text !== `Founding member #${n}`) throw new Error(`the badge reads "${text}"`);
  }, josh);

  await step("and a small mark beside their name in people search", async () => {
    await go(josh, "/search?q=Ben");
    await josh.getByLabel(`Founding member #${n}: one of the first 1,000 people on Brazework`).first().waitFor({ timeout: 15000 });
  }, josh);

  await b.close();
  summary();
})();
