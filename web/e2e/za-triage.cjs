// Daily triage of drafts on Today (supabase/daily-triage.sql), on a phone.
// 1. Ben's tools left five drafts; Today says "Your tools noticed 5 things".
// 2. Without leaving Today, in about 30 seconds: Keep a milestone (it waits on the project for a
//    signature), Send one to a club (he picks which), Post a post, Dismiss one. Ask to sign with email
//    off in this stack says so and leaves the draft waiting.
// 3. The page fits a phone (no sideways scroll), and a reload shows only what's left.
// 4. The daily reminder: off until he turns it on (from Today), then Settings shows it on, and the
//    cron job counts him (dry run: email is off here) and refuses callers without the secret.
const { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = psql("select id from auth.users where email = 'ben@forge.test'");
const tag = Date.now();
const T = { keep: `Triage e2e: igniter within 5 ms (${tag})`, club: `Triage e2e: chamber pressure logged (${tag})`, sign: `Triage e2e: injector flow test (${tag})`,
  post: `Triage e2e: static fire #5 is Saturday (${tag})`, dismiss: `Triage e2e: an idea for later (${tag})` };
const ms = (club, title) => `jsonb_build_object('project_id', 'p1', 'club_id', ${club ? `'${club}'` : "null"}, 'title', '${title}', 'detail', 'Measured on the stand.',
  'evidence', '[{"type": "link", "url": "https://github.com/acme/rig/pull/40"}]'::jsonb, 'achieved_on', current_date)`;
const post = (body) => `jsonb_build_object('body', '${body}', 'kind', 'update', 'project_id', 'p1', 'club_id', null, 'tags', '[]'::jsonb)`;

(async () => {
  const b = await browser();

  await step("seed: five drafts from Ben's tools", async () => {
    psql(`update public.tool_drafts set status = 'dismissed' where user_id = '${ben}' and status = 'waiting';
      insert into public.tool_drafts (user_id, kind, payload, via, source, created_at) values
      ('${ben}', 'milestone', ${ms("rkt", T.keep)}, 'GitHub Actions', 'PR #40 merged', now() - interval '5 minutes'),
      ('${ben}', 'milestone', ${ms("rkt", T.club)}, 'Claude Code', '', now() - interval '4 minutes'),
      ('${ben}', 'milestone', ${ms(null, T.sign)}, 'Claude Code', '', now() - interval '3 minutes'),
      ('${ben}', 'post', ${post(T.post)}, 'Cursor', '', now() - interval '2 minutes'),
      ('${ben}', 'post', ${post(T.dismiss)}, 'Claude Code', '', now() - interval '1 minute');
      update public.email_prefs set daily_drafts = false where user_id = '${ben}';`);
  });

  const page = await as(b, "ben@forge.test", { width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  const card = (title) => page.getByRole("article", { name: `Draft: ${title.slice(0, 40)}` });
  const db = (sql) => psql(sql);

  await step("Today says what the tools noticed", async () => {
    await go(page, "/feed");
    await page.getByRole("heading", { name: "Your tools noticed 5 things" }).waitFor({ timeout: 20000 });
    for (const t of Object.values(T)) await card(t).waitFor({ timeout: 10000 });
  }, page);

  let started = 0;
  await step("Keep: the milestone waits on the project for a signature", async () => {
    started = Date.now();
    await card(T.keep).getByRole("button", { name: "Keep", exact: true }).click();
    await card(T.keep).getByText("Kept on your project.").waitFor({ timeout: 15000 });
    const row = db(`select status || '|' || coalesce(community_id, '-') || '|' || via from public.milestones where title = '${T.keep}'`);
    if (row !== "draft|-|GitHub Actions") throw new Error("kept milestone: " + row);
  }, page);

  await step("Send to club: he picks the club, and its officers are asked to verify", async () => {
    await card(T.club).getByRole("button", { name: "Send to club" }).click();
    const pick = card(T.club).getByRole("combobox", { name: "Club" });
    await pick.waitFor({ timeout: 5000 });
    if ((await pick.inputValue()) !== "rkt") throw new Error("the club the tool drafted it for should be picked first");
    await card(T.club).getByRole("button", { name: "Send", exact: true }).click();
    await card(T.club).getByText("Sent to Rocketry Club to verify.").waitFor({ timeout: 15000 });
    const row = db(`select status || '|' || community_id from public.milestones where title = '${T.club}'`);
    if (row !== "pending|rkt") throw new Error("milestone sent to the club: " + row);
  }, page);

  await step("Post, and Dismiss", async () => {
    await card(T.post).getByRole("button", { name: "Post", exact: true }).click();
    await card(T.post).getByText("Posted.").waitFor({ timeout: 15000 });
    await card(T.dismiss).getByRole("button", { name: "Dismiss" }).click();
    await card(T.dismiss).getByText("Dismissed.").waitFor({ timeout: 15000 });
    if (db(`select count(*) from public.posts where body = '${T.post}' and author_id = '${ben}'`) !== "1") throw new Error("the post wasn't posted");
    if (db(`select count(*) from public.posts where body = '${T.dismiss}'`) !== "0") throw new Error("a dismissed draft was posted");
    const took = Date.now() - started;
    if (took > 30000) throw new Error(`four drafts took ${Math.round(took / 1000)} s to triage (the goal is about 30)`);
  }, page);

  await step("Ask to sign with email off: it says so, and the draft stays waiting", async () => {
    await card(T.sign).getByRole("button", { name: "Ask to sign" }).click();
    await card(T.sign).getByRole("textbox", { name: "Their email" }).fill("prof.lee@utexas.edu");
    await card(T.sign).getByRole("button", { name: "Send ask" }).click();
    const alert = card(T.sign).getByRole("alert");
    await alert.waitFor({ timeout: 15000 });
    if (!/Email isn't available/.test(await alert.innerText())) throw new Error("unexpected: " + (await alert.innerText()));
    if (db(`select status from public.tool_drafts where payload->>'title' = '${T.sign}'`) !== "waiting") throw new Error("the draft was used up on an ask that couldn't go");
  }, page);

  await step("it fits a phone, and a reload shows only what's left", async () => {
    const wide = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    if (wide > 1) throw new Error(`Today scrolls sideways on a phone by ${wide}px`);
    await go(page, "/feed");
    await page.getByRole("heading", { name: "Your tools noticed 1 thing" }).waitFor({ timeout: 15000 });
  }, page);

  await step("the daily reminder: turned on from Today, shown in Settings", async () => {
    await page.getByRole("button", { name: "Email me once a day when my tools notice something" }).click();
    await page.getByText("We'll email you once a day when your tools notice something.").waitFor({ timeout: 15000 });
    if (db(`select daily_drafts from public.email_prefs where user_id = '${ben}'`) !== "t") throw new Error("the reminder wasn't saved");
    await go(page, "/settings#email");
    if (!(await page.locator("#email-daily-drafts").isChecked())) throw new Error("Settings → Email doesn't show it on");
  }, page);

  await step("the daily job counts him (dry run) and needs the secret", async () => {
    const no = await fetch(`${BASE}/api/cron/drafts`);
    if (no.status !== 401) throw new Error(`without the secret: ${no.status}`);
    const r = await fetch(`${BASE}/api/cron/drafts?dry=1`, { headers: { Authorization: "Bearer cron_forge_e2e" } });
    const j = await r.json();
    if (!r.ok || !j.dry || j.wouldSend < 1) throw new Error("cron: " + JSON.stringify(j));
  });

  // Leave Ben's Today as the other journeys expect it.
  psql(`update public.tool_drafts set status = 'dismissed' where user_id = '${ben}' and status = 'waiting'; update public.email_prefs set daily_drafts = false where user_id = '${ben}';`);
  await b.close();
  summary();
})();
