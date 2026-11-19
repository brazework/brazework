// Proof without revealing confidential work (supabase/redacted-proof.sql).
// 1. Ben writes a public line for signed work on his private project; the private title is refused.
// 2. Josh sees it on Ben's profile and printable résumé as the line, "verified by a club's officers"
//    and the month, and never the milestone's private title.
const { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = psql("select id from auth.users where email = 'ben@forge.test'");
const LINE = "Shipped a payments migration";

(async () => {
  const b = await browser();
  const page = await as(b, "ben@forge.test");

  await step("Ben writes a public line for private signed work (not its title)", async () => {
    await go(page, `/u/${ben}`);
    const row = page.locator("li").filter({ hasText: "Private milestone" }).filter({ has: page.getByRole("button", { name: "Add a public line" }) }).last();
    await row.getByRole("button", { name: "Add a public line" }).click();
    // The editor replaces the button, so it's found on the page (only one is open).
    const input = page.getByRole("textbox", { name: "Public line" });
    await input.fill("Private milestone");
    await page.getByRole("button", { name: "Save line" }).click();
    await page.getByRole("alert").filter({ hasText: "That's the private title" }).waitFor({ timeout: 15000 });
    await input.fill(LINE);
    await page.getByRole("button", { name: "Save line" }).click();
    await page.getByText(`“${LINE}”`).waitFor({ timeout: 15000 });
    if (psql("select public_line from public.milestones where id = 'm3'") !== LINE) throw new Error("the line wasn't saved");
  }, page);

  const josh = await as(b, "josh@forge.test");
  await step("Josh sees the line and who stood behind it, never the private title", async () => {
    await go(josh, `/u/${ben}`);
    const conf = josh.getByRole("region", { name: "Confidential work" });
    await conf.waitFor({ timeout: 15000 });
    await conf.getByText(new RegExp(`^${LINE} · verified by a club's officers · [A-Z][a-z]{2} \\d{4}$`)).waitFor();
    if (await josh.getByText("Private milestone").count()) throw new Error("the private title shows");
  }, josh);

  await step("and on Ben's printable résumé", async () => {
    await go(josh, `/u/${ben}/resume`);
    await josh.getByRole("heading", { name: "Confidential work" }).waitFor({ timeout: 15000 });
    await josh.getByText(LINE).waitFor();
    if (await josh.getByText("Private milestone").count()) throw new Error("the private title shows on the résumé");
  }, josh);

  psql("update public.milestones set public_line = '' where id = 'm3';");
  await b.close();
  summary();
})();
