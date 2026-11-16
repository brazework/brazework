// The Build page and the sidebar (app/(app)/projects, app/(app)/sidebar.tsx). A build's card is all
// the member's own: no stock picture, twelve weeks of their updates, where it stands, and a box to
// log today's progress without leaving the page; logging leads straight to asking for a signature.
// The sidebar lists your builds, has Ember, and tells an officer how many results are waiting to be signed.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");
const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const NOTE = "Swapped the load cell amplifier; noise is down to 0.2% (e2e).";
const clean = () => psql(`delete from public.posts where body = '${NOTE}'; alter table public.milestones disable trigger user; delete from public.milestones where id = 'e2e-sign-m'; alter table public.milestones enable trigger user; delete from public.projects where id = 'e2e-sign';`);

(async () => {
  const b = await browser();
  clean();
  const ben = await as(b, "ben@forge.test");
  const builds = ben.getByRole("region", { name: "Your builds" });
  const card = builds.locator("li", { has: ben.getByRole("link", { name: "Liquid engine test stand", exact: true }) }).first();

  await step("Build: the page is named for its place, and a card shows the member's own work, not a stock drawing", async () => {
    await go(ben, "/projects");
    await ben.getByRole("heading", { name: "Build", level: 1 }).waitFor({ timeout: 15000 });
    await card.getByRole("list", { name: "Where this build stands" }).waitFor();
    for (const s of ["Logged", "Asked", "Signed"]) await card.getByRole("list", { name: "Where this build stands" }).getByText(s, { exact: true }).waitFor();
    await card.getByRole("img", { name: /of the last 12 weeks|last 12 weeks/ }).waitFor();
    if (await builds.locator("canvas").count()) throw new Error("a stock drawing is still on the build cards");
    await card.getByRole("link", { name: "On your Proof" }).waitFor();
  }, ben);

  await step("log today's progress from the card, and the next step is to ask for a signature", async () => {
    const before = await builds.getByText(/updates? this week|Nothing logged this week/).first().innerText();
    await card.getByLabel("Log an update on Liquid engine test stand").fill(NOTE);
    await card.getByRole("button", { name: "Log", exact: true }).click();
    await card.getByText("Logged.").waitFor({ timeout: 20000 });
    const ask = card.getByRole("link", { name: "Ask someone who saw it to sign it" });
    if (!/\/projects\/p1#milestones$/.test(await ask.getAttribute("href"))) throw new Error("the ask link doesn't open the project's milestones");
    await ben.waitForFunction((was) => { const el = [...document.querySelectorAll('[aria-label="Your builds"] p')].find((p) => /this week/.test(p.textContent)); return el && el.textContent !== was; }, before, { timeout: 15000 });
    await card.getByRole("button", { name: /^Log \(/ }).click();
    await card.getByRole("region", { name: "Updates on Liquid engine test stand" }).getByText(NOTE).waitFor({ timeout: 10000 });
  }, ben);

  await step("the composer has a button for a 3D model, and it only takes the kinds the viewer opens", async () => {
    await card.getByRole("button", { name: "Add a 3D model" }).waitFor();
    const accept = await card.locator('input[type="file"]:not([multiple])').getAttribute("accept");
    if (accept !== ".stl,.obj,.glb,.gltf,.3mf") throw new Error(`the 3D picker accepts "${accept}"`);
  }, ben);

  await step("sidebar: your builds one click away, and Ember has an entry", async () => {
    const side = ben.getByRole("complementary", { name: "Sidebar" });
    await side.getByRole("group", { name: "Your builds" }).getByRole("link", { name: "Liquid engine test stand" }).waitFor();
    await side.getByRole("link", { name: "Ask Ember" }).click();
    await ben.waitForURL(/\/copilot/, { timeout: 15000 });
    await go(ben, "/projects");
    await ben.getByRole("complementary", { name: "Sidebar" }).getByRole("group", { name: "Your builds" }).getByRole("link", { name: "Recovery avionics" }).click();
    await ben.waitForURL(/\/projects\/p2$/, { timeout: 15000 });
  }, ben);

  await step("sidebar: an officer sees how many results are waiting on their signature", async () => {
    await go(ben, "/projects");
    const side = ben.getByRole("complementary", { name: "Sidebar" });
    if (await side.getByRole("link", { name: /^Club, \d+ to sign$/ }).count()) throw new Error("Club shows a count with nothing waiting");
    // Josh, a member of Ben's club, asks it to sign a result.
    psql(`insert into public.projects (id, owner_id, title, summary, status) select 'e2e-sign', id, 'Fin can jig', 'A jig for aligning fins.', 'in_progress' from auth.users where email = 'josh@forge.test';
      alter table public.milestones disable trigger user;
      insert into public.milestones (id, project_id, owner_id, community_id, community_name, title, detail, achieved_on, status) select 'e2e-sign-m', 'e2e-sign', id, 'rkt', 'Rocketry Club', 'Fins aligned within 0.5 degrees', 'Measured on three airframes.', current_date, 'pending' from auth.users where email = 'josh@forge.test';
      alter table public.milestones enable trigger user;`);
    await go(ben, "/projects");
    await ben.getByRole("complementary", { name: "Sidebar" }).getByRole("link", { name: "Club, 1 to sign" }).waitFor({ timeout: 15000 });
  }, ben);

  const phone = await as(b, "ben@forge.test", { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await step("phone: the log box is a full-width field with its buttons under it", async () => {
    await go(phone, "/projects");
    const box = await phone.getByLabel("Log an update on Liquid engine test stand").boundingBox();
    if (!box || box.width < 280) throw new Error(`the log box is ${box && Math.round(box.width)}px wide`);
    await phone.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Club, 1 to sign" }).waitFor({ timeout: 15000 });
  }, phone);

  clean();
  await b.close();
  summary();
})();
