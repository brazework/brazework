// Officer setup (app/(app)/c/[id]/setup.tsx): Ben starts a club and the club page walks him through
// setup. Starter rules in one tap; one invite link (tapping again never makes another), ready to
// paste into the group chat; Maya joins through it and the members count moves; members never see
// the card; hiding it keeps it hidden.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");
const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const NAME = "Setup Test Club E2E";

(async () => {
  const b = await browser();
  psql(`delete from public.communities where name = '${NAME}';`);
  const ben = await as(b, "ben@forge.test");
  let cid = "", url = "";

  await step("a new club shows its owner 'Set up' with progress", async () => {
    await go(ben, "/communities?tab=create");
    await ben.getByLabel("Name").fill(NAME);
    await ben.getByLabel("What's it for?").fill("Testing setup.");
    await ben.getByRole("button", { name: "Create community" }).click();
    await ben.waitForURL(/\/c\/[^/?]+\?created=1/, { timeout: 20000 });
    cid = ben.url().split("/c/")[1].split("?")[0];
    const card = ben.getByRole("region", { name: "Set up your club" });
    await card.getByRole("heading", { name: "Set up your club" }).waitFor({ timeout: 15000 });
    await card.getByText(/\d+ of \d+ done/).waitFor();
  }, ben);

  await step("starter rules in one tap, and the step is ticked", async () => {
    const card = ben.getByRole("region", { name: "Set up your club" });
    await card.getByRole("button", { name: "Use starter rules" }).click();
    await card.getByText(/Starter rules added/).waitFor({ timeout: 15000 });
    const rules = psql(`select length(rules) > 50 from public.communities where id = '${cid}'`);
    if (rules !== "t") throw new Error("rules not saved");
    await card.getByRole("button", { name: "Use starter rules" }).waitFor({ state: "detached", timeout: 15000 });
  }, ben);

  await step("one invite link, ready to paste; tapping again never makes another", async () => {
    const card = ben.getByRole("region", { name: "Set up your club" });
    await card.getByRole("button", { name: "Get invite link" }).click();
    const box = card.getByRole("textbox", { name: "Invite message" });
    await box.waitFor({ timeout: 15000 });
    const text = await box.inputValue();
    url = (/(https?:\/\/\S+\/join\/\S+)$/.exec(text) || [])[1] || "";
    if (!url || !text.includes(NAME)) throw new Error("message: " + text);
    await ben.reload();
    await ben.getByRole("region", { name: "Set up your club" }).getByRole("textbox", { name: "Invite message" }).waitFor({ timeout: 15000 });
    const n = psql(`select count(*) from public.community_invites where community_id = '${cid}'`);
    if (n !== "1") throw new Error(`invites: ${n}`);
  }, ben);

  const maya = await as(b, "maya@forge.test");
  await step("Maya joins through the link; members never see the setup card", async () => {
    await go(maya, new URL(url).pathname);
    await maya.getByRole("button", { name: /Join/ }).first().click();
    await maya.waitForURL(new RegExp(`/c/${cid}`), { timeout: 20000 });
    const m = psql(`select count(*) from public.community_members where community_id = '${cid}'`);
    if (m !== "2") throw new Error(`members: ${m}`);
    if (await maya.getByRole("region", { name: "Set up your club" }).count()) throw new Error("a member saw the setup card");
  }, maya);

  await step("hiding the card keeps it hidden", async () => {
    await go(ben, `/c/${cid}`);
    await ben.getByRole("button", { name: "Hide setup for this club" }).click();
    await ben.getByRole("region", { name: "Set up your club" }).waitFor({ state: "detached", timeout: 15000 });
    await ben.reload();
    await ben.waitForTimeout(800);
    if (await ben.getByRole("region", { name: "Set up your club" }).count()) throw new Error("came back after reload");
  }, ben);

  psql(`delete from public.communities where id = '${cid}';`);
  await b.close();
  summary();
})();
