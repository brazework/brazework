// The 3D viewer (components/projects/model-viewer.tsx, Linear FIX-98). (The landing page's CAD hero is
// checked in s-landing.cjs.) In the app, a member attaches a 3D
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

  const ben = await as(b, "ben@forge.test");
  await step("a member attaches a 3D model to a project and opens it there, with its size", async () => {
    await go(ben, "/projects/p1");
    await ben.getByLabel("Post an update").fill(NOTE);
    await ben.locator('input[type="file"][multiple]').first().setInputFiles(path.join(__dirname, "fixtures", "cube.stl"));
    await ben.getByRole("list", { name: "Attached" }).getByText("cube.stl").waitFor();
    await ben.getByRole("button", { name: /^Post/ }).last().click();
    await ben.getByText(NOTE).first().waitFor({ timeout: 30000 });
    // The update's model is in the viewer straight away, with no click (like the landing page).
    const v = ben.locator('div[aria-label="Attachments"]', { has: ben.getByRole("button", { name: /cube.stl/ }) }).first().locator("[data-model-viewer]");
    await v.waitFor({ timeout: 20000 });
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
