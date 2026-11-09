const { BASE, step, browser, as, go, summary } = require("./lib.cjs");
const BEN = process.env.BEN_ID, JOSH = process.env.JOSH_ID; // set by run.sh
(async () => {
  const b = await browser();
  const josh = await as(b, "josh@forge.test");
  const ben = await as(b, "ben@forge.test");
  const hi = `Hey Ben, loved the static fire write-up ${Date.now() % 1000}`;
  let dm = "";
  await step("Josh messages Ben from his profile", async () => {
    await go(josh, `/u/${BEN}`);
    await josh.getByRole("button", { name: /^Message$/ }).first().click();
    await josh.waitForURL(/\/messages\/[^g]/, { timeout: 20000 });
    dm = new URL(josh.url()).pathname;
    await josh.locator("#msg").fill(hi);
    await josh.getByRole("button", { name: "Send", exact: true }).click();
    await josh.getByText(hi).first().waitFor({ timeout: 15000 });
  }, josh);
  await step("Ben sees it (in Inbox or Requests) and replies", async () => {
    await go(ben, dm);
    await ben.getByText(hi).first().waitFor({ timeout: 15000 });
    const accept = ben.getByRole("button", { name: /^Accept/ }).first();
    if (await accept.isVisible().catch(() => false)) { await accept.click(); await ben.waitForTimeout(1500); }
    await ben.locator("#msg").fill("Thanks Josh! Come to launch day Saturday.");
    await ben.getByRole("button", { name: "Send", exact: true }).click();
    await ben.getByText("Come to launch day Saturday.").first().waitFor({ timeout: 15000 });
  }, ben);
  await step("Josh sees Ben's reply", async () => {
    await go(josh, dm);
    await josh.getByText("Come to launch day Saturday.").first().waitFor({ timeout: 15000 });
  }, josh);
  await step("Josh sends a post to Ben", async () => {
    await go(josh, "/feed?tab=latest");
    const post = josh.locator("article").filter({ hasText: "Static fire #3" }).first();
    await post.getByRole("button", { name: "Send post to people" }).click();
    await josh.getByPlaceholder("People and group chats").waitFor();
    await josh.locator("button[aria-pressed]", { hasText: "Ben Cho" }).first().click();
    await josh.getByRole("button", { name: /^Send/ }).filter({ hasNotText: "people" }).last().click();
    await josh.waitForTimeout(1500);
    await go(josh, dm);
    await josh.getByText(/Static fire #3/).first().waitFor({ timeout: 15000 });
  }, josh);
  const title = `Wind tunnel rig ${Date.now() % 1000}`;
  await step("Josh adds a project", async () => {
    await go(josh, `/u/${JOSH}`);
    await josh.getByRole("button", { name: "Add project" }).first().click();
    await josh.fill('input[name="title"]', title);
    await josh.fill('textarea[name="summary"]', "A small open-loop wind tunnel for testing fin shapes.");
    await josh.getByRole("button", { name: "Add project" }).last().click();
    await josh.getByText(title).first().waitFor({ timeout: 15000 });
  }, josh);
  await step("Josh asks Rocketry Club to verify a milestone", async () => {
    const card = josh.locator("article, li, div").filter({ hasText: title }).filter({ has: josh.getByRole("button", { name: /Add milestone/ }) }).last();
    await card.getByRole("button", { name: /Add milestone/ }).click();
    await josh.fill('input[name="title"]', "Measured lift on 3 fin shapes");
    await josh.getByRole("button", { name: /Ask for verification/ }).click();
    await josh.getByText(/Measured lift on 3 fin shapes/).first().waitFor({ timeout: 15000 });
  }, josh);
  await step("Ben (club owner) gets a request and verifies it", async () => {
    await go(ben, "/c/rkt/manage?tab=verify");
    await ben.getByText(/Measured lift on 3 fin shapes/).first().waitFor({ timeout: 15000 });
    await ben.getByRole("button", { name: /^Verify$/ }).first().click();
    await ben.waitForLoadState("networkidle");
    await go(ben, "/c/rkt/manage?tab=verify");
    await ben.getByText("Recently reviewed").waitFor({ timeout: 15000 });
    await ben.getByText(/Measured lift on 3 fin shapes/).first().waitFor();
  }, ben);
  await step("Josh is notified and the proof shows on his profile", async () => {
    await go(josh, "/notifications");
    await josh.getByText(/verified your milestone/).first().waitFor({ timeout: 15000 });
    await go(josh, `/u/${JOSH}`);
    await josh.getByRole("region", { name: "Club-verified work" }).getByText("Measured lift on 3 fin shapes").first().waitFor({ timeout: 15000 });
  }, josh);
  await step("the proof card appears in Ben's feed", async () => {
    await go(ben, "/feed");
    await ben.getByText("Measured lift on 3 fin shapes").first().waitFor({ timeout: 15000 });
  }, ben);
  console.log("page errors:", [...josh.errs, ...ben.errs].slice(0, 5));
  summary();
  await b.close();
})();
