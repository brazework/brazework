// Adding a project in steps (lib/project-steps.ts, 2026-11-26): Next won't move on without a title and a
// summary, Enter moves to the next step instead of saving, a topic is one tap, Back keeps what was typed,
// and the project saves with everything from every step. "Tell Torch" swaps the fields for one sentence.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const TITLE = `Stepped rig ${Date.now() % 100000}`;

(async () => {
  const josh = psql("select id from auth.users where email = 'josh@forge.test'");
  const b = await browser();
  const page = await as(b, "josh@forge.test");
  const dialog = page.locator("dialog[open]");
  const current = () => dialog.locator('[aria-current="step"]').innerText();
  try {
    await step("the first step asks only for a title and a summary", async () => {
      await go(page, `/u/${josh}`);
      await page.getByRole("button", { name: "Add project" }).first().click();
      await dialog.getByText("What is it?").first().waitFor();
      await dialog.getByRole("button", { name: "Next" }).click();
      if (!(await current()).includes("What is it?")) throw new Error("Next moved on with no title");
      if (await dialog.locator('textarea[name="details"]').isVisible()) throw new Error("a later step's field shows on the first step");
    }, page);

    await step("Tell Torch swaps the fields for one sentence (where Torch is on)", async () => {
      const torch = dialog.getByRole("radio", { name: "Tell Torch" });
      if (!(await torch.count())) { await dialog.getByRole("radio", { name: "From a link" }).click(); await dialog.getByLabel("Start from a link").waitFor(); await dialog.getByRole("radio", { name: "Type it in" }).click(); return; }
      await torch.click();
      await dialog.getByLabel("Tell Torch about it, in your own words").waitFor();
      if (await dialog.getByLabel("Title").isVisible()) throw new Error("the title still shows while telling Torch");
      if (!(await dialog.getByRole("button", { name: "Draft it with Torch" }).isDisabled())) throw new Error("Torch can be sent nothing");
      await dialog.getByRole("radio", { name: "Type it in" }).click();
    }, page);

    await step("Enter moves to the next step; a topic is one tap", async () => {
      await dialog.getByLabel("Title").fill(TITLE);
      await dialog.getByLabel("Summary").fill("A test rig added one step at a time.");
      await dialog.getByLabel("Title").press("Enter");
      await page.waitForFunction(() => document.querySelector('dialog[open] [aria-current="step"]')?.textContent?.includes("Where does it stand?"), null, { timeout: 5000 });
      if (psql(`select count(*) from public.projects where title = '${TITLE}'`) !== "0") throw new Error("Enter saved the project");
      await dialog.getByRole("button", { name: "Completed" }).click();
      await dialog.getByLabel("Year").fill("2026");
      const chip = dialog.getByRole("button", { name: /^Add / }).first();
      const topic = (await chip.getAttribute("aria-label")).replace(/^Add /, "");
      await chip.click();
      await dialog.getByRole("button", { name: `Remove ${topic}` }).waitFor();
      page.topic = topic;
    }, page);

    await step("Back keeps what was typed; the last step saves it all", async () => {
      await dialog.getByRole("button", { name: "Back" }).click();
      if ((await dialog.getByLabel("Title").inputValue()) !== TITLE) throw new Error("Back lost the title");
      await dialog.getByRole("button", { name: "Next" }).click();
      await dialog.getByRole("button", { name: "Next" }).click();
      await dialog.locator('input[name="link"]').fill("https://example.com/stepped-rig");
      await dialog.getByRole("button", { name: "Add project" }).click();
      await page.getByText(TITLE).first().waitFor({ timeout: 15000 });
      const row = psql(`select p.status || '|' || coalesce(p.year::text, '') || '|' || array_to_string(p.tags, ',') || '|' || coalesce(d.link, '') from public.projects p left join public.project_details d on d.project_id = p.id where title = '${TITLE}'`);
      if (row !== `completed|2026|${page.topic}|https://example.com/stepped-rig`) throw new Error(`saved as ${row}`);
    }, page);
  } finally {
    psql(`delete from public.projects where title = '${TITLE}'`);
  }

  await b.close();
  summary();
})();
