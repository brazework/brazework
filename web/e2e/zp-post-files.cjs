// Files on any post (supabase/post-files.sql): Josh edits an ordinary post (not a project update) and
// adds a 3D model; the card shows it in the viewer straight after saving, with no reload. Someone else
// sees it in the viewer too, with no download button.
const path = require("path"), { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const BODY = `Post files e2e ${Date.now() % 100000}`;

(async () => {
  const josh = psql("select id from auth.users where email = 'josh@forge.test'");
  const post = psql(`insert into public.posts (author_id, author_first, author_last, body, kind) values ('${josh}', 'Josh', 'Member', '${BODY}', 'update') returning id`);
  const b = await browser();
  const page = await as(b, "josh@forge.test");
  const cara = await as(b, "cara@forge.test");
  try {
    await step("editing an ordinary post adds a 3D model, and the viewer shows at once", async () => {
      await go(page, `/post/${post}`);
      const card = page.locator("article", { hasText: BODY }).first();
      await card.waitFor({ timeout: 15000 });
      await card.getByRole("button", { name: "Edit post" }).click();
      await card.getByLabel("Add a 3D model to this post").setInputFiles(path.join(__dirname, "fixtures", "cube.stl"));
      await card.getByRole("list", { name: "To add" }).getByText("cube.stl").waitFor();
      await card.locator("form").filter({ has: page.getByRole("list", { name: "To add" }) }).getByRole("button", { name: "Save", exact: true }).click();
      const v = page.locator("[data-model-viewer]").first();
      await v.waitFor({ timeout: 30000 });
      if (psql(`select count(*) from public.post_files where post_id = '${post}' and name = 'cube.stl'`) !== "1") throw new Error("the model wasn't saved on the post");
    }, page);

    await step("someone else sees it in the viewer, with no download button", async () => {
      await go(cara, `/post/${post}`);
      await cara.locator("article", { hasText: BODY }).first().waitFor({ timeout: 15000 });
      await cara.locator("[data-model-viewer]").first().waitFor({ timeout: 20000 });
      if (await cara.getByRole("button", { name: /^Download/ }).count()) throw new Error("a download button shows");
      if (await cara.getByRole("button", { name: /^Remove/ }).count()) throw new Error("someone else can remove the file");
    }, cara);
  } finally {
    psql(`delete from public.post_files where post_id = '${post}'; delete from public.posts where id = '${post}'`);
  }

  await b.close();
  summary();
})();
