// The feed's message dock (a card in the right rail on wide screens, a corner bar below that):
// unread count, requests stay read-only, reply in place.
const { step, browser, as, go, summary, closeTour } = require("./lib.cjs");
(async () => {
  const JOSH = process.env.JOSH_ID;
  const b = await browser();
  const maya = await as(b, "maya@forge.test"); const josh = await as(b, "josh@forge.test");
  const stamp = Date.now() % 100000;
  let dm = "";
  await step("Maya messages Josh", async () => {
    await go(maya, `/u/${JOSH}`); await maya.getByRole("button", { name: /^Message$/ }).first().click();
    await maya.waitForURL(/\/messages\/[^g]/, { timeout: 20000 }); dm = new URL(maya.url()).pathname; await go(maya, dm);
    await maya.locator("#msg").fill(`Launch Saturday? ${stamp}`); await maya.getByRole("button", { name: "Send", exact: true }).click();
    let ok = 0; for (let i = 0; i < 10 && !ok; i++) { await maya.waitForTimeout(400); await go(maya, dm); ok = await maya.getByText(`Launch Saturday? ${stamp}`).count(); }
    if (!ok) throw new Error("not sent");
  }, maya);
  await step("Josh's feed dock shows 1 unread", async () => {
    await go(josh, "/feed"); await josh.waitForTimeout(1500); await closeTour(josh); await josh.waitForTimeout(500);
    const bar = josh.getByRole("button", { name: /Messages/ }).last();
    await bar.waitFor(); let t = "";
    for (let i = 0; i < 20 && !/\d/.test(t); i++) { t = await bar.innerText(); if (!/\d/.test(t)) await josh.waitForTimeout(300); }
    if (!/\d/.test(t)) throw new Error("bar says: " + t);
  }, josh);
  await step("open the dock: Maya's conversation is listed, unread", async () => {
    // Wide screens show Messages as a rail card (open by default); narrower ones as a corner bar.
    if (!(await josh.getByRole("region", { name: "Messages" }).isVisible())) await josh.getByRole("button", { name: /Messages/ }).last().click();
    await josh.getByRole("region", { name: "Messages" }).getByText(`Launch Saturday? ${stamp}`).waitFor({ timeout: 10000 });
  }, josh);
  await step("a request opens read-only, pointing to Messages to accept", async () => {
    const dock = josh.getByRole("region", { name: "Messages" });
    await dock.getByText(`Launch Saturday? ${stamp}`).click();
    await dock.getByText(/Accept or decline this request/).waitFor({ timeout: 10000 });
    if (await dock.getByLabel("Write a message").count()) throw new Error("composer shown for a request");
  }, josh);
  await step("after accepting, reply from the dock", async () => {
    await go(josh, dm); await josh.getByRole("button", { name: "Accept", exact: true }).click(); await josh.waitForTimeout(1500);
    await go(josh, "/feed"); await josh.waitForTimeout(1200); await closeTour(josh); await josh.waitForTimeout(400);
    const dock = josh.getByRole("region", { name: "Messages" });
    if (!(await dock.isVisible())) await josh.getByRole("button", { name: /Messages/ }).last().click();
    await dock.getByText(`Launch Saturday? ${stamp}`).click();
    await dock.getByText(`Launch Saturday? ${stamp}`).waitFor();
    await dock.getByLabel("Write a message").fill(`I'm in, bringing the rail ${stamp}`);
    await dock.getByLabel("Write a message").press("Enter");
    await dock.getByText(`I'm in, bringing the rail ${stamp}`).waitFor();
    await josh.waitForTimeout(1500);
  }, josh);
  await step("Maya sees the reply", async () => {
    let ok = 0; for (let i = 0; i < 10 && !ok; i++) { await go(maya, dm); ok = await maya.getByText(`I'm in, bringing the rail ${stamp}`).count(); if (!ok) await maya.waitForTimeout(500); }
    if (!ok) throw new Error("reply not delivered");
  }, maya);
  await step("the dock stays open after a reload", async () => {
    await go(josh, "/feed"); await josh.waitForTimeout(1200); await closeTour(josh); await josh.waitForTimeout(400);
    if (!(await josh.getByRole("region", { name: "Messages" }).isVisible())) throw new Error("closed after reload");
  }, josh);
  await step("hidden on phones (the tab bar has Messages)", async () => {
    await josh.setViewportSize({ width: 393, height: 852 }); await josh.waitForTimeout(400);
    if (await josh.getByRole("region", { name: "Messages" }).isVisible()) throw new Error("visible on phone");
  }, josh);
  console.log("page errors:", [...josh.errs, ...maya.errs].slice(0, 3));
  summary(); await b.close();
})();
