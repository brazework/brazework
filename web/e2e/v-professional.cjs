// Someone who already works (Linear FIX-120). Brazework is for anyone who builds, so a professional
// with no club isn't sent to "Find your club" or told to "Join your club": after onboarding they
// land on Today, start with what they're building, and the next steps send them to a person who saw
// it. The landing page says who signs for a student, an employee and someone on their own. Home asks
// what they're working on (no semester), and Settings lets anyone switch Studying ↔ Working.
// The LinkedIn profile link (Linear FIX-214) is optional (supabase/linkedin-optional.sql, step 87):
// offered in About you and Settings, never asked for where they ask, removable, kept private.
const { execSync } = require("child_process");
const { step, browser, go, closeTour, hydrated, summary } = require("./lib.cjs");
// stderr is kept out of the run's output: one step expects the database to refuse, and reads why.
const psql = (sql) => execSync(`docker exec -i ${process.env.E2E_STACK || "forge-e2e"}-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA`, { input: sql, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();

(async () => {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage(); page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  const email = `pat${Date.now() % 100000}@voltline.test`;

  await step("landing: one record for someone studying, working and on their own, each with who signed", async () => {
    await go(page, "/");
    const who = page.locator("#who");
    for (const h of ["Studying", "Working", "On your own"]) await who.getByRole("heading", { name: h, exact: true }).waitFor();
    const signed = await who.getByText(/^Verified by /).count();
    if (signed !== 3) throw new Error(`expected 3 signed examples, got ${signed}`);
    await page.locator("#faq").getByRole("button", { name: "I already work. Is this for me?" }).waitFor();
    const text = await page.locator("main").innerText();
    if (/for students and clubs/i.test(text)) throw new Error("the landing page still says it's for students and clubs");
  }, page);

  await step("landing on a phone: the three stages stack and nothing scrolls sideways", async () => {
    const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
    await go(phone, "/");
    await phone.locator("#who").getByRole("heading", { name: "On your own", exact: true }).scrollIntoViewIfNeeded();
    const wide = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (wide > 1) throw new Error(`the page scrolls sideways by ${wide}px`);
    const tops = await phone.locator("#who li h3").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    if (!(tops[0] < tops[1] && tops[1] < tops[2])) throw new Error("the stages should stack on a phone: " + tops.join(","));
    await phone.context().close();
  }, page);

  await step("sign up as a professional with a work email", async () => {
    await go(page, "/signup");
    await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', "forge-test-pass-1");
    await page.locator('button[type="submit"]').click();
    await page.getByText("Check your inbox").first().waitFor({ timeout: 20000 });
  }, page);

  await step("About you: the way in is five steps for everyone; setting up a profile instead is three (no club step)", async () => {
    await go(page, "/feed");
    await page.waitForURL(/onboarding/, { timeout: 15000 });
    await page.getByRole("heading", { name: "About you" }).waitFor({ timeout: 15000 });
    await page.getByText("Step 2 of 5").waitFor();
    await hydrated(page.getByRole("button", { name: /professional/i }));
    if (await page.locator('input[name="linkedin"]').count()) throw new Error("LinkedIn is asked before Professional is picked");
    await page.getByRole("button", { name: /professional/i }).click();
    await page.getByText("Employed, freelancing or building on your own.").waitFor();
    await page.getByText("Step 2 of 5").waitFor();
    await page.fill('input[name="firstName"]', "Pat"); await page.fill('input[name="lastName"]', "Okoro");
    await page.fill('input[name="birthday"]', "1996-03-12");
    // A professional is offered a LinkedIn profile link: optional, but a wrong one is refused.
    await page.getByLabel(/LinkedIn profile/).waitFor();
    await page.getByText("Private: it isn't shown on your profile or your record.").waitFor();
    await page.getByLabel(/LinkedIn profile/).fill("twitter.com/pat");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText(/Enter your LinkedIn profile link/).waitFor({ timeout: 15000 });
    await page.getByLabel(/LinkedIn profile/).fill("");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Step 3 of 5").waitFor({ timeout: 20000 });
    await hydrated(page.getByRole("link", { name: /Set up your profile instead/ }));
    await page.getByRole("link", { name: /Set up your profile instead/ }).click();
    await page.getByText("Step 3 of 3").waitFor({ timeout: 20000 });
  }, page);

  await step("onboarding asks for a profession, then goes straight to Today (no 'Find your club')", async () => {
    await page.waitForFunction(() => { const el = document.querySelector('input[name="headline"]'); return el && Object.keys(el).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 15000 });
    await page.getByText("Your profession").waitFor();
    await page.fill('input[name="headline"]', "Controls engineer at Voltline");
    const fieldBtn = page.getByRole("button", { name: /Mechanical|Aerospace/ }).first();
    if (await fieldBtn.isVisible().catch(() => false)) await fieldBtn.click();
    let need = await page.getByText(/Pick \d more interest/).count();
    for (let i = 0; need && i < 12; i++) { await page.locator('button[aria-pressed="false"]').nth(i).click().catch(() => {}); need = await page.getByText(/Pick \d more interest/).count(); }
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/feed/, { timeout: 20000 });
    if (/onboarding\/club/.test(page.url())) throw new Error("a professional was sent to Find your club");
  }, page);
  await closeTour(page);

  await step("Today starts with their work: the first-build box, and nothing says to join a club first", async () => {
    await hydrated(page.locator("#first-build"));
    const text = await page.locator("main").innerText();
    if (/Next: Join your club/.test(text)) throw new Error("Today told a professional to join a club first");
    // Asked about their work, not a semester or a club (lib/front-door.ts firstBuildCopy).
    await page.getByText(/^What are you working on, /).waitFor();
    const box = await page.getByRole("region", { name: "Your first build" }).innerText();
    if (/semester|club/i.test(box)) throw new Error("the first-build box talks about a semester or a club: " + box.replace(/\s+/g, " ").slice(0, 200));
  }, page);

  await step("after the first build, the steps are about the work and a person who saw it", async () => {
    await page.fill("#first-build", "A pick-and-place cell for the battery line");
    await page.getByRole("button", { name: /Start my build/ }).first().click();
    const list = page.getByRole("region", { name: "Get started" });
    await list.waitFor({ timeout: 20000 });
    const text = await list.innerText();
    if (!/\/4/.test(text)) throw new Error("a professional's list should have 4 steps, got: " + text.replace(/\s+/g, " ").slice(0, 160));
    if (!text.includes("Next: Post an update about it")) throw new Error("the next step should be the update, got: " + text.replace(/\s+/g, " ").slice(0, 160));
    // The rest of the list opens on a tap.
    await list.getByRole("button", { name: /All steps/ }).click();
    await list.getByText("Ask someone who saw it to verify a milestone").waitFor({ timeout: 10000 });
    const all = await list.innerText();
    if (/club/i.test(all)) throw new Error("the list mentions a club: " + all.replace(/\s+/g, " ").slice(0, 240));
  }, page);

  await step("Settings: Working is picked, and Studying needs a university email (a work address is refused)", async () => {
    await go(page, "/settings");
    const working = page.getByRole("radio", { name: "Working" });
    await working.waitFor({ timeout: 15000 });
    if (!(await working.isChecked())) throw new Error("Working isn't picked for a professional");
    await page.getByRole("radio", { name: "Studying" }).check();
    await page.getByRole("button", { name: "Save profile" }).click();
    await page.getByText(/A student account needs your university email/).waitFor({ timeout: 15000 });
    await go(page, "/settings");
    if (!(await page.getByRole("radio", { name: "Working" }).isChecked())) throw new Error("the refused switch changed the account anyway");
  }, page);

  const id = psql(`select id from auth.users where email = '${email}'`);
  const title = "Pick-and-place cell hit 42 parts a minute";
  await step("nobody is stopped for LinkedIn: without a link they use the app, and Settings shows the field empty", async () => {
    await go(page, "/feed");
    if (!/\/feed/.test(page.url())) throw new Error("a professional with no link was sent to " + page.url());
    await go(page, "/settings");
    if ((await page.getByLabel(/LinkedIn profile/).inputValue()) !== "") throw new Error("Settings shows a link nobody gave");
  }, page);

  // The database's own ask, as the signed-in member (the test stack sends no email, so the app's ask
  // stops at "email isn't available"; this is the same function the app and AI tools call).
  const askAs = (token) => psql(`begin; select set_config('request.jwt.claim.sub', '${id}', true); set local role authenticated;
    insert into public.milestones (project_id, community_id, title, detail, evidence) select id, null, '${title}', '', 'https://github.com/voltline/cell/pull/7' from public.projects where owner_id = '${id}' limit 1;
    select public.request_vouch((select id from public.milestones where owner_id = '${id}' and title = '${title}' limit 1), 'sam.rivera@northwind-payments.io', 'manager', repeat('${token}', 64)); commit;`);

  await step("asking someone to sign doesn't need a LinkedIn link: the database lets them, and the dialog never asks for one", async () => {
    askAs("a");
    if (psql(`select count(*) from public.milestone_vouches where requested_by = '${id}' and state = 'asked'`) !== "1") throw new Error("a working account with no link couldn't ask");
    psql(`delete from public.milestones where owner_id = '${id}' and title = '${title}'`);
    await go(page, "/u/" + id);
    await hydrated(page.getByRole("button", { name: "Add milestone" }).first());
    await page.getByRole("button", { name: "Add milestone" }).first().click();
    const dialog = page.locator("dialog[open]");
    const who = dialog.getByRole("radio", { name: /Someone who saw it/ });
    if (await who.count()) await who.click();
    await dialog.locator('input[name="title"]').fill(title);
    await dialog.locator('input[name="evidence"]').fill("https://github.com/voltline/cell/pull/7");
    await dialog.locator('input[name="vouchEmail"]').fill("sam.rivera@northwind-payments.io");
    await dialog.getByRole("button", { name: "Ask them to vouch" }).click();
    // The ask goes (the dialog closes) or, on a stack that sends no email, the app says so. Never a LinkedIn stop.
    await Promise.race([
      page.locator("dialog[open]").waitFor({ state: "detached", timeout: 20000 }),
      dialog.getByText(/Email isn't available right now/).waitFor({ timeout: 20000 }),
    ]);
    if (await page.getByText(/Add your LinkedIn profile link/).count()) throw new Error("the dialog asked for a LinkedIn link");
    if (await page.locator('dialog[open] input[name="linkedin"]').count()) throw new Error("the dialog shows a LinkedIn field");
    if (psql(`select coalesce(linkedin_url, '') from public.profiles where id = '${id}'`) !== "") throw new Error("a link was saved nobody gave");
  }, page);

  await step("Settings: the link is optional, saved cleaned, and can be removed even after asking someone to sign", async () => {
    await go(page, "/settings");
    const link = page.getByLabel(/LinkedIn profile/);
    await link.waitFor({ timeout: 15000 });
    await link.fill("https://uk.linkedin.com/in/pat-okoro/?utm_source=share");
    await page.getByRole("button", { name: "Save profile" }).click();
    await page.getByText("Profile saved.").waitFor({ timeout: 15000 });
    await go(page, "/settings");
    if ((await page.getByLabel(/LinkedIn profile/).inputValue()) !== "https://www.linkedin.com/in/pat-okoro") throw new Error("the saved link is " + (await page.getByLabel(/LinkedIn profile/).inputValue()));
    await page.getByLabel(/LinkedIn profile/).fill("");
    await page.getByRole("button", { name: "Save profile" }).click();
    await page.getByText("Profile saved.").waitFor({ timeout: 15000 });
    if (psql(`select coalesce(linkedin_url, '') from public.profiles where id = '${id}'`) !== "") throw new Error("the link couldn't be removed");
    // Back on, for the privacy check below.
    await page.getByLabel(/LinkedIn profile/).fill("linkedin.com/in/pat-okoro");
    await page.getByRole("button", { name: "Save profile" }).click();
    await page.getByText("Profile saved.").waitFor({ timeout: 15000 });
  }, page);

  await step("the link is private: it isn't on their record, and another member can't read it", async () => {
    await go(page, "/u/" + id);
    await page.getByRole("heading", { name: /Pat Okoro/ }).first().waitFor({ timeout: 15000 });
    if (/linkedin\.com\/in\/pat-okoro/i.test(await page.content())) throw new Error("the LinkedIn link is in the profile page");
    const other = psql(`begin; select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'josh@forge.test'), true); set local role authenticated; select coalesce(public.my_linkedin(), 'none'); rollback;`);
    if (/pat-okoro/.test(other)) throw new Error("another member read the link: " + other);
  }, page);

  // The way in for most new people is the first build. A working account with no LinkedIn link asks
  // a person on the last screen without being asked for one.
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p2 = await ctx2.newPage(); p2.errs = []; p2.on("pageerror", (e) => p2.errs.push(e.message));
  const email2 = `sky${Date.now() % 100000}@voltline.test`;
  await step("first build as a professional with no link: the last screen never asks for one, and the ask goes", async () => {
    await go(p2, "/signup");
    await p2.fill('input[name="email"]', email2); await p2.fill('input[name="password"]', "forge-test-pass-1");
    await p2.locator('button[type="submit"]').click();
    await p2.getByText("Check your inbox").first().waitFor({ timeout: 20000 });
    await go(p2, "/feed");
    await p2.getByRole("heading", { name: "About you" }).waitFor({ timeout: 15000 });
    await hydrated(p2.getByRole("button", { name: /professional/i }));
    await p2.getByRole("button", { name: /professional/i }).click();
    await p2.fill('input[name="firstName"]', "Sky"); await p2.fill('input[name="lastName"]', "Adu");
    await p2.fill('input[name="birthday"]', "1993-07-01");
    await p2.getByRole("button", { name: "Continue" }).click();
    await p2.getByText("Step 3 of 5").waitFor({ timeout: 20000 });
    const id2 = psql(`select id from auth.users where email = '${email2}'`);
    await hydrated(p2.locator("#first-build-text"));
    await p2.locator("#first-build-text").fill("Cut the pick-and-place cycle from 3.1 to 2.4 seconds");
    await p2.getByRole("button", { name: /Next: proof/ }).click();
    await p2.getByText("Step 4 of 5").waitFor({ timeout: 10000 });
    await p2.getByRole("radio", { name: /A link/ }).click();
    await p2.getByLabel("Link to your proof").fill("https://github.com/voltline/cell/pull/12");
    await p2.getByRole("button", { name: /Next: who saw it/ }).click();
    await p2.getByText("Step 5 of 5").waitFor({ timeout: 10000 });
    await p2.getByRole("radio", { name: /A manager or mentor/ }).click();
    await p2.locator('input[name="signerEmail"]').fill("sam.rivera@northwind-payments.io");
    if (await p2.getByLabel("Your LinkedIn profile").count()) throw new Error("the last screen asks for a LinkedIn link");
    await p2.getByRole("button", { name: "Ask for a signature" }).click();
    await Promise.race([
      p2.waitForURL(/\/u\//, { timeout: 25000 }),
      p2.getByText(/Email isn't available right now/).waitFor({ timeout: 25000 }),
    ]);
    if (await p2.getByText(/Add your LinkedIn profile link/).count()) throw new Error("the ask stopped for a LinkedIn link");
    if (psql(`select count(*) from public.projects where owner_id = '${id2}'`) === "0") throw new Error("the first build wasn't saved");
  }, p2);

  summary();
  await b.close();
})();
