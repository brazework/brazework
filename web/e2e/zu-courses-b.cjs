// Brazework Courses, phase B (supabase/courses-b.sql): running a course.
// 1. Quizzes and attendance are gone (2026-11-27: the school's LMS runs them): no quiz option on a new
//    assignment, no attendance tab, no class check-in on School.
// 2. Peer evaluation: Cara rates her teammate (Josh) on a group assignment; nobody but staff sees it.
// 3. Accommodations: the professor gives Josh extra days from the gradebook.
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
    const cara = await as(b, "cara@forge.test");
    await step("quizzes and attendance are gone: a new assignment has no quiz option, and the course has no attendance tab", async () => {
      await go(ben, `/c/${cid}/course?tab=assignments`);
      await ben.getByRole("button", { name: "New assignment" }).click();
      await ben.getByLabel("Title").waitFor({ timeout: 15000 });
      if (await ben.getByRole("radio", { name: "Quiz" }).count()) throw new Error("the assignment form still offers a quiz");
      if (await ben.getByRole("link", { name: "Attendance" }).count()) throw new Error("the course still has an attendance tab");
      await go(cara, "/school");
      if (await cara.getByRole("form", { name: "Check in to class" }).count()) throw new Error("School still shows class check-in");
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
