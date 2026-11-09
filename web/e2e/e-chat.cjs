// Chat: reactions, replies and unsend, in direct messages and a club chat.
const { step, browser, as, go, summary } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const josh = await as(b, "josh@forge.test"); const ben = await as(b, "ben@forge.test");
  let dm = "";
  const stamp = Date.now() % 10000;
  await step("Josh messages Ben", async () => {
    await go(josh, `/u/${process.env.BEN_ID}`);
    await josh.getByRole("button", { name: /^Message$/ }).first().click();
    await josh.waitForURL(/\/messages\/[^g]/, { timeout: 20000 }); dm = new URL(josh.url()).pathname;
    await go(josh, dm); // wait for the page to hydrate before typing
    await josh.locator("#msg").fill("Launch checklist " + stamp); await josh.getByRole("button", { name: "Send", exact: true }).click();
    let found = 0;
    for (let i = 0; i < 10 && !found; i++) { await josh.waitForTimeout(400); await go(josh, dm); found = await josh.getByText("Launch checklist " + stamp).count(); }
    if (!found) throw new Error("message never reached the server");
  }, josh);
  await step("Ben reacts 🔥 (hover toolbar) and it shows for both", async () => {
    await go(ben, dm);
    const accept = ben.getByRole("button", { name: /^Accept/ }).first(); if (await accept.isVisible().catch(() => false)) { await accept.click(); await ben.waitForTimeout(1500); await go(ben, dm); }
    const row = ben.locator("li", { hasText: "Launch checklist " + stamp }).last();
    await row.getByText("Launch checklist " + stamp).hover();
    await row.getByRole("button", { name: "More reactions" }).click();
    await row.getByRole("button", { name: "React 🔥" }).click();
    await ben.getByRole("button", { name: /🔥 1/ }).first().waitFor({ timeout: 8000 });
    await ben.waitForTimeout(800); await go(josh, dm);
    await josh.getByRole("button", { name: /🔥 1/ }).first().waitFor({ timeout: 8000 });
  }, ben);
  await step("Ben replies to it: quote shows in the reply", async () => {
    await go(ben, dm);
    const row2 = ben.locator("li", { hasText: "Launch checklist " + stamp }).last();
    await row2.getByText("Launch checklist " + stamp).hover();
    await row2.getByRole("button", { name: "Reply" }).click();
    await ben.getByText(/Replying to /).waitFor();
    await ben.locator("#msg").fill("On it, bringing the igniters " + stamp); await ben.getByRole("button", { name: "Send", exact: true }).click();
    for (let i = 0; i < 10; i++) { await ben.waitForTimeout(500); await go(josh, dm); if (await josh.getByText("On it, bringing the igniters " + stamp).count()) break; }
    const reply = josh.locator("li", { hasText: "On it, bringing the igniters " + stamp }).last();
    if (!(await reply.innerText()).includes("Launch checklist " + stamp)) throw new Error("no quote in the reply");
  }, josh);
  await step("Josh unsends a message and it's gone for Ben", async () => {
    await go(josh, dm);
    await josh.locator("#msg").fill("oops wrong chat " + stamp); await josh.getByRole("button", { name: "Send", exact: true }).click();
    for (let i = 0; i < 10; i++) { await josh.waitForTimeout(400); await go(josh, dm); if (await josh.getByText("oops wrong chat " + stamp).count()) break; }
    josh.once("dialog", (d) => d.accept());
    const mine = josh.locator("li", { hasText: "oops wrong chat " + stamp }).last();
    await mine.getByText("oops wrong chat " + stamp).hover();
    await mine.getByRole("button", { name: "Unsend" }).click();
    await josh.waitForTimeout(1500); await go(ben, dm);
    if (await ben.getByText("oops wrong chat " + stamp).count()) throw new Error("still visible to Ben");
    if (!(await ben.getByText("Launch checklist " + stamp).count())) throw new Error("unsend removed the wrong message");
  }, josh);
  await step("group chat: react and reply work there too", async () => {
    await go(josh, "/c/rkt"); await josh.getByRole("button", { name: "Club chat" }).click(); await josh.waitForURL(/\/messages\/g\//);
    const g = new URL(josh.url()).pathname;
    await go(josh, g); // hydrated before typing
    const box = josh.getByPlaceholder(/^Message /); await box.fill("Who has the launch rail key? " + stamp); await box.press("Enter");
    let found = 0;
    for (let i = 0; i < 10 && !found; i++) { await josh.waitForTimeout(400); await go(josh, g); found = await josh.getByText("Who has the launch rail key? " + stamp).count(); }
    if (!found) throw new Error("group message never reached the server");
    await go(ben, g);
    const g1 = ben.locator("li", { hasText: "Who has the launch rail key? " + stamp }).last();
    await g1.getByText("Who has the launch rail key? " + stamp).hover();
    await g1.getByRole("button", { name: "React 👍" }).click();
    await ben.getByRole("button", { name: /👍 1/ }).first().waitFor({ timeout: 8000 });
    await g1.getByText("Who has the launch rail key? " + stamp).hover();
    await g1.getByRole("button", { name: "Reply" }).click();
    await ben.getByText(/Replying to Josh/).waitFor();
  }, ben);
  console.log("page errors:", [...josh.errs, ...ben.errs].slice(0, 3));
  summary(); await b.close();
})();
