// Team chats inside a club (FIX-248): Messages → Groups keeps one row per club, with its team chats
// folded under it, and the Teams menu in the chat header switches between the club's main chat and its
// teams, or starts a new one, all in the same screen.
const { execFileSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const db = (process.env.E2E_STACK || "forge-e2e") + "-db";
const psql = (sql) => execFileSync("docker", ["exec", "-i", db, "psql", "-U", "postgres", "-h", "localhost", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"], { input: sql, encoding: "utf8" }).trim();
const TEAM = `Avionics e2e ${Date.now() % 100000}`;

(async () => {
  const b = await browser();
  const ben = await as(b, "ben@forge.test");
  const josh = await as(b, "josh@forge.test");
  try {
    await step("the Teams menu starts a team chat from the club chat", async () => {
      await go(ben, "/messages?tab=groups");
      await ben.locator('a[href^="/messages/g/"]', { hasText: "Rocketry Club" }).first().click();
      await ben.waitForURL(/\/messages\/g\//, { timeout: 15000 });
      await ben.getByRole("button", { name: /^Teams/ }).click();
      await ben.getByRole("menuitemradio", { name: /Main club chat/ }).waitFor();
      await ben.getByRole("menuitem", { name: "New team chat" }).click();
      await ben.getByPlaceholder("Name, e.g. Avionics").fill(TEAM);
      await ben.getByRole("button", { name: /Josh Menzies/ }).click();
      await ben.getByRole("button", { name: /^Start chat/ }).click();
      await ben.getByText(TEAM).first().waitFor({ timeout: 15000 });
      if (psql(`select count(*) from public.chats where kind = 'team' and community_id = 'rkt' and name = '${TEAM}'`) !== "1") throw new Error("the team chat wasn't made");
    }, ben);

    await step("in the list the team chat sits under its club, not as a row of its own", async () => {
      await go(ben, `/messages/g/${psql(`select id from public.chats where kind = 'team' and name = '${TEAM}'`)}`);
      const nested = ben.getByRole("list", { name: "Rocketry Club team chats" });
      await nested.getByRole("link", { name: TEAM }).waitFor({ timeout: 15000 });
      // Exactly one link to it in the whole list: the nested one.
      const id = psql(`select id from public.chats where kind = 'team' and name = '${TEAM}'`);
      if ((await ben.locator(`a[href="/messages/g/${id}"]`).count()) !== 1) throw new Error("the team chat is listed more than once");
      const toggle = ben.getByRole("button", { name: /Rocketry Club's \d+ team chats?/ });
      if ((await toggle.getAttribute("aria-expanded")) !== "true") throw new Error("the club isn't open while you're in its team chat");
      await toggle.click();
      await nested.waitFor({ state: "detached", timeout: 5000 });
      await toggle.click();
      await nested.getByRole("link", { name: TEAM }).waitFor();
    }, ben);

    await step("the Teams menu switches back to the main club chat in the same screen", async () => {
      await ben.getByRole("button", { name: /^Teams/ }).click();
      const current = ben.getByRole("menuitemradio", { name: new RegExp(TEAM) });
      if ((await current.getAttribute("aria-checked")) !== "true") throw new Error("the current team chat isn't ticked");
      await ben.getByRole("menuitemradio", { name: /Main club chat/ }).click();
      const club = psql("select id from public.chats where kind = 'club' and community_id = 'rkt'");
      await ben.waitForURL(new RegExp(`/messages/g/${club}`), { timeout: 15000 });
      await ben.getByText("Club chat · everyone in the club").waitFor();
    }, ben);
    await step("a member can leave and only the owner can delete the team chat", async () => {
      const id = psql(`select id from public.chats where kind = 'team' and name = '${TEAM}'`);
      const path = `/messages/g/${id}`;
      await go(josh, path);
      await josh.getByLabel("Chat options").click();
      if (await josh.getByRole("button", { name: "Delete group chat" }).count()) throw new Error("a member sees the owner-only action");
      josh.once("dialog", (d) => d.accept());
      await josh.getByRole("button", { name: "Leave chat" }).click();
      await josh.waitForURL(/\/messages\?tab=groups/);
      await go(josh, path);
      await josh.getByText(/This chat isn.t available to you/).waitFor();

      await go(ben, path);
      await ben.getByLabel("Chat options").click();
      ben.once("dialog", (d) => d.dismiss());
      const remove = ben.getByRole("button", { name: "Delete group chat" });
      await remove.click();
      if (psql(`select count(*) from public.chats where id = '${id}'`) !== "1") throw new Error("canceling deleted the chat");
      ben.once("dialog", (d) => d.accept());
      await remove.click();
      await ben.waitForURL(/\/messages\?tab=groups/);
      if (psql(`select count(*) from public.chats where id = '${id}'`) !== "0") throw new Error("the owner could not delete the chat");
    }, ben);
  } finally {
    psql(`delete from public.chats where kind = 'team' and community_id = 'rkt' and name = '${TEAM}'`);
  }

  await b.close();
  summary();
})();
