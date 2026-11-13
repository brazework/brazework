// Chapters, end to end (Linear FIX-71): a lead starts "NSBE - <school>" under NSBE National from their
// school email, a member joins through the invite and lands in the chapter, Today opens on Your clubs (the chapter)
// with posts going to the chapter, a first-timer starts their build from one question, the lead sees
// the week's roster, and the national page ranks chapters signed out.
const { BASE, step, browser, as, go, hydrated, closeTour, summary } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const josh = await as(b, "josh@forge.test");
  const chapter = "NSBE - Brazework test school";
  let cid = "", code = "";
  await step("a lead starts their chapter under NSBE National in well under 2 minutes", async () => {
    const t0 = Date.now();
    await go(josh, "/chapters/new");
    await closeTour(josh);
    const name = await josh.getByLabel("Chapter name").innerText();
    if (name !== chapter) throw new Error(`the name should be made from the network and school, got ${name}`);
    await josh.getByRole("button", { name: /Start the chapter/ }).click();
    await josh.waitForURL(/\/c\/[^/?]+\?created=chapter/, { timeout: 20000 });
    cid = new URL(josh.url()).pathname.split("/")[2];
    const invite = josh.getByRole("region", { name: "Invite your chapter" });
    await invite.waitFor({ timeout: 15000 });
    code = ((await invite.getByLabel("Invite link").innerText()).match(/\/join\/([0-9a-f]{16})/) ?? [])[1] ?? "";
    if (!code) throw new Error("no invite link on the new chapter");
    await josh.getByRole("link", { name: /Chapter of NSBE National/ }).waitFor();
    const secs = (Date.now() - t0) / 1000;
    if (secs > 120) throw new Error(`took ${secs}s`);
  }, josh);
  await step("a second chapter at the same school is refused, by name", async () => {
    const maya = await as(b, "maya@forge.test");
    await go(maya, "/chapters/new");
    await closeTour(maya);
    await maya.getByRole("button", { name: /Start the chapter/ }).click();
    await maya.getByRole("alert").getByText(`${chapter} is already on Brazework`).waitFor({ timeout: 15000 });
    await maya.context().close();
  }, josh);

  const cara = await as(b, "cara@forge.test");
  await step("a member joins through the invite link and lands in the chapter", async () => {
    await go(cara, `/join/${code}`);
    await cara.getByRole("button", { name: `Join ${chapter}` }).click();
    await cara.waitForURL((u) => u.pathname === `/c/${cid}` && u.searchParams.get("joined") === "1", { timeout: 20000 });
  }, cara);
  await step("Today opens on Your clubs (the chapter), and a first-timer starts their build from one question", async () => {
    await go(cara, "/feed");
    await closeTour(cara);
    await cara.locator('a[aria-current="page"]', { hasText: "Your clubs" }).waitFor({ timeout: 15000 });
    const first = cara.getByRole("region", { name: "Your first build" });
    await first.waitFor({ timeout: 15000 });
    await hydrated(cara.locator("#first-build"));
    await cara.fill("#first-build", "A wind tunnel for the regional competition");
    await first.getByRole("button", { name: /Start my build/ }).click();
    await first.waitFor({ state: "detached", timeout: 20000 });
    await cara.getByRole("group", { name: "Linked project" }).getByText("A wind tunnel for the regional competition").waitFor({ timeout: 15000 });
    // Posts go to the chapter unless you pick otherwise.
    await hydrated(cara.locator("#compose-club"));
    if ((await cara.locator("#compose-club").inputValue()) !== cid) throw new Error("the composer should post to the chapter by default");
  }, cara);
  await step("a post lands in the chapter's feed", async () => {
    const box = cara.locator("#create-box");
    await hydrated(box);
    await box.fill("Wind tunnel fan arrived. Mounting it this weekend.");
    await cara.getByRole("button", { name: "Post", exact: true }).click();
    await cara.waitForFunction(() => document.querySelector("#create-box")?.value === "", null, { timeout: 30000 });
    await go(cara, "/feed?tab=chapter");
    await cara.locator("article").filter({ hasText: "Wind tunnel fan arrived" }).first().waitFor({ timeout: 15000 });
  }, cara);
  await step("the lead's week: who posted, and a brand-new member isn't called quiet", async () => {
    await go(josh, `/c/${cid}/manage?tab=report`);
    await josh.getByRole("region", { name: "Posted this week" }).getByText(/Cara/).waitFor({ timeout: 15000 });
    await josh.getByRole("region", { name: "On a streak" }).waitFor();
    await josh.getByRole("region", { name: "Waiting for verification" }).waitFor();
    if ((await josh.getByRole("region", { name: "Quiet for 7+ days" }).innerText()).includes("Cara")) throw new Error("a member who joined today was listed as quiet");
  }, josh);
  await step("NSBE National ranks chapters across schools, signed out", async () => {
    const anon = await b.newPage();
    await anon.goto(`${BASE}/n/nsbe`, { waitUntil: "networkidle" });
    const row = anon.getByRole("region", { name: "Most active chapters" }).locator("li").first();
    await row.getByText(chapter).waitFor({ timeout: 15000 });
    if (!(await row.innerText()).includes("1/2 active")) throw new Error(`expected 1 of 2 members active, got: ${(await row.innerText()).replace(/\s+/g, " ")}`);
    if ((await anon.content()).includes("Wind tunnel fan arrived")) throw new Error("the national page leaked a post");
    await anon.close();
  }, josh);
  summary();
  await b.close();
})();
