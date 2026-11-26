// Brazework Courses (supabase/courses.sql, app/(app)/c/[id]/course): the course loop in one class.
// 1. The professor (Ben) builds the course: a module, a page in it, an assignment with a rubric, an
//    announcement.
// 2. The student (Cara) is told, finds the assignment, and hands in a link.
// 3. Ben grades it against the rubric and releases it; the gradebook and its CSV have it; a student
//    can't download the CSV.
// 4. Cara sees her grade (and only hers), and her hand-in is locked.
// The class is made directly in the database (the school-portal spec covers making classes) and
// removed at the end.
const { execSync } = require("child_process");
const { BASE, step, browser, as, go, hydrated, summary } = require("./lib.cjs");

const psql = (sql) => execSync(`docker exec -i ${process.env.E2E_STACK || "forge-e2e"}-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA`, { input: sql }).toString().trim();
const COURSE = `ME ${300 + (Date.now() % 90)}`;
const NAME = `${COURSE} · Design Studio`;

(async () => {
  const cid = psql(`
    with c as (
      insert into public.communities (name, about, field, type, privacy, topics, rules, owner_id, owner_name, school_domain, course, term)
      select '${NAME}', '', '', 'class', 'approval', '{}', '', u.id, 'Ben Cho', 'forge.test', '${COURSE}', 'Fall 2026' from auth.users u where u.email = 'ben@forge.test'
      returning id)
    select id from c;`).split("\n")[0];
  psql(`insert into public.community_members (community_id, uid, role) select '${cid}', id, case when email = 'ben@forge.test' then 'owner' else 'member' end from auth.users where email in ('ben@forge.test', 'cara@forge.test') on conflict do nothing;`);
  const b = await browser();
  try {
    const ben = await as(b, "ben@forge.test");
    await step("the professor builds the course: a module, a page in it, an assignment with a rubric, an announcement", async () => {
      await go(ben, `/c/${cid}`);
      await ben.getByRole("link", { name: /Course/ }).filter({ hasText: "Build the course" }).click();
      await ben.waitForURL(/\/course$/, { timeout: 15000 });
      await hydrated(ben.getByRole("button", { name: "Add a module" }));
      await ben.getByRole("button", { name: "Add a module" }).click();
      const mod = ben.getByRole("form", { name: "Add a module" });
      await mod.getByLabel("Name").fill("Week 1: Requirements");
      await mod.getByRole("button", { name: "Add the module" }).click();
      await mod.getByRole("status").getByText("Module added.").waitFor({ timeout: 15000 });
      const week = ben.getByRole("region", { name: "Week 1: Requirements" });
      await week.waitFor({ timeout: 15000 });
      await hydrated(week.getByRole("button", { name: "Add material" }));
      await week.getByRole("button", { name: "Add material" }).click();
      const item = ben.getByRole("form", { name: "Add material" });
      await item.getByLabel("Title").fill("How this course runs");
      await item.getByLabel("Page").fill("One project per group, verified as we go.");
      await item.getByRole("button", { name: "Add it" }).click();
      await item.getByRole("status").getByText("Added.").waitFor({ timeout: 15000 });
      await week.getByText("How this course runs").waitFor({ timeout: 15000 });

      await go(ben, `/c/${cid}/course?tab=assignments`);
      await hydrated(ben.getByRole("button", { name: "New assignment" }));
      await ben.getByRole("button", { name: "New assignment" }).click();
      const asg = ben.getByRole("form", { name: "New assignment" });
      await asg.getByLabel("Title").fill("Requirements memo");
      await asg.getByLabel("Due").fill("2030-01-15T17:00");
      await asg.getByLabel("Module").selectOption({ label: "Week 1: Requirements" });
      await asg.locator('input[name="criterion_0"]').fill("Customer needs");
      await asg.locator('input[name="points_0"]').fill("30");
      await asg.locator('select[name="outcome_0"]').selectOption("2");
      await asg.getByRole("button", { name: "Add a row" }).click();
      await asg.locator('input[name="criterion_1"]').fill("Writing");
      await asg.locator('input[name="points_1"]').fill("20");
      await asg.getByRole("button", { name: "Save the assignment" }).click();
      await asg.getByRole("status").getByText(/Assignment posted/).waitFor({ timeout: 15000 });
      await ben.getByRole("region", { name: "Assignments" }).getByRole("link", { name: "Requirements memo" }).waitFor({ timeout: 15000 });
      const points = psql(`select points from public.assignments where community_id = '${cid}'`);
      if (Number(points) !== 50) throw new Error(`the rubric should make it worth 50, not ${points}`);

      await go(ben, `/c/${cid}/course?tab=announcements`);
      await hydrated(ben.getByRole("button", { name: "Announce" }));
      await ben.getByRole("button", { name: "Announce" }).click();
      const ann = ben.getByRole("form", { name: "Announce to the class" });
      await ann.getByLabel("Title").fill("Welcome to the studio");
      await ann.getByLabel("Message").fill("Groups by Friday.");
      await ann.getByRole("button", { name: "Announce" }).click();
      await ann.getByRole("status").getByText(/Announced/).waitFor({ timeout: 15000 });
    }, ben);

    const cara = await as(b, "cara@forge.test");
    await step("the student is told, finds the assignment in its module, and hands in a link", async () => {
      await go(cara, "/notifications");
      await cara.getByText(/New assignment in/).first().waitFor({ timeout: 15000 });
      await cara.getByText(/posted an announcement in/).first().waitFor();
      await go(cara, `/c/${cid}/course`);
      await cara.getByText("Welcome to the studio").waitFor({ timeout: 15000 });
      const week = cara.getByRole("region", { name: "Week 1: Requirements" });
      await week.getByText("To do").waitFor();
      if (await cara.getByRole("button", { name: "Add a module" }).count()) throw new Error("a student can build the course");
      await week.getByRole("link", { name: "Requirements memo" }).click();
      await cara.waitForURL(/\/course\/a\//, { timeout: 15000 });
      const form = cara.getByRole("form", { name: "Hand it in" });
      await hydrated(form.getByRole("button", { name: "Hand it in" }));
      await form.getByLabel(/A link/).fill("docs.google.com/document/d/memo");
      await form.getByRole("button", { name: "Hand it in" }).click();
      await cara.getByRole("status").getByText(/Handed in/).waitFor({ timeout: 15000 });
      await cara.getByRole("region", { name: "Your work" }).getByText("docs.google.com/document/d/memo").waitFor({ timeout: 15000 });
    }, cara);

    await step("the professor grades it on the rubric and releases it; the gradebook and its CSV have it", async () => {
      await go(ben, `/c/${cid}/course?tab=assignments`);
      await ben.getByRole("link", { name: "Requirements memo" }).click();
      await ben.waitForURL(/\/course\/a\//, { timeout: 15000 });
      const grade = ben.getByRole("form", { name: /^Grade Cara/ });
      await hydrated(grade.getByRole("button", { name: "Save the grade" }));
      await grade.getByLabel("Customer needs, out of 30").fill("27");
      await grade.getByLabel("Writing, out of 20").fill("18");
      await grade.getByText("45 / 50").waitFor();
      await grade.getByLabel("Feedback").fill("Strong needs list.");
      await grade.getByLabel("Release now").check();
      await grade.getByRole("button", { name: "Save the grade" }).click();
      await grade.getByRole("status").getByText("Graded and released.").waitFor({ timeout: 15000 });
      await go(ben, `/c/${cid}/course?tab=grades`);
      const book = ben.getByRole("region", { name: "Gradebook" });
      await book.getByText("90%").waitFor({ timeout: 15000 });
      const res = await ben.request.get(`${BASE}/c/${cid}/course/grades.csv`);
      if (res.status() !== 200 || !/text\/csv/.test(res.headers()["content-type"] ?? "")) throw new Error(`export: ${res.status()}`);
      const lines = (await res.text()).trim().split("\n");
      if (lines[0] !== "Student,Email,Requirements memo (50),Total,Percent" || !/,45,45\/50,90$/.test(lines[1])) throw new Error(`CSV: ${lines.join(" | ")}`);
      const blocked = await cara.request.get(`${BASE}/c/${cid}/course/grades.csv`);
      if (blocked.status() !== 403) throw new Error(`a student got the gradebook: ${blocked.status()}`);
    }, ben);

    await step("the student sees her grade and feedback, and her hand-in is locked", async () => {
      await go(cara, `/c/${cid}/course?tab=grades`);
      await cara.getByRole("region", { name: "Your grades" }).getByText("45 / 50").waitFor({ timeout: 15000 });
      await cara.getByRole("region", { name: "Your grades" }).getByRole("link", { name: "Requirements memo" }).click();
      await cara.waitForURL(/\/course\/a\//, { timeout: 15000 });
      const g = cara.getByRole("region", { name: "Your grade" });
      await g.getByText("Strong needs list.").waitFor({ timeout: 15000 });
      if (await cara.getByRole("button", { name: /Replace/ }).count()) throw new Error("a graded hand-in can still be replaced");
    }, cara);
  } finally {
    psql(`delete from public.communities where id = '${cid}'`);
    psql(`delete from public.notifications where community_id is null and kind in ('class_announcement', 'assignment_posted', 'grade_released')`);
  }
  await b.close();
  summary();
})();
