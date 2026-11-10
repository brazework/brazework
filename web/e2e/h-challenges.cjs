// Sponsored challenges, end to end: a verified company posts a draft and asks to sponsor it, a Forge
// admin approves the pilot, the company publishes, a member enters a project, the company judges and
// announces, and everyone sees the winner. Also: Find builders and the admin dashboard.
const { step, browser, as, go, summary } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const cara = await as(b, "cara@forge.test");
  const title = `Lightest flight computer ${Date.now() % 10000}`;
  let url = "";
  await step("Cara (verified company) posts a challenge draft", async () => {
    await go(cara, "/challenges/new");
    await cara.fill("#challenge-title", title);
    await cara.fill("#challenge-brief", "Build a flight computer under 20 g that logs at 100 Hz or more. Judged on weight, rate and docs.");
    await cara.fill("#challenge-prize", "$1,000 + interviews");
    const d = new Date(Date.now() + 5 * 864e5); const pad = (n) => String(n).padStart(2, "0");
    await cara.fill("#challenge-deadline", `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T17:00`);
    await cara.getByRole("button", { name: "Save draft" }).click();
    await cara.waitForURL((u) => /^\/challenges\/(?!new$)[^/]+$/.test(u.pathname), { timeout: 20000 });
    url = new URL(cara.url()).pathname;
    await cara.getByRole("heading", { name: title }).waitFor();
  }, cara);
  const josh = await as(b, "josh@forge.test");
  await step("members can't see a draft", async () => {
    await go(josh, url);
    await josh.getByText(/That page doesn.t exist/).waitFor();
    if (await josh.getByText(title).count()) throw new Error("draft title visible");
  }, josh);
  await step("publishing needs a sponsorship; with billing off Cara requests a pilot", async () => {
    await go(cara, url);
    await cara.getByRole("button", { name: "Sponsor this challenge" }).click();
    await cara.getByText(/Pilot requested/).first().waitFor({ timeout: 15000 });
  }, cara);
  const maya = await as(b, "maya@forge.test");
  await step("Maya (Forge admin) approves the pilot on /admin", async () => {
    await go(maya, "/admin");
    await maya.getByText("The loop", { exact: true }).waitFor();
    // Retention by sign-up week and the company reply rate (admin-retention.sql, step 33).
    await maya.getByText("Retention by sign-up week").waitFor();
    await maya.getByText("Students reply to companies").waitFor();
    const row = maya.locator("div").filter({ hasText: title }).filter({ has: maya.getByRole("button", { name: "Approve pilot" }) }).last();
    await row.getByRole("button", { name: "Approve pilot" }).click();
    // Approved requests leave the list.
    await maya.getByRole("link", { name: title }).waitFor({ state: "detached", timeout: 15000 });
  }, maya);
  await step("non-admins get a 404 on /admin", async () => {
    await go(josh, "/admin");
    await josh.getByText(/That page doesn.t exist/).waitFor();
  }, josh);
  await step("Cara publishes it to every club", async () => {
    await go(cara, url);
    await cara.getByRole("button", { name: "Publish to every club" }).click();
    await cara.getByText(/Every club on Forge can see it/).waitFor({ timeout: 15000 });
  }, cara);
  const ben = await as(b, "ben@forge.test");
  await step("Ben finds it and enters a project", async () => {
    await go(ben, "/challenges");
    await ben.getByRole("link", { name: new RegExp(title) }).click();
    await ben.waitForURL(new RegExp(url));
    const opt = await ben.locator("#entry-project option", { hasText: "Recovery avionics" }).getAttribute("value");
    await ben.locator("#entry-project").selectOption(opt);
    await ben.getByRole("button", { name: "Enter this project" }).click();
    await ben.getByText("Your entry", { exact: true }).waitFor({ timeout: 15000 });
  }, ben);
  await step("Cara closes entries, places Ben 1st and announces", async () => {
    cara.on("dialog", (d) => d.accept());
    await go(cara, url);
    await cara.getByText("Recovery avionics").first().waitFor();
    await cara.getByRole("button", { name: "Close entries and judge" }).click();
    await cara.getByText(/Pick your winners/).waitFor({ timeout: 15000 });
    await go(cara, url);
    await cara.getByRole("button", { name: "1st" }).click();
    await cara.getByRole("button", { name: "1st", pressed: true }).waitFor({ timeout: 15000 });
    await cara.getByRole("button", { name: "Announce winners" }).click();
    await cara.getByText("Winners announced").first().waitFor({ timeout: 15000 });
  }, cara);
  await step("everyone sees the winner", async () => {
    await go(josh, url);
    await josh.getByText("Winners", { exact: true }).waitFor();
    await josh.getByRole("link", { name: "Recovery avionics" }).waitFor();
  }, josh);
  await step("the win shows on Ben's profile", async () => {
    await go(josh, "/u/" + process.env.BEN_ID);
    await josh.locator('[aria-label="Challenge wins"]').getByText(/1st · Acme Aerospace challenge/).first().waitFor({ timeout: 15000 });
  }, josh);
  await step("a paid Stripe checkout (signed webhook) lets Cara publish without manual approval", async () => {
    const { createHmac } = require("crypto");
    const paidTitle = `Paid challenge ${Date.now() % 10000}`;
    await go(cara, "/challenges/new");
    await cara.fill("#challenge-title", paidTitle);
    await cara.fill("#challenge-brief", "A paid sponsorship: Stripe tells Forge it's paid, and the sponsor can publish.");
    const d = new Date(Date.now() + 6 * 864e5); const pad = (n) => String(n).padStart(2, "0");
    await cara.fill("#challenge-deadline", `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T17:00`);
    await cara.getByRole("button", { name: "Save draft" }).click();
    await cara.waitForURL((u) => /^\/challenges\/(?!new$)[^/]+$/.test(u.pathname), { timeout: 20000 });
    const id = new URL(cara.url()).pathname.split("/").pop();
    const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_e2e_" + id, payment_status: "paid", metadata: { plan: "challenge", reference: id } } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = (key) => `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;
    const post = (s) => fetch(require("./lib.cjs").BASE + "/api/billing/webhook", { method: "POST", headers: { "Stripe-Signature": s, "Content-Type": "application/json" }, body });
    const forged = await post(sig("whsec_wrong"));
    if (forged.status !== 400) throw new Error("forged signature got " + forged.status);
    const ok = await post(sig(process.env.STRIPE_WEBHOOK_SECRET || "whsec_forge_e2e"));
    if (ok.status !== 200) throw new Error("webhook got " + ok.status + " " + (await ok.text()));
    await go(cara, `/challenges/${id}`);
    await cara.getByText("Paid", { exact: true }).waitFor({ timeout: 10000 });
    await cara.getByRole("button", { name: "Publish to every club" }).click();
    await cara.getByText(/Every club on Forge can see it/).waitFor({ timeout: 15000 });
  }, cara);
  await step("reports: Josh reports Ben's project; a Forge admin sees it and resolves it", async () => {
    const detail = `Photos are from another team ${Date.now() % 10000}`;
    await go(josh, "/projects/p1");
    await josh.getByRole("button", { name: "Report" }).click();
    const dlg = josh.getByRole("dialog", { name: "Report" });
    await dlg.getByLabel(/Fake or misleading/).check();
    await dlg.locator("#report-detail").fill(detail);
    await dlg.getByRole("button", { name: "Send report" }).click();
    await dlg.getByText(/Thanks\. The Forge team will review it\./).waitFor({ timeout: 15000 });
    await go(josh, "/u/" + process.env.JOSH_ID);
    if (await josh.getByRole("button", { name: "Report" }).count()) throw new Error("report offered on your own profile");
    await go(maya, "/admin");
    const reports = maya.getByRole("region", { name: "Reports" });
    const row = reports.locator("div").filter({ hasText: detail }).filter({ has: maya.getByRole("button", { name: "Actioned" }) }).last();
    await row.getByText(/by Ben Cho/).waitFor({ timeout: 15000 });
    await row.getByRole("button", { name: "Actioned" }).click();
    await reports.getByText(detail).waitFor({ state: "detached", timeout: 15000 });
  }, maya);
  await step("a Forge admin adds a requested school (from the sign-up spec)", async () => {
    const domain = require("fs").readFileSync(require("path").join(__dirname, ".results", "school-domain.txt"), "utf8").trim();
    await go(maya, "/admin");
    const list = maya.getByRole("region", { name: "School requests" });
    const row = list.locator("div").filter({ hasText: "@" + domain }).filter({ has: maya.getByRole("button", { name: "Add school" }) }).last();
    await row.getByRole("button", { name: "Add school" }).click();
    await list.getByText("@" + domain).waitFor({ state: "detached", timeout: 15000 });
  }, maya);
  await step("an officer claims a club someone else started; a Forge admin approves; they own it", async () => {
    // Robotics Society was started by Maya; Josh, not a member, says he's its real president.
    await go(josh, "/c/rob?tab=about");
    await josh.getByRole("link", { name: "Claim this club" }).click();
    await josh.waitForURL(/\/c\/rob\/claim/);
    await josh.fill('input[name="role"]', "President");
    await josh.fill('textarea[name="evidence"]', "The engineering school's club directory lists me as president: https://example.edu/clubs/robotics");
    await josh.getByRole("button", { name: "Send claim" }).click();
    // Once sent, the page re-renders into the claim's status (the form and its message go away).
    await josh.getByText(/is with the Forge team/).waitFor({ timeout: 15000 });
    await go(maya, "/admin");
    const claims = maya.getByRole("region", { name: "Club claims" });
    const row = claims.locator("div").filter({ hasText: "President of" }).filter({ has: maya.getByRole("button", { name: "Approve" }) }).last();
    await row.getByRole("button", { name: "Approve" }).click();
    await claims.getByText("No claims waiting.").waitFor({ timeout: 15000 });
    await go(josh, "/c/rob/claim");
    await josh.getByText("You already own this club.").waitFor({ timeout: 15000 });
  }, josh);
  summary();
  await b.close();
})();
