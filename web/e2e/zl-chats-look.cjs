// Chats and pictures: the sidebar calls Messages "Chats"; the connections list shows each person's
// profile photo; a club's picture shows on its club page, in the Groups list and in the chat header,
// and its owner can change it from the club page.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const id = (email) => psql(`select id from auth.users where email = '${email}'`);

(async () => {
  const josh = id("josh@forge.test"), cara = id("cara@forge.test"), ben = id("ben@forge.test");
  const caraWas = psql(`select avatar_path from public.profiles where id = '${cara}'`);
  const logoWas = psql("select logo_path from public.communities where id = 'rkt'");
  const hadPair = psql(`select count(*) from public.connections where least(from_id, to_id) = least('${josh}'::uuid, '${cara}'::uuid) and greatest(from_id, to_id) = greatest('${josh}'::uuid, '${cara}'::uuid)`) !== "0";
  if (!hadPair) psql(`insert into public.connections (from_id, to_id, status, accepted_at) values ('${cara}', '${josh}', 'accepted', now())`);
  psql(`update public.profiles set avatar_path = '${cara}/e2e-face.webp' where id = '${cara}'`);
  psql(`update public.communities set logo_path = '${ben}/e2e-club.webp' where id = 'rkt'`);
  const b = await browser();
  const page = await as(b, "josh@forge.test");
  try {
    await step("the sidebar says Chats, not Inbox", async () => {
      await go(page, "/feed");
      await page.getByRole("link", { name: "Chats" }).first().waitFor({ timeout: 15000 });
      if (await page.locator("nav").getByRole("link", { name: "Inbox", exact: true }).count()) throw new Error("the sidebar still says Inbox");
    }, page);

    await step("the connections list shows the person's profile photo", async () => {
      await go(page, "/network?tab=connections");
      const row = page.locator("div").filter({ has: page.getByRole("link", { name: /Cara/ }) }).filter({ has: page.locator("img") }).last();
      await row.waitFor({ timeout: 15000 });
      const src = await row.locator("img").first().getAttribute("src");
      if (!src || !src.includes("e2e-face.webp")) throw new Error(`the photo isn't Cara's (${src})`);
    }, page);

    await step("the club's picture shows in the Groups list and the chat header", async () => {
      await go(page, "/messages?tab=groups");
      const row = page.locator('a[href^="/messages/g/"]', { hasText: "Rocketry Club" }).first();
      await row.waitFor({ timeout: 15000 });
      const src = await row.locator("img").first().getAttribute("src");
      if (!src || !src.includes("e2e-club.webp")) throw new Error(`the list shows ${src} for the club`);
      await row.click();
      await page.waitForURL(/\/messages\/g\//, { timeout: 15000 });
      const head = await page.locator("header img").first().getAttribute("src");
      if (!head || !head.includes("e2e-club.webp")) throw new Error(`the chat header shows ${head}`);
    }, page);
  } finally {
    psql(`update public.profiles set avatar_path = '${caraWas}' where id = '${cara}'`);
    psql(`update public.communities set logo_path = '${logoWas}' where id = 'rkt'`);
    if (!hadPair) psql(`delete from public.connections where from_id = '${cara}' and to_id = '${josh}'`);
  }

  const owner = await as(b, "ben@forge.test");
  await step("the club's owner gets a picture button on the club page; a member doesn't", async () => {
    await go(owner, "/c/rkt");
    await owner.getByRole("button", { name: /club picture/ }).waitFor({ timeout: 15000 });
    await go(page, "/c/rkt");
    await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 15000 });
    if (await page.getByRole("button", { name: /club picture/ }).count()) throw new Error("a member can change the club picture");
  }, owner);

  await b.close();
  summary();
})();
