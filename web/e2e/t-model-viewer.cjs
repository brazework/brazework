// The 3D viewer (components/projects/model-viewer.tsx, Linear FIX-98). On the landing page it shows
// an example robot and loads nothing until it nears the screen; in the app, a member attaches a 3D
// file to a project, opens it there, and opens it from the project's Build card. Where the browser
// can't start WebGL (some CI machines) the viewer says so and still shows the model's size, so the
// size is what every step checks; the controls are checked when the picture is there.
const path = require("path"), { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");
const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const NOTE = "Printed the test cube for the fixture plate (e2e).";
const settled = (v) => v.evaluate((el) => new Promise((ok) => { const t = setInterval(() => { if (["ready", "nogl", "error"].includes(el.dataset.state)) { clearInterval(t); ok(el.dataset.state); } }, 100); }));

(async () => {
  const b = await browser();
  psql(`delete from public.project_files where name = 'cube.stl'; delete from public.posts where body = '${NOTE}';`);

  const page = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  await step("landing: the viewer waits until it's near the screen, then shows the example robot's size", async () => {
    await go(page, "/");
    const v = page.locator("#projects [data-model-viewer]");
    if ((await v.getAttribute("data-state")) !== "idle") throw new Error("the viewer started loading before it was near the screen");
    if (await v.locator("canvas").count()) throw new Error("a 3D canvas exists before the viewer was scrolled to");
    await v.scrollIntoViewIfNeeded();
    const state = await settled(v);
    if (state === "error") throw new Error("the example model failed to load");
    const size = await v.locator("[data-model-size]").innerText();
    if (!/^\d+ × \d+ × [\d.]+ mm$/.test(size.replace(/\s+/g, " ").trim())) throw new Error(`size reads "${size}"`);
    await v.getByText("Example model").waitFor();
    if (state === "nogl") { await v.getByText("3D isn't available in this browser.").waitFor(); return; }
    await v.getByRole("button", { name: "Top" }).click();
    if ((await v.getByRole("button", { name: "Top" }).getAttribute("aria-pressed")) !== "true") throw new Error("Top isn't marked as the view");
    for (const name of ["See through", "Explode", "Turn slowly"]) {
      const btn = v.getByRole("button", { name });
      const was = await btn.getAttribute("aria-pressed");
      await btn.click();
      if ((await btn.getAttribute("aria-pressed")) === was) throw new Error(`${name} didn't toggle`);
    }
    if (page.errs.length) throw new Error(page.errs[0]);
  }, page);

  await step("landing: blueprint mode draws on blue paper, and it's one look at a time", async () => {
    const v = page.locator("#projects [data-model-viewer]");
    if ((await v.getAttribute("data-state")) !== "ready") return; // no WebGL here: nothing to draw
    await v.getByRole("button", { name: "Blueprint" }).click();
    if ((await v.getAttribute("data-look")) !== "blueprint") throw new Error("the viewer isn't in blueprint mode");
    if ((await v.getByRole("button", { name: "See through" }).getAttribute("aria-pressed")) !== "false") throw new Error("See through stayed on under the blueprint");
    const paper = await v.evaluate((el) => getComputedStyle(el).backgroundImage);
    if (!/31, 92, 173|#1f5cad/i.test(paper)) throw new Error(`the backdrop isn't blueprint blue: ${paper.slice(0, 80)}`);
    await v.getByRole("button", { name: "Blueprint" }).click();
    if ((await v.getAttribute("data-look")) !== "solid") throw new Error("Blueprint didn't switch back off");
    if (page.errs.length) throw new Error(page.errs[0]);
  }, page);

  await step("landing: picking what you do shows a different build and what you'd post", async () => {
    const sec = page.locator("#projects"), v = sec.locator("[data-model-viewer]");
    const seen = new Set();
    if ((await sec.getByRole("tab").count()) !== 20) throw new Error(`expected 20 fields in the picker, found ${await sec.getByRole("tab").count()}`);
    const tries = [["Aerospace", "Certification rocket"], ["Software", "Campus shuttle tracker app"], ["Computer science", "Four-node compute cluster"], ["Data & AI", "Crop disease classifier"], ["Chemistry", "Salt crystal lattice model"], ["Business", "Campus coffee cart"], ["Education", "Tactile fraction kit"], ["Robotics", "Line-following robot"]];
    for (const [field, build] of tries) {
      await sec.getByRole("tab", { name: field, exact: true }).click();
      await sec.locator("#build-example").getByText(build, { exact: true }).waitFor();
      await sec.locator("#build-example").getByText(/(Verified|Signed) by /).waitFor(); // a club, or a person who saw it
      if ((await settled(v)) === "error") throw new Error(`${field}: the example failed to load`);
      seen.add((await v.locator("[data-model-size]").innerText()).replace(/\s+/g, " ").trim());
    }
    if (seen.size !== tries.length) throw new Error(`${tries.length} examples but ${seen.size} different sizes: the model didn't change`);
    if (page.errs.length) throw new Error(page.errs[0]);
  }, page);

  const ben = await as(b, "ben@forge.test");
  await step("a member attaches a 3D model to a project and opens it there, with its size", async () => {
    await go(ben, "/projects/p1");
    await ben.getByLabel("Post an update").fill(NOTE);
    await ben.locator('input[type="file"][multiple]').first().setInputFiles(path.join(__dirname, "fixtures", "cube.stl"));
    await ben.getByRole("list", { name: "Attached" }).getByText("cube.stl").waitFor();
    await ben.getByRole("button", { name: /^Post/ }).last().click();
    await ben.getByText(NOTE).first().waitFor({ timeout: 30000 });
    await ben.locator('button[title="View in 3D"]').first().click({ timeout: 20000 });
    const v = ben.locator("[data-model-viewer]").first();
    await v.scrollIntoViewIfNeeded();
    const state = await settled(v);
    if (state === "error") throw new Error("the uploaded cube couldn't be previewed");
    const size = (await v.locator("[data-model-size]").innerText()).replace(/\s+/g, " ").trim();
    if (size !== "20 × 20 × 20 file units") throw new Error(`size reads "${size}"`);
    await v.getByText("12 triangles").waitFor();
    // One part: nothing to explode.
    if (state === "ready" && await v.getByRole("button", { name: "Explode" }).count()) throw new Error("a single-part model offers Explode");
  }, ben);

  await step("its Build card opens the same model, and closes back to the card", async () => {
    await go(ben, "/projects");
    const card = ben.locator("li", { has: ben.getByRole("link", { name: "Liquid engine test stand", exact: true }) }).first();
    if (await card.locator("[data-model-viewer]").count()) throw new Error("the model was opened before anyone asked");
    await card.getByRole("button", { name: "View in 3D" }).click();
    const v = card.locator("[data-model-viewer]");
    if ((await settled(v)) === "error") throw new Error("the model couldn't be previewed on the card");
    const size = (await v.locator("[data-model-size]").innerText()).replace(/\s+/g, " ").trim();
    if (size !== "20 × 20 × 20 file units") throw new Error(`size reads "${size}"`);
    await card.getByRole("button", { name: "Close 3D" }).click();
    await card.getByRole("button", { name: "View in 3D" }).waitFor();
  }, ben);

  await step("a build with no 3D file has no button", async () => {
    psql(`delete from public.project_files where name = 'cube.stl';`);
    await go(ben, "/projects");
    if (await ben.getByRole("button", { name: "View in 3D" }).count()) throw new Error("View in 3D shows without a model");
  }, ben);

  psql(`delete from public.posts where body = '${NOTE}';`);
  await b.close();
  summary();
})();
