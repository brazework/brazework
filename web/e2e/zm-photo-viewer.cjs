// Pictures on a post (FIX-247): attaching only attaches (a post with two pictures and an empty box has
// no text naming them), and clicking a picture opens it in a pop-up on the same page, which steps
// between pictures and closes with Escape or ✕, giving focus back to the picture.
const fs = require("fs"), os = require("os"), path = require("path"), { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
// Two tiny valid PNGs (1×1, different colours), written for this run.
const PNG = { red: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", blue: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" };
const stamp = Date.now() % 100000;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fix247-"));
const files = Object.entries(PNG).map(([name, b64]) => { const f = path.join(dir, `viewer-${name}-${stamp}.png`); fs.writeFileSync(f, Buffer.from(b64, "base64")); return f; });

(async () => {
  const b = await browser();
  const ben = await as(b, "ben@forge.test");
  let post = "";
  try {
    await step("posting two pictures with an empty box writes no file names", async () => {
      await go(ben, "/projects/p1");
      const form = ben.locator("form").filter({ has: ben.getByLabel("Post an update") }).first();
      await form.locator('input[type="file"][multiple]').setInputFiles(files);
      await form.getByRole("list", { name: "Attached" }).getByText(`viewer-red-${stamp}.png`).waitFor({ timeout: 10000 });
      if ((await ben.getByLabel("Post an update").inputValue()) !== "") throw new Error("attaching wrote into the text box");
      await form.getByRole("button", { name: /^Post/ }).click();
      // Both uploads land, tied to the new update.
      for (let i = 0; i < 60 && psql(`select count(*) from public.project_files where name like 'viewer-%-${stamp}.png' and post_id is not null`) !== "2"; i++) await ben.waitForTimeout(500);
      post = psql(`select f.post_id from public.project_files f where f.name = 'viewer-red-${stamp}.png' limit 1`);
      if (!post) throw new Error("the pictures weren't attached to an update");
      const body = psql(`select body from public.posts where id = '${post}'`);
      if (body !== "") throw new Error(`the post's text is "${body}"`);
    }, ben);

    await step("a picture opens in a pop-up on the same page, steps to the next, and Escape closes it", async () => {
      await go(ben, "/projects/p1");
      const url = ben.url();
      const first = ben.getByRole("button", { name: "Open picture 1 of 2" }).first();
      await first.click();
      const viewer = ben.getByRole("dialog", { name: "Photo viewer" });
      await viewer.waitFor({ timeout: 10000 });
      if (ben.url() !== url) throw new Error("the picture opened somewhere else");
      await viewer.getByText("1 of 2").waitFor();
      await viewer.getByRole("button", { name: "Next photo" }).click();
      await viewer.getByText("2 of 2").waitFor();
      await ben.keyboard.press("ArrowLeft");
      await viewer.getByText("1 of 2").waitFor();
      await ben.keyboard.press("Escape");
      await viewer.waitFor({ state: "detached", timeout: 5000 });
      const focused = await ben.evaluate(() => document.activeElement?.getAttribute("aria-label"));
      if (focused !== "Open picture 1 of 2") throw new Error(`focus went to "${focused}" after closing`);
      await first.click();
      await viewer.getByRole("button", { name: "Close" }).click();
      await viewer.waitFor({ state: "detached", timeout: 5000 });
    }, ben);
  } finally {
    if (post) psql(`delete from public.project_files where post_id = '${post}'; delete from public.posts where id = '${post}'`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  await b.close();
  summary();
})();
