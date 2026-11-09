const { BASE, step, browser, as, go, summary } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const cara = await as(b, "cara@forge.test");
  const name = `Physics Circle ${Date.now() % 10000}`;
  let clubUrl = "";
  await step("Cara creates a club", async () => {
    await go(cara, "/communities?tab=create");
    await cara.fill('input[name="name"]', name);
    await cara.fill('textarea[name="about"], input[name="about"]', "Problem sets, lab builds and talks for physics majors.");
    await cara.locator('button[type="submit"]').click();
    await cara.waitForURL(/\/c\/[^/?]+/, { timeout: 20000 });
    clubUrl = new URL(cara.url()).pathname.split("?")[0];
    await cara.getByRole("heading", { name }).waitFor();
  }, cara);
  const josh = await as(b, "josh@forge.test");
  await step("Josh finds and joins it", async () => {
    await go(josh, clubUrl);
    await josh.getByRole("button", { name: /^Join$/ }).click();
    await josh.getByRole("button", { name: /^Leave$/ }).waitFor({ timeout: 15000 });
  }, josh);
  let chatUrl = "";
  await step("Josh opens the club chat and posts", async () => {
    await josh.getByRole("button", { name: "Club chat" }).click();
    await josh.waitForURL(/\/messages\/g\//, { timeout: 20000 });
    chatUrl = new URL(josh.url()).pathname;
    const box = josh.getByPlaceholder(/^Message /);
    await box.fill("Hi all, excited to join! Anyone doing the optics lab?");
    await box.press("Enter");
    await josh.getByText("Anyone doing the optics lab?").first().waitFor({ timeout: 15000 });
  }, josh);
  await step("Cara sees Josh's message in the club chat", async () => {
    await go(cara, chatUrl);
    await cara.getByText("Anyone doing the optics lab?").first().waitFor({ timeout: 15000 });
  }, cara);
  await step("Cara (owner) posts an announcement", async () => {
    const toggle = cara.getByRole("button", { name: /announce/i }).or(cara.getByLabel(/announce/i)).first();
    await toggle.click();
    const box = cara.getByPlaceholder(/^(Message |Write the announcement)/);
    await box.fill("Kickoff meeting Thursday 6pm, room 204.");
    await box.press("Enter");
    await cara.getByText("Kickoff meeting Thursday 6pm").first().waitFor({ timeout: 15000 });
  }, cara);
  await step("Josh sees the announcement marked as one", async () => {
    await go(josh, chatUrl);
    await josh.getByText("Kickoff meeting Thursday 6pm").first().waitFor({ timeout: 15000 });
    const txt = await josh.locator("main").innerText();
    if (!/announcement/i.test(txt)) throw new Error("no announcement label");
  }, josh);
  let eventTitle = `Optics build night ${Date.now() % 1000}`;
  await step("Cara hosts a club event", async () => {
    await go(cara, `${clubUrl}?tab=events`);
    await cara.getByRole("button", { name: "Host an event" }).click();
    await cara.fill('input[name="title"]', eventTitle);
    const topic = cara.locator('select[name="topic"]'); const opts = await topic.locator("option").allInnerTexts(); await topic.selectOption({ label: opts[1] });
    await cara.locator('select[name="format"]').selectOption("Online").catch(() => {});
    const d = new Date(Date.now() + 3 * 864e5); const pad = (n) => String(n).padStart(2, "0");
    const local = (h) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:00`;
    await cara.fill('input[name="starts_at"]', local(18)); await cara.fill('input[name="ends_at"]', local(20));
    const desc = cara.locator('textarea[name="description"]'); if (await desc.count()) await desc.fill("Bring a laptop; we build a spectrometer.");
    const link = cara.locator('input[name="link"], input[name="url"]'); if (await link.count()) await link.first().fill("https://meet.example.com/optics").catch(() => {});
    await cara.getByRole("button", { name: "Publish event" }).click();
    await cara.getByText(eventTitle).first().waitFor({ timeout: 20000 });
  }, cara);
  let eventPath = "";
  await step("the event is listed on the club and on Events", async () => {
    eventPath = await cara.getByRole("link", { name: new RegExp(eventTitle) }).first().getAttribute("href");
    if (!/^\/events\/[^/]+$/.test(eventPath || "")) throw new Error("no event link: " + eventPath);
    await go(josh, "/events");
    await josh.getByText(eventTitle).first().waitFor({ timeout: 10000 });
  }, josh);
  await step("Josh RSVPs on the event page", async () => {
    await go(josh, eventPath);
    await josh.getByRole("button", { name: "RSVP", exact: true }).first().click();
    await josh.getByRole("button", { name: /Going/ }).first().waitFor({ timeout: 10000 });
    await josh.waitForLoadState("networkidle"); // the save itself, not just the optimistic button
    await go(josh, eventPath);
    await josh.getByText(/1 person going/).first().waitFor({ timeout: 10000 });
  }, josh);
  await step("event chat opens for attendees", async () => {
    await josh.getByRole("button", { name: /Event chat/ }).click();
    await josh.waitForURL(/\/messages\/g\//, { timeout: 20000 });
    await josh.getByText(/Event chat · everyone going/).waitFor();
  }, josh);
  console.log("page errors:", [...cara.errs, ...josh.errs].slice(0, 5));
  summary();
  await b.close();
})();
