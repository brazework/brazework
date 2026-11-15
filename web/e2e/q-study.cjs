// Study groups (supabase/study-groups.sql): Ben starts a CHEM 201 study group with its term and meeting
// time; Maya joins and confirms Ben led it; it shows on Ben's profile as proof, and Josh sees it there.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");
const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = psql("select id from auth.users where email = 'ben@forge.test'");
const NAME = "CHEM 201 Study Group E2E";

(async () => {
  const b = await browser();
  psql(`delete from public.communities where name = '${NAME}';`);
  const page = await as(b, "ben@forge.test");
  let cid = "";

  await step("Ben starts a study group for one course and one term", async () => {
    await go(page, "/communities?tab=create&type=study");
    await page.getByLabel("Name").fill(NAME);
    await page.getByLabel("What's it for?").fill("Problem sets together before each exam.");
    await page.getByPlaceholder("e.g. CHEM 201").fill("CHEM 201");
    await page.getByPlaceholder("e.g. Tuesdays 7pm, Library room 3").fill("Tuesdays 7pm, Library 3");
    await page.getByRole("button", { name: "Create community" }).click();
    await page.waitForURL(/\/c\/[^/?]+\?created=1/, { timeout: 20000 });
    cid = page.url().split("/c/")[1].split("?")[0];
    await page.getByText(/CHEM 201 · (Spring|Summer|Fall) \d{4} · Meets Tuesdays 7pm, Library 3/).first().waitFor({ timeout: 15000 });
    const row = psql(`select type || '|' || course || '|' || meets from public.communities where id = '${cid}'`);
    if (row !== "study|CHEM 201|Tuesdays 7pm, Library 3") throw new Error("group row: " + row);
  }, page);

  const maya = await as(b, "maya@forge.test");
  await step("Maya joins and confirms Ben led it", async () => {
    psql(`insert into public.community_members (community_id, uid) select '${cid}', id from auth.users where email = 'maya@forge.test' on conflict do nothing;`);
    await go(maya, `/c/${cid}`);
    const panel = maya.getByRole("region", { name: "Who led it" });
    await panel.getByRole("button", { name: "Confirm they led" }).first().click();
    await panel.getByText("Confirmed by 1 member").waitFor({ timeout: 15000 });
    const n = psql(`select count(*) from public.study_leads where community_id = '${cid}' and leader = '${ben}'`);
    if (n !== "1") throw new Error("confirmations: " + n);
  }, maya);

  const josh = await as(b, "josh@forge.test");
  await step("it's on Ben's profile as proof, for anyone to see", async () => {
    await go(josh, `/u/${ben}`);
    await josh.getByText("Led the CHEM 201 study group").first().waitFor({ timeout: 15000 });
    await josh.getByText(/Confirmed by 1 member/).first().waitFor();
  }, josh);

  await step("Maya takes it back", async () => {
    await go(maya, `/c/${cid}`);
    await maya.getByRole("region", { name: "Who led it" }).getByRole("button", { name: "Confirmed" }).click();
    await maya.getByText("Taken back.").waitFor({ timeout: 15000 });
    const n = psql(`select count(*) from public.study_leads where community_id = '${cid}'`);
    if (n !== "0") throw new Error("after taking back: " + n);
  }, maya);

  psql(`delete from public.communities where id = '${cid}';`);
  await b.close();
  summary();
})();
