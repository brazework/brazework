// Brazework Courses, phase B (supabase/courses-b.sql): running a course.
// 1. The professor (Ben) writes a quiz in the browser: a multiple-choice question and a number question.
// 2. A student (Cara) takes it once and is marked on the spot; the professor sees her answers against the key.
// 3. Attendance: the professor opens check-in, Cara checks in from School with the code on the screen,
//    and the professor sees her present.
// 4. Peer evaluation: Cara rates her teammate (Josh) on a group assignment; nobody but staff sees it.
// 5. Accommodations: the professor gives Josh extra days from the gradebook.
// The class and the group are made directly in the database and removed at the end.
const { execSync } = require("child_process");
const { step, browser, as, go, hydrated, summary } = require("./lib.cjs");

const psql = (sql) => execSync(`docker exec -i ${process.env.E2E_STACK || "forge-e2e"}-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA`, { input: sql }).toString().trim();
const COURSE = `ME ${200 + (Date.now() % 90)}`;

(async () => {
  const cid = psql(`
    with c as (
      insert into public.communities (name, about, field, type, privacy, topics, rules, owner_id, owner_name, school_domain, course, term)
      select '${COURSE} · Dynamics', '', '', 'class', 'approval', '{}', '', u.id, 'Ben Cho', 'forge.test', '${COURSE}', 'Fall 2026' from auth.users u where u.email = 'ben@forge.test'
      returning id)
    select id from c;`).split("\n")[0];
  psql(`insert into public.community_members (community_id, uid, role) select '${cid}', id, case when email = 'ben@forge.test' then 'owner' else 'member' end from auth.users where email in ('ben@forge.test', 'cara@forge.test', 'josh@forge.test') on conflict do nothing;`);
  // Cara and Josh share a project; a group assignment asks for peer evaluation.
  psql(`
    with p as (insert into public.projects (owner_id, title, summary, community_id, private) select id, 'Pendulum rig', 'A double pendulum.', '${cid}', true from auth.users where email = 'cara@forge.test' returning id)
    insert into public.project_members (project_id, uid) select p.id, u.id from p, auth.users u where u.email = 'josh@forge.test';
    insert into public.assignments (community_id, title, group_work, peer_eval, submit_as, published, points) values ('${cid}', 'Design review', true, true, '{link}', true, 100);`);
  const b = await browser();
  try {
    const ben = await as(b, "ben@forge.test");
    await step("the professor writes a quiz in the browser: a choice question and a number question", async () => {
      await go(ben, `/c/${cid}/course?tab=assignments`);
      await hydrated(ben.getByRole("button", { name: "New assignment" }));
      await ben.getByRole("button", { name: "New assignment" }).click();
      const f = ben.getByRole("form", { name: "New assignment" });
      await f.getByRole("radio", { name: "Quiz" }).click();
      await f.getByLabel("Title").fill("Quiz 1: Units");
      await f.getByLabel("Question 1", { exact: true }).fill("Units of force?");
      await f.getByLabel("Question 1 option 1").fill("Joule");
      await f.getByLabel("Question 1 option 2").fill("Newton");
      await f.getByRole("radio", { name: "Option 2 is right" }).check();
      await f.getByLabel("Question 1 points").fill("2");
      await f.getByRole("button", { name: "Add a question" }).click();
      await f.getByLabel("Question 2 kind").selectOption("number");
      await f.getByLabel("Question 2", { exact: true }).fill("g in m/s²?");
      await f.getByLabel("Question 2 answer").fill("9.81");
      await f.getByLabel("Question 2 tolerance").fill("0.05");
      await f.getByLabel("Question 2 points").fill("3");
      await f.getByRole("button", { name: "Save the quiz" }).click();
      await f.getByRole("status").getByText(/Quiz posted/).waitFor({ timeout: 15000 });
      const row = psql(`select kind || '|' || points || '|' || jsonb_array_length(quiz) || '|' || (quiz::text like '%answer%') from public.assignments where community_id = '${cid}' and title = 'Quiz 1: Units'`);
      if (row !== "quiz|5.00|2|false") throw new Error(`the quiz: ${row}`);
    }, ben);

    const cara = await as(b, "cara@forge.test");
    await step("a student takes the quiz once and is marked on the spot; the professor sees her answers against the key", async () => {
      await go(cara, `/c/${cid}/course?tab=assignments`);
      await cara.getByRole("link", { name: "Quiz 1: Units" }).click();
      await cara.waitForURL(/\/course\/a\//, { timeout: 15000 });
      const q = cara.getByRole("form", { name: "Take the quiz" });
      await hydrated(q.getByRole("button", { name: "Hand in the quiz" }));
      await q.getByText("Newton", { exact: true }).click();
      await q.getByLabel("Answer 2").fill("9.8");
      await q.getByRole("button", { name: "Hand in the quiz" }).click();
      await cara.getByRole("region", { name: "Your answers" }).getByText("Scored 5 of 5").waitFor({ timeout: 15000 });
      await cara.reload();
      await cara.getByRole("region", { name: "Your answers" }).getByText("Newton").waitFor({ timeout: 15000 });
      if (await cara.getByRole("form", { name: "Take the quiz" }).count()) throw new Error("the quiz can be taken twice");
      await go(ben, cara.url().replace(/^https?:\/\/[^/]+/, ""));
      await ben.getByRole("region", { name: "Questions and answers" }).getByText("Newton").first().waitFor({ timeout: 15000 });
      await ben.getByRole("region", { name: "Hand-ins" }).getByText("5 / 5").waitFor();
    }, ben);

    await step("attendance: the professor opens check-in, the student checks in from School with the code, and shows present", async () => {
      await go(ben, `/c/${cid}/course?tab=attendance`);
      const open = ben.getByRole("form", { name: "Take attendance" });
      await hydrated(open.getByRole("button", { name: "Take attendance" }));
      await open.getByLabel(/Session/).fill("Lecture 3");
      await open.getByRole("button", { name: "Take attendance" }).click();
      const code = (await ben.getByLabel("Check-in code").innerText({ timeout: 15000 })).trim();
      if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error(`the code: ${code}`);
      await go(cara, "/school");
      const form = cara.getByRole("form", { name: "Check in to class" });
      await hydrated(form.getByRole("button", { name: "Check in" }));
      await form.getByLabel("Check-in code").fill(code.toLowerCase());
      await form.getByRole("button", { name: "Check in" }).click();
      await form.getByRole("status").getByText(new RegExp(`checked in to ${COURSE}`)).waitFor({ timeout: 15000 });
      await ben.reload();
      await ben.getByRole("radiogroup", { name: /^Cara .*attendance/ }).getByRole("radio", { name: "Present", checked: true }).waitFor({ timeout: 15000 });
    }, ben);

    await step("peer evaluation: the student rates her teammate, and only staff can read it", async () => {
      await go(cara, `/c/${cid}/course?tab=assignments`);
      await cara.getByRole("link", { name: "Design review" }).click();
      const f = cara.getByRole("form", { name: "Rate your teammates" });
      await f.waitFor({ timeout: 15000 });
      await hydrated(f.getByRole("button", { name: "Send ratings" }));
      await f.getByRole("radiogroup", { name: /^Rate Josh/ }).getByRole("radio", { name: "4 of 5" }).click();
      await f.getByRole("button", { name: "Send ratings" }).click();
      await f.getByRole("status").getByText(/Only your professor sees your ratings/).waitFor({ timeout: 15000 });
      if (psql(`select score from public.peer_reviews where community_id = '${cid}'`) !== "4") throw new Error("the rating wasn't saved");
    }, cara);

    await step("accommodations: the professor gives a student extra days from the gradebook", async () => {
      await go(ben, `/c/${cid}/course?tab=grades`);
      const f = ben.getByRole("form", { name: "Set an accommodation" });
      await hydrated(f.getByRole("button", { name: "Save" }));
      await f.getByLabel("Student").selectOption({ label: await f.getByLabel("Student").locator("option", { hasText: "Josh" }).first().innerText() });
      await f.getByLabel("Extra days").fill("2");
      await f.getByRole("button", { name: "Save" }).click();
      await f.getByRole("status").getByText(/Accommodation saved/).waitFor({ timeout: 15000 });
      await ben.getByRole("region", { name: "Accommodations" }).getByText(/2 extra days/).waitFor({ timeout: 15000 });
    }, ben);
  } finally {
    psql(`delete from public.communities where id = '${cid}'`);
    psql(`delete from public.projects where title = 'Pendulum rig' and community_id is null`);
  }
  await b.close();
  summary();
})();
