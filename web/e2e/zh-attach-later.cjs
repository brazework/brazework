// Adding files after posting (FIX-238):
// 1. Ben posts an update with nothing attached, then edits it and adds a 3D model and a GitHub link;
//    they're tied to that update and show under it, as if posted with it. Removing one works there.
// 2. On a milestone that's already signed, Ben adds evidence; the signature stays and the new link
//    says "added after signing", on his profile and on the public verify page (/v/<id>).
// 3. Someone else can't add evidence to his milestone (the database refuses).
const path = require("path"), { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const NOTE = `Attach later e2e (${Date.now()})`;
const LINK = "https://github.com/bencho/test-stand";
const LATE = `https://docs.google.com/document/d/late-${Date.now() % 100000}`;

(async () => {
  const b = await browser();
  const ben = await as(b, "ben@forge.test");
  const was = psql("select m.private || '|' || p.private from public.milestones m join public.projects p on p.id = m.project_id where m.id = 'm1'").split("|");
  try {
    await step("an update posted bare gains a 3D model and a link from Edit, and they show under it", async () => {
      await go(ben, "/projects/p1");
      await ben.getByLabel("Post an update").fill(NOTE);
      await ben.getByRole("button", { name: /^Post/ }).last().click();
      const card = ben.locator("article", { hasText: NOTE }).first();
      await card.waitFor({ timeout: 30000 });
      await card.getByRole("button", { name: "Edit post" }).click();
      await card.getByLabel("Add a 3D model to this update").setInputFiles(path.join(__dirname, "fixtures", "cube.stl"));
      await card.getByRole("button", { name: "Link", exact: true }).click();
      await card.getByLabel("Link", { exact: true }).fill(LINK);
      await card.getByRole("button", { name: "Add", exact: true }).click();
      await card.getByRole("list", { name: "To add" }).getByText("cube.stl").waitFor();
      await card.getByRole("button", { name: "Save", exact: true }).click();
      await card.getByRole("button", { name: "Edit post" }).waitFor({ timeout: 30000 });
      const rows = psql(`select string_agg(f.kind || ':' || f.name, ',' order by f.kind) from public.project_files f join public.posts p on p.id = f.post_id where p.body = '${NOTE}'`);
      if (!/file:cube\.stl/.test(rows ?? "") || !/link:/.test(rows ?? "")) throw new Error("attached to the update: " + rows);
      // Under the update itself, after a reload: the model can be opened from there.
      await go(ben, "/projects/p1");
      await ben.locator("article", { hasText: NOTE }).first().waitFor({ timeout: 20000 });
      await ben.locator('button[title="View in 3D"]').first().waitFor({ timeout: 20000 });
    }, ben);

    await step("evidence added to a signed milestone keeps the signature and says it came later", async () => {
      if (psql("select status from public.milestones where id = 'm1'") !== "verified") throw new Error("the seeded milestone should be signed");
      await go(ben, `/u/${psql("select id from auth.users where email = 'ben@forge.test'")}`);
      const ms = ben.locator("li", { hasText: "Static fire at 1.2 kN" }).last();
      await ms.getByRole("button", { name: "Add evidence" }).click();
      await ms.getByLabel(/Evidence link for/).fill(LATE);
      await ms.getByText(/already signed: the signature stays/).waitFor();
      await ms.getByRole("button", { name: "Add", exact: true }).click();
      await ms.locator("[data-late]").getByText(/added after signing/).waitFor({ timeout: 15000 });
      const row = psql("select status || '|' || (evidence_items->-1->>'after_signing') from public.milestones where id = 'm1'");
      if (row !== "verified|true") throw new Error("milestone after adding: " + row);
      // The public verify page says so too (anyone with the résumé link).
      psql("update public.milestones set private = false where id = 'm1'; update public.projects set private = false where id = 'p1';");
      const pub = await (await b.newContext()).newPage();
      await pub.goto(`${BASE}/v/m1`, { waitUntil: "networkidle" });
      await pub.getByText(/added after signing/).waitFor({ timeout: 15000 });
      await pub.context().close();
    }, ben);

    await step("only the owner can add evidence", async () => {
      const josh = psql("select id from auth.users where email = 'josh@forge.test'");
      let refused = false;
      try { psql(`set role authenticated; select set_config('request.jwt.claim.sub', '${josh}', false); select public.add_milestone_evidence('m1', 'https://example.org/not-mine');`); }
      catch (e) { refused = /owner can add evidence/.test(String(e.stderr || e.message)); }
      if (!refused) throw new Error("someone else added evidence to Ben's milestone");
    });
  } finally {
    psql(`delete from public.project_files where post_id in (select id from public.posts where body = '${NOTE}'); delete from public.posts where body = '${NOTE}';`);
    psql(`update public.milestones set private = '${was[0]}'::boolean where id = 'm1'; update public.projects set private = '${was[1]}'::boolean where id = 'p1';`);
    psql(`update public.milestones set evidence_items = coalesce((select jsonb_agg(e) from jsonb_array_elements(evidence_items) e where e->>'url' <> '${LATE}'), '[]'::jsonb) where id = 'm1';`);
  }

  await b.close();
  summary();
})();
