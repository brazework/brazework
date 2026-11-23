// Club projects (Linear FIX-264, supabase/club-projects.sql): Maya, an admin of the Rocketry Club,
// starts a project from the club page. Josh, added as a teammate, gets it on his profile marked "with
// Rocketry Club" and can post on it. Cara, outside the club, sees it on the club page but can't run it.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const TITLE = `Club rocket ${Date.now() % 100000}`;

(async () => {
  const josh = psql("select id from auth.users where email = 'josh@forge.test'");
  const b = await browser();
  const maya = await as(b, "maya@forge.test");
  const jp = await as(b, "josh@forge.test");
  const cara = await as(b, "cara@forge.test");
  let id = "";
  try {
    await step("a club admin starts a project from the club page", async () => {
      await go(maya, "/c/rkt");
      const section = maya.locator("#projects");
      await section.waitFor({ timeout: 15000 });
      await section.getByRole("button", { name: "New project" }).click();
      const dialog = maya.locator("dialog[open]");
      await dialog.getByText("New Rocketry Club project").waitFor();
      await dialog.getByLabel("Title").fill(TITLE);
      await dialog.getByLabel("Summary").fill("The club's Level 2 build, from the club page.");
      await dialog.getByRole("button", { name: "Add project" }).click();
      await section.getByRole("link", { name: TITLE }).waitFor({ timeout: 15000 });
      id = psql(`select id from public.projects where title = '${TITLE}' and community_id = 'rkt'`);
      if (!id) throw new Error("the project wasn't saved as the club's");
    }, maya);

    await step("a teammate gets it on their profile, marked with the club, and can post on it", async () => {
      psql(`insert into public.project_members (project_id, uid, role) values ('${id}', '${josh}', 'member')`);
      await go(jp, `/u/${josh}`);
      const card = jp.locator("#projects article", { hasText: TITLE }).first();
      await card.waitFor({ timeout: 15000 });
      await card.getByRole("link", { name: "Rocketry Club" }).waitFor();
      if (await card.getByRole("button", { name: "Delete" }).count()) throw new Error("a teammate gets the project's delete control");
      await go(jp, `/projects/${id}`);
      await jp.getByRole("link", { name: "Post update" }).waitFor({ timeout: 15000 });
      await jp.getByText("Rocketry Club").first().waitFor();
    }, jp);

    await step("someone outside the club sees it on the club page, without the controls", async () => {
      await go(cara, "/c/rkt");
      const section = cara.locator("#projects");
      await section.getByRole("link", { name: TITLE }).waitFor({ timeout: 15000 });
      if (await section.getByRole("button", { name: "New project" }).count()) throw new Error("an outsider can start a club project");
      if (await section.getByRole("button", { name: "Delete" }).count()) throw new Error("an outsider gets the delete control");
    }, cara);
  } finally {
    psql(`delete from public.projects where title = '${TITLE}'`);
  }

  await b.close();
  summary();
})();
