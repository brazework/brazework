// The student portal (supabase/school-portal.sql, app/(app)/school): one school, three people.
// 1. The school's admin (Maya, a Brazework admin until the school has its own) adds Ben to its faculty list.
// 2. Ben, now faculty, starts ME 410 with a roster; Cara is on it.
// 3. Cara finds the class under Your school (and in the sidebar), and it's private to the class; she can
//    start a class project there.
// 4. Ben's class board says how much of the roster has joined and who has no project yet.
// 5. The admin sees the class in the school's numbers and downloads the evidence export.
// Everything it makes is removed at the end.
const { execSync } = require("child_process");
const { BASE, step, browser, as, go, hydrated, summary } = require("./lib.cjs");

const psql = (sql) => execSync(`docker exec -i ${process.env.E2E_STACK || "forge-e2e"}-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA`, { input: sql }).toString().trim();
const COURSE = `ME ${400 + (Date.now() % 90)}`;

(async () => {
  const b = await browser();
  const maya = await as(b, "maya@forge.test");
  try {
    await step("the school's admin adds faculty from a pasted list, and only addresses at the school count", async () => {
      await go(maya, "/school");
      await maya.getByText("School admin", { exact: true }).waitFor({ timeout: 15000 });
      const form = maya.getByRole("form", { name: "Add faculty" });
      await hydrated(form.getByRole("button", { name: /Add faculty/ }));
      await form.getByLabel("Faculty list").fill("email,name,title\nben@forge.test,Ben Cho,Professor\nsomeone@gmail.com,Not Here,Visitor");
      await form.getByRole("button", { name: /Add faculty/ }).click();
      await form.getByRole("status").getByText(/1 faculty on your list\. 1 skipped/).waitFor({ timeout: 15000 });
      await maya.getByText("ben@forge.test", { exact: false }).first().waitFor();
    }, maya);

    const ben = await as(b, "ben@forge.test");
    await step("faculty start a class with its roster; the class is private and shows under the school", async () => {
      await go(ben, "/school");
      await ben.getByText("Faculty", { exact: true }).waitFor({ timeout: 15000 });
      await hydrated(ben.getByRole("button", { name: "Start a class" }));
      await ben.getByRole("button", { name: "Start a class" }).click();
      const form = ben.getByRole("form", { name: "Start a class" });
      await form.getByLabel("Course").fill(COURSE);
      await form.getByLabel("Name").fill("Capstone Design");
      await form.getByLabel(/Roster/).fill("Last,First,Email\nAdams,Cara,cara@forge.test\nNobody,Yet,future.student@forge.test");
      await form.getByRole("button", { name: "Start the class" }).click();
      await form.getByRole("status").getByText(/Class started with 2 students on the roster/).waitFor({ timeout: 15000 });
      await ben.reload();
      await ben.locator("main").getByText(`${COURSE} ·`, { exact: false }).first().waitFor({ timeout: 15000 });
      const row = psql(`select type || '|' || privacy from public.communities where course = '${COURSE}' and type = 'class'`);
      if (row !== "class|approval") throw new Error(`the class: ${row}`);
    }, ben);

    const cara = await as(b, "cara@forge.test");
    await step("a student on the roster finds the class under Your school and in the sidebar, and can start a class project", async () => {
      await go(cara, "/school");
      // The student portal (student-home.tsx): a greeting, this week's days to tap, and her chats.
      await cara.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), Cara\./ }).waitFor({ timeout: 15000 });
      await cara.getByRole("region", { name: "This week" }).getByRole("group", { name: "Pick a day" }).waitFor();
      await cara.getByRole("region", { name: "Chats" }).getByRole("form", { name: "Message a class" }).waitFor();
      const card = cara.locator("main").getByRole("link", { name: /Capstone Design/ }).first();
      await card.waitFor({ timeout: 15000 });
      await cara.getByTestId("sidebar-school").waitFor();
      await card.click();
      await cara.waitForURL(/\/c\//, { timeout: 15000 });
      await cara.getByText(/Private to the class/).first().waitFor();
      await cara.getByRole("region", { name: "Class projects" }).getByRole("button", { name: /New project/ }).waitFor();
      // Her own standing in the class leads the page: nothing yet, and where to start.
      await cara.getByRole("region", { name: "Your work in this class" }).getByText(/not on a project in this class yet/).waitFor();
      if (await cara.getByRole("region", { name: "Class board" }).count()) throw new Error("a student sees the faculty's class board");
      // Classes never show among clubs.
      await go(cara, "/communities");
      if (await cara.locator("main").getByText(`${COURSE} · Capstone Design`).count()) throw new Error("the class shows in Clubs");
    }, cara);

    await step("the professor's class board: the roster that has joined, and who has no project yet", async () => {
      await go(ben, "/school");
      await ben.locator("main").getByRole("link", { name: /Capstone Design/ }).first().click();
      await ben.waitForURL(/\/c\//, { timeout: 15000 });
      const board = ben.getByRole("region", { name: "Class board" });
      await board.getByText(/1 of 2 on the roster have joined/).waitFor({ timeout: 15000 });
      await board.getByText(/Not on a project yet \(1\)/).waitFor();
      await board.getByText(/No projects yet/).waitFor();
      if (await ben.getByRole("region", { name: "To do" }).count()) throw new Error("a class shows the club to-do list");
    }, ben);

    await step("the school's admin sees the class in the numbers and downloads the evidence export", async () => {
      await go(maya, "/school");
      await maya.getByRole("link", { name: new RegExp(`${COURSE} · Capstone Design`) }).waitFor({ timeout: 15000 });
      const res = await maya.request.get(`${BASE}/school/evidence`);
      if (res.status() !== 200 || !/text\/csv/.test(res.headers()["content-type"] ?? "")) throw new Error(`export: ${res.status()}`);
      const head = (await res.text()).split("\r\n")[0];
      if (!head.startsWith('"Student","Project","Milestone"')) throw new Error(`export header: ${head}`);
      const blocked = await cara.request.get(`${BASE}/school/evidence`);
      if (blocked.status() !== 403) throw new Error(`a student got the export: ${blocked.status()}`);
    }, maya);
  } finally {
    psql(`delete from public.communities where type = 'class' and course = '${COURSE}'`);
    psql("delete from public.school_faculty where email = 'ben@forge.test'");
  }
  await b.close();
  summary();
})();
