// The landing page (schools first and the landing journey since 2026-11-26): short, with the product
// window as the hero. Signed out, on a laptop and a phone: typing a build makes it the milestone and
// carries it into sign-up; the five views follow it (the professor verifies, the school counts it and
// exports the evidence, a recruiter finds it, it goes to LinkedIn and opens inside the course); a club
// build is verified by its officer; every build draws in 3D in Render, Section and Stress; on a laptop
// the views play as you scroll; what the others can't show; the band for schools and /schools; who
// it's for and where each starts; the pilot form; the page stays short; with reduced motion, nothing
// pins or waits on an animation.
const { BASE, step, browser, go, hydrated, summary } = require("./lib.cjs");

(async () => {
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  const BUILD = "Thrust stand calibrated to 0.4 percent";
  const tabs = () => page.getByRole("tablist", { name: "Follow one project" });
  const selected = async () => (await tabs().getByRole("tab", { selected: true }).innerText()).replace(/^\d\s*/, "").trim();
  const view = (id) => page.locator(`#hero-view-${id}`);

  await step("hero: what you type is the milestone in the product window, and it goes with you to sign-up", async () => {
    await go(page, "/");
    await hydrated(page.locator("#hero-build"));
    await page.locator("#hero-build").fill(BUILD);
    await page.locator("#hero-card").getByText(BUILD).waitFor();
    // The robot arm leads: a class milestone, submitted to its assignment in the course.
    await page.locator("#hero-card").getByText(/ME 482 Robotics · Fall 2026 · Assignment 3: Cycle-time test/).waitFor();
    await page.locator("#top").getByText("New: Brazework Courses").waitFor();
    // Courses shipped (#254): the hero no longer labels them as coming.
    if (await page.locator("#top").getByText(/Courses with pilot schools|grading with pilot schools/).count()) throw new Error("the hero still says Courses are coming");
    const href = await page.locator("#top").getByRole("link", { name: /Get it verified/ }).getAttribute("href");
    if (new URL(href, BASE).searchParams.get("build") !== BUILD) throw new Error(`the button doesn't carry the build: ${href}`);
    if ((await tabs().getByRole("tab").count()) !== 5) throw new Error("expected five views");
    if ((await selected()) !== "Student") throw new Error(`the hero opens on ${await selected()}`);
  }, page);

  await step("hero: the professor verifies it, the school counts it and exports the evidence, a recruiter finds it, it goes everywhere", async () => {
    await page.locator("#hero-card").getByRole("button", { name: "Submit to ME 482" }).click();
    await view("verify").getByText(BUILD).waitFor();
    for (const who of ["Maya Chen", "Noah Feld", "Tara Singh"]) await view("verify").getByRole("list", { name: "Teammates" }).getByText(who).waitFor();
    // Graded against the rubric (each row an ABET outcome) and verified in one step; the grade is private.
    for (const row of ["Design and method", "Testing and results", "Teamwork"]) await view("verify").getByRole("list", { name: "Rubric" }).getByText(row).waitFor();
    const button = view("verify").getByRole("button", { name: "Grade and verify" });
    if (await button.isVisible()) await button.click().catch(() => {}); // it may finish by itself first
    await view("verify").getByRole("status").getByText(/Verified by Prof\. Dana Ruiz, ME 482, Fall 2026/).waitFor({ timeout: 8000 });
    await view("verify").getByText(/27 \/ 30 · seen only by Maya and the course's faculty/).waitFor();

    await tabs().getByRole("tab", { name: "School" }).click();
    await view("school").getByText("ABET outcome 1 · Solving complex problems").waitFor();
    await view("school").getByText("+1 just now").waitFor({ timeout: 8000 });
    await view("school").getByRole("button", { name: "Export evidence" }).click();
    const report = page.getByRole("dialog", { name: "Sample evidence report" });
    await report.getByText(BUILD).waitFor();
    await report.getByRole("button", { name: "Close the report" }).click();
    await report.waitFor({ state: "detached" });

    await tabs().getByRole("tab", { name: "Recruiter" }).click();
    await view("recruiter").getByText("robotics, motion planning, verified").waitFor({ timeout: 8000 });
    await view("recruiter").getByText(BUILD).waitFor();
    await view("recruiter").getByText(/Verified by Prof\. Dana Ruiz/).first().waitFor();
    await view("recruiter").getByText("Viewed by Pratt & Whitney").waitFor({ timeout: 8000 });

    await tabs().getByRole("tab", { name: "Everywhere" }).click();
    await view("everywhere").getByRole("button", { name: "Add to LinkedIn" }).click();
    await view("everywhere").getByText("Added to LinkedIn").waitFor();
    await view("everywhere").getByText(/brazework\.com\/v\//).waitFor();
    await view("everywhere").getByText("Grades stay private: only you and your professors see them.").waitFor();
    await page.locator("#top").getByText("Example · Add to LinkedIn, the verify link and the résumé work today").waitFor();
    // What isn't built says so: Torch's feedback draft.
    await tabs().getByRole("tab", { name: "Professor" }).click();
    await view("verify").getByText("Coming soon:").waitFor();
  }, page);

  await step("hero: every build draws in 3D in its three views (software ones name theirs), and a club build is verified by its officer", async () => {
    await go(page, "/");
    await page.waitForFunction(() => ["ready", "failed"].includes(document.querySelector("#cad-stage")?.getAttribute("data-state") ?? ""), null, { timeout: 30000 });
    const drew = (await page.locator("#cad-stage").getAttribute("data-state")) === "ready";
    if (drew && !(await page.locator("#cad-stage canvas").count())) throw new Error("ready, but no canvas");
    const builds = page.getByRole("group", { name: "Example builds" });
    const chips = ["Robot arm", "Formula SAE", "Rover autonomy", "Neural network", "Drone", "Truss bridge", "Circuit board", "Backend cluster", "Gearbox", "Rocket avionics"];
    const names = { "Rover autonomy": ["Render", "Inside", "Cost map"], "Neural network": ["Render", "Layers", "Activations"], "Backend cluster": ["Render", "Inside", "Load"] };
    if ((await builds.getByRole("button").count()) !== chips.length) throw new Error("expected ten example builds");
    for (const chip of chips) {
      await builds.getByRole("button", { name: chip, exact: true }).click();
      if ((await builds.getByRole("button", { name: chip, exact: true }).getAttribute("aria-pressed")) !== "true") throw new Error(`${chip} isn't marked as the build`);
      const modes = names[chip] ?? ["Render", "Section", "Stress"];
      for (const k of [1, 2, 0]) {
        await page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name: modes[k], exact: true }).click();
        const on = await page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { checked: true }).allInnerTexts();
        if (on.length !== 1 || !on[0].includes(modes[k])) throw new Error(`${chip}: after ${modes[k]}, the views marked are ${on.join(", ")}`);
      }
      if (drew) await page.locator("#cad-stage .cad-callout").first().waitFor({ state: "attached" });
      if (page.errs.length) throw new Error(`${chip}: ${page.errs[0]}`);
    }
    await builds.getByRole("button", { name: "Drone", exact: true }).click();
    await page.locator("#hero-card").getByText(/Aerial Robotics Club · 5-inch inspection quad/).waitFor();
    await tabs().getByRole("tab", { name: "Club officer" }).click();
    await view("verify").getByRole("status").getByText(/Verified by A\. Novak, president, Aerial Robotics Club/).waitFor({ timeout: 8000 });
    // A software build's proof is its code, linked from GitHub.
    await tabs().getByRole("tab", { name: "Student" }).click();
    await builds.getByRole("button", { name: "Neural network", exact: true }).click();
    await page.locator("#hero-card").getByText("GitHub repo").waitFor();
  }, page);

  await step("hero: on a laptop it pins and plays the views as you scroll, and clicking a view scrolls to it", async () => {
    await go(page, "/");
    await hydrated(page.locator("#hero-build"));
    const run = await page.evaluate(() => { const el = document.getElementById("top"); return { top: el.offsetTop, length: el.offsetHeight - innerHeight }; });
    if (run.length < 400) throw new Error(`the hero has no scroll run (${run.length}px)`);
    for (const [p, name] of [[0.5, "School"], [0.99, "Everywhere"], [0.05, "Student"]]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(run.top + run.length * p));
      await page.waitForFunction((n) => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes(n), name, { timeout: 5000 });
      const box = await tabs().boundingBox();
      if (!box || box.y < 0 || box.y > 950) throw new Error(`at ${p} of the run the window isn't on screen (${box && box.y})`);
    }
    await tabs().getByRole("tab", { name: "Recruiter" }).click();
    await page.waitForFunction((r) => Math.abs(scrollY - (r.top + (r.length * 3.5) / 5)) < 40, run, { timeout: 5000 });
    if ((await selected()) !== "Recruiter") throw new Error(`after scrolling to Recruiter, ${await selected()} is selected`);
  }, page);

  await step("what the others can't do: profiles, the course site and Brazework, straight after the hero, with what's still being built marked", async () => {
    await go(page, "/");
    const order = await page.locator("main > section").evaluateAll((els) => els.map((el) => el.id));
    if (order.join(",") !== "top,compare,schools,for,pilot") throw new Error(`the page runs ${order.join(", ")}`);
    const sec = page.locator("#compare");
    await sec.getByRole("heading", { name: /Everything a course needs, built around what students build/ }).waitFor();
    // Brazework is the course platform now (docs/strategy.md): the page no longer hands grades to an LMS.
    if (await page.getByText(/keeps the gradebook|opened through LTI/).count()) throw new Error("the page still says the LMS keeps the grades");
    for (const h of ["LinkedIn, Handshake", "Blackboard, Canvas", "Brazework"]) await sec.getByRole("heading", { name: h, exact: true }).waitFor();
    await sec.getByText("The professor, club or sponsor who saw it").waitFor();
    await sec.getByText("Upload a file, get a grade").waitFor();
    // What isn't built yet says so, in one line: peer evaluation, imports, sign-on, LTI.
    if (await sec.getByText("with pilot schools", { exact: true }).count()) throw new Error("the strip still marks shipped Courses features as coming");
    await sec.getByText(/Coming with pilot schools: peer evaluation, importing a course/).waitFor();
  }, page);

  await step("for schools: the band names each office's outcome, marks what's still being built, and leads to /schools", async () => {
    const band = page.locator("#schools");
    await band.getByRole("heading", { name: /verified by the people who saw it/ }).waitFor();
    for (const h of ["Accreditation evidence", "Club engagement", "Placement data", "A public showcase"]) await band.getByRole("heading", { name: h, exact: true }).waitFor();
    if ((await band.getByText("With pilot schools").count()) !== 2) throw new Error("the band should mark the two outcomes still being built");
    // How a school grows on it, with the prices from lib/pricing.ts.
    const grow = band.getByRole("list", { name: "How a school starts" });
    for (const t of [/One course, one semester/, /\$1,500 pilot/, /\$6,000 a year/, /From \$18,000 a year/]) await grow.getByText(t).waitFor();
    await band.getByRole("link", { name: /See what schools get/ }).click();
    await page.waitForURL(/\/schools$/, { timeout: 15000 });
    await page.getByRole("heading", { level: 1, name: /Your courses, projects and clubs/ }).waitFor();
    await page.getByText("$6,000").first().waitFor();
    await page.getByText(/\$1,500 for the semester/).waitFor();
    await page.getByText(/your offices see counts, never a grade/).waitFor();
    if (await page.getByText(/first 10 schools|semester free/i).count()) throw new Error("/schools still offers a free pilot");
    await go(page, "/");
  }, page);

  await step("who it's for: students, clubs and schools, each with where to start; companies get a line", async () => {
    const sec = page.locator("#for");
    for (const h of ["Students", "Clubs", "Schools"]) await sec.getByRole("heading", { name: h, exact: true }).waitFor();
    await sec.getByRole("link", { name: /Bring your club/ }).click();
    await page.locator("#pilot").getByRole("heading", { name: /Start a pilot at your school/ }).waitFor();
    if ((await page.locator("#pilot").getByRole("button", { name: "School or department", pressed: true }).count()) !== 1) throw new Error("the pilot form doesn't start on School");
    await go(page, "/");
    await page.locator("#for").getByRole("link", { name: /Find students by signed work/ }).click();
    await page.waitForURL(/\/pricing#pricing-companies$/, { timeout: 15000 });
    await page.getByText("$15,000").first().waitFor();
    await go(page, "/");
  }, page);

  await step("the page is short: a few screens on a laptop", async () => {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (h > 950 * 5) throw new Error(`the page is ${h}px tall, more than five screens`);
  }, page);

  await step("the AI guide: a signed-out visitor follows the footer to /ai and finds the setup, what to ask, the rules and all 20 fields", async () => {
    await go(page, "/");
    await page.locator("footer").getByRole("link", { name: "Connect your AI" }).click();
    await page.waitForURL(/\/ai$/, { timeout: 15000 });
    await page.getByRole("heading", { level: 1, name: /Your AI fills in your record/ }).waitFor();
    for (const h of ["Set it up in two minutes", "What to ask", "What it never does", "Your field"]) await page.getByRole("heading", { name: h, exact: true }).waitFor();
    await page.getByText(/\/api\/mcp$/).first().waitFor();
    // Ask your AI to set it up: one tap opens Claude or ChatGPT with the prompt, and the prompt can be read first.
    const ask = page.getByRole("region", { name: "Ask your AI to set it up" }).first();
    for (const [name, host] of [["Ask Claude", "https://claude.ai/new?q="], ["Ask ChatGPT", "https://chatgpt.com/?q="]]) {
      const href = (await ask.getByRole("link", { name }).getAttribute("href")) ?? "";
      if (!href.startsWith(host) || !decodeURIComponent(href).includes("/api/mcp") || /forge_|Bearer/.test(href)) throw new Error(`${name} link: ${href.slice(0, 120)}`);
    }
    await ask.getByText("Read the prompt").click();
    await ask.getByText(/add it only after I say yes/).waitFor();
    await ask.getByRole("button", { name: "Copy the prompt" }).click();
    await ask.getByRole("status").waitFor({ timeout: 5000 });
    await page.getByText("/start", { exact: true }).waitFor();
    const fields = await page.getByRole("navigation", { name: "Fields" }).getByRole("link").count();
    if (fields !== 20) throw new Error(`${fields} field links, expected 20`);
    await page.getByRole("navigation", { name: "Fields" }).getByRole("link", { name: "Medicine" }).click();
    await page.getByRole("heading", { name: "Medicine", exact: true }).waitFor();
    if (!(await page.locator("#medicine").isVisible())) throw new Error("the Medicine section isn't shown");
  }, page);

  await step("the page raised no errors", async () => { if (page.errs.length) throw new Error(page.errs[0]); }, page);

  // A phone: the build box is full size, the window keeps its height through every view, nothing scrolls sideways.
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await step("phone: the build box is a full-size field, the hero holds its height through all five views, and nothing scrolls sideways", async () => {
    await go(phone, "/");
    const box = await phone.locator("#hero-build").boundingBox();
    if (!box || box.height < 44) throw new Error(`the build box is ${box && Math.round(box.height)}px tall`);
    const hero = phone.locator("#top");
    const before = Math.round((await hero.boundingBox()).height);
    await phone.getByRole("group", { name: "Example builds" }).getByRole("button", { name: "Drone" }).click();
    for (const name of ["Club officer", "School", "Recruiter", "Everywhere"]) {
      await phone.getByRole("tablist", { name: "Follow one project" }).getByRole("tab", { name }).click();
      if (name === "Club officer") await phone.locator("#hero-view-verify").getByRole("status").getByText(/Verified by A\. Novak, president, Aerial Robotics Club/).waitFor({ timeout: 8000 });
      const after = Math.round((await hero.boundingBox()).height);
      if (Math.abs(after - before) > 2) throw new Error(`the hero changed height on ${name}: ${before} to ${after}px`);
      if (await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`phone has horizontal overflow on ${name}`);
    }
  }, phone);

  // Light and dark: the hero, the band for schools and the nav over the hero follow the visitor's theme.
  await step("light and dark: the hero and the band for schools follow the visitor's theme", async () => {
    const look = {};
    for (const scheme of ["light", "dark"]) {
      const p = await (await b.newContext({ viewport: { width: 1440, height: 950 }, colorScheme: scheme })).newPage();
      await p.goto(BASE + "/", { waitUntil: "networkidle" });
      look[scheme] = await p.evaluate(() => ["top", "schools"].map((id) => getComputedStyle(document.getElementById(id)).backgroundColor).concat(getComputedStyle(document.querySelector("#hero-h")).color));
      await p.context().close();
    }
    for (let i = 0; i < 3; i++) if (look.light[i] === look.dark[i]) throw new Error(`part ${i} looks the same in both themes: ${look.light[i]}`);
    if (look.light[0] !== "rgb(247, 247, 245)") throw new Error(`the light hero isn't on paper: ${look.light[0]}`);
  }, page);

  // Reduced motion: nothing pins, plays or waits.
  const still = await (await b.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: "reduce" })).newPage();
  const reducedErrors = [];
  still.on("pageerror", (error) => reducedErrors.push(error.message));
  await step("reduced motion: the hero doesn't pin, and each view shows its end state as soon as it opens", async () => {
    await still.goto(BASE + "/", { waitUntil: "networkidle" });
    await hydrated(still.locator("#hero-build"));
    const run = await still.evaluate(() => { const el = document.getElementById("top"); return el.offsetHeight - el.firstElementChild.offsetHeight; });
    if (Math.abs(run) > 2) throw new Error(`the hero still has a scroll run (${run}px)`);
    const t = still.getByRole("tablist", { name: "Follow one project" });
    await t.getByRole("tab", { name: "Professor" }).click();
    await still.locator("#hero-view-verify").getByRole("status").getByText(/Verified by Prof\. Dana Ruiz/).waitFor({ timeout: 3000 });
    await t.getByRole("tab", { name: "Recruiter" }).click();
    await still.locator("#hero-view-recruiter").getByText("Viewed by Pratt & Whitney").waitFor({ timeout: 3000 });
    if (reducedErrors.length) throw new Error(reducedErrors[0]);
  }, still);

  await b.close();
  summary();
})();
