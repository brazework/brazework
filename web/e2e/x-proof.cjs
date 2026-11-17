// Proof cards (Linear FIX-128): Ben shares one signed result as a public link. Someone who isn't signed
// in opens it and sees the result, who signed it and a way to start their own record, but none of
// Ben's tools; the preview image LinkedIn and X show is a real PNG; and when Ben stops sharing, the
// link says so. Nothing is public until he shares it.
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");
const TITLE = "Static fire at 1.2 kN";

(async () => {
  const b = await browser();
  const ben = await as(b, "ben@forge.test");
  const anon = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  anon.errs = []; anon.on("pageerror", (e) => anon.errs.push(e.message));

  await step("before sharing, the link shows nothing", async () => {
    await go(anon, "/p/m1");
    await anon.getByRole("heading", { name: "This proof isn’t shared" }).or(anon.getByRole("heading", { name: "This proof isn't shared" })).waitFor({ timeout: 15000 });
  }, anon);

  let link = "";
  await step("Ben shares his signed result and gets a link, with LinkedIn, X and the image", async () => {
    await go(ben, "/profile");
    await ben.waitForURL(/\/u\//, { timeout: 15000 }).catch(() => {});
    // The timeline entry (the profile also lists the result in its summary, without tools).
    const item = ben.locator("li").filter({ hasText: TITLE }).filter({ has: ben.getByRole("button", { name: /^Share$/ }) }).first();
    await item.getByRole("button", { name: /^Share$/ }).click();
    const dlg = ben.getByRole("dialog", { name: "Share this result" });
    await dlg.getByText(/Anyone with the link sees this result/).waitFor();
    await dlg.getByRole("button", { name: "Create link" }).click();
    const input = dlg.getByLabel("Link to this result");
    await input.waitFor({ timeout: 15000 });
    link = await input.inputValue();
    if (!/\/p\/m1$/.test(link)) throw new Error("unexpected link: " + link);
    for (const name of ["Post to LinkedIn", "Post to X", "Download image", "Open the page"]) await dlg.getByRole("link", { name }).waitFor();
    if (!(await dlg.getByRole("link", { name: "Post to LinkedIn" }).getAttribute("href")).includes(encodeURIComponent(link))) throw new Error("the LinkedIn post doesn't carry the link");
  }, ben);

  await step("signed out, the page shows the result, who signed it, and no owner tools", async () => {
    await go(anon, "/p/m1");
    const card = anon.locator("[data-proof]");
    await card.getByRole("heading", { name: TITLE }).waitFor({ timeout: 15000 });
    await card.getByText(/^Verified by /).waitFor();
    await anon.getByRole("link", { name: "Start your record" }).waitFor();
    if (await anon.getByRole("button", { name: /Remove|Share|Hide/ }).count()) throw new Error("owner tools showed to a visitor");
    const og = await anon.locator('meta[property="og:image"]').getAttribute("content");
    if (!og || !og.includes("/p/m1/opengraph-image")) throw new Error("no preview image in the page head: " + og);
  }, anon);

  await step("the preview image is a real picture", async () => {
    const r = await fetch(`${BASE}/p/m1/opengraph-image`);
    const type = r.headers.get("content-type") || "", bytes = (await r.arrayBuffer()).byteLength;
    if (r.status !== 200 || !type.startsWith("image/png") || bytes < 10000) throw new Error(`preview image: ${r.status} ${type} ${bytes} bytes`);
  }, anon);

  await step("when Ben stops sharing, the link says it isn't shared", async () => {
    await ben.getByRole("dialog", { name: "Share this result" }).getByRole("button", { name: "Close" }).click();
    const item = ben.locator("li").filter({ hasText: TITLE }).filter({ has: ben.getByRole("button", { name: /Shared · Link/ }) }).first();
    await item.getByRole("button", { name: /Shared · Link/ }).click();
    const dlg = ben.getByRole("dialog", { name: "Share this result" });
    await dlg.getByRole("button", { name: "Stop sharing" }).click();
    await dlg.getByText("Stopped sharing. The link no longer works.").waitFor({ timeout: 15000 });
    await go(anon, "/p/m1");
    await anon.getByText("Its owner stopped sharing it, or the link is wrong.").waitFor({ timeout: 15000 });
  }, anon);

  summary();
  await b.close();
})();
