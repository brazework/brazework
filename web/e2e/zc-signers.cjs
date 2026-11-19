// Signers' tools (supabase/signer-tools.sql): signing is worth a professor's time.
// 1. Prof. Lee opens one link signed out, vouches for it, then answers the two other asks sent to her
//    address from the same page: one vouch (with her own sentence), one "I can't vouch". An ask sent
//    to someone else never shows.
// 2. The reminder: the daily job finds an ask 3 days old (dry run, email is off here) and needs its
//    secret; a reminder's link opens the same ask.
// 3. With an account at that address, "What you've signed" lists what she vouched for, grouped by
//    person, with her words, ready to print.
const crypto = require("crypto"), { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = psql("select id from auth.users where email = 'ben@forge.test'");
const tok = () => { const t = crypto.randomBytes(32).toString("base64url"); return { t, h: crypto.createHash("sha256").update(t).digest("hex") }; };
const tag = Date.now();
const T = { a: `Signers e2e: thrust stand (${tag})`, b: `Signers e2e: injector flow (${tag})`, c: `Signers e2e: igniter timing (${tag})`, d: `Signers e2e: leak check (${tag})` };
const [A, B, C, D, R] = [tok(), tok(), tok(), tok(), tok()];

(async () => {
  const b = await browser();

  await step("seed: four asks, three to Prof. Lee and one to someone else", async () => {
    const ids = {};
    for (const [k, title] of Object.entries(T)) {
      ids[k] = psql(`select set_config('request.jwt.claim.sub', '${ben}', false);
        insert into public.milestones (project_id, community_id, title, detail, evidence, private)
        values ('p1', null, '${title}', 'Measured on the stand.', 'https://github.com/acme/rig/pull/${k.charCodeAt(0)}', false) returning id;`).split("\n").pop();
    }
    psql(`insert into public.milestone_vouches (milestone_id, requested_by, email, relationship, token_hash, created_at) values
      ('${ids.a}', '${ben}', 'prof.lee@utexas.edu', 'professor', '${A.h}', now() - interval '4 days'),
      ('${ids.b}', '${ben}', 'prof.lee@utexas.edu', 'professor', '${B.h}', now()),
      ('${ids.c}', '${ben}', 'prof.lee@utexas.edu', 'pi', '${C.h}', now()),
      ('${ids.d}', '${ben}', 'dean.ortiz@utexas.edu', 'mentor', '${D.h}', now());
      update public.milestones set status = 'pending' where id in ('${ids.a}', '${ids.b}', '${ids.c}', '${ids.d}');`);
  });

  await step("the daily reminder job finds the 3-day-old ask (dry run) and needs its secret", async () => {
    const no = await fetch(`${BASE}/api/cron/signers`);
    if (no.status !== 401) throw new Error(`without the secret: ${no.status}`);
    const r = await fetch(`${BASE}/api/cron/signers?dry=1`, { headers: { Authorization: "Bearer cron_forge_e2e" } });
    const j = await r.json();
    if (!r.ok || !j.dry || j.wouldSend < 1) throw new Error("cron: " + JSON.stringify(j));
  });

  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const anon = await ctx.newPage();

  await step("a reminder's link opens the same ask", async () => {
    psql(`update public.milestone_vouches set reminder_hash = '${R.h}', reminded_at = now() where token_hash = '${A.h}';`);
    await anon.goto(`${BASE}/vouch/${R.t}`, { waitUntil: "networkidle" });
    await anon.getByRole("heading", { name: T.a }).waitFor({ timeout: 15000 });
  }, anon);

  await step("one link: vouch for it, then answer the two others to the same address together", async () => {
    await anon.goto(`${BASE}/vouch/${A.t}`, { waitUntil: "networkidle" });
    await anon.getByRole("heading", { name: T.a }).waitFor({ timeout: 15000 });
    const more = anon.getByRole("region", { name: "2 more asks are waiting for you" });
    await more.waitFor({ timeout: 10000 });
    if (await anon.getByText(T.d).count()) throw new Error("an ask sent to someone else is shown");
    await anon.getByLabel("Your name").first().fill("Dr. Priya Lee");
    await anon.getByLabel("Your role").first().fill("Assistant Professor");
    await anon.getByLabel("What did you see them do?").first().fill("I watched the calibration run in the propulsion lab; readings matched.");
    await anon.getByLabel("How do you know their work?").first().fill("I'm his research advisor");
    await anon.getByRole("button", { name: "Vouch", exact: true }).click();
    await anon.getByText("Your vouch is on their record").waitFor({ timeout: 15000 });

    await more.getByLabel("Your name").fill("Dr. Priya Lee");
    await more.getByLabel("Your role").fill("Assistant Professor");
    const bItem = more.getByRole("listitem", { name: T.b });
    await bItem.getByText("Vouch", { exact: true }).click();
    await bItem.getByLabel("What did you see them do?").fill("I watched the injector flow test on the bench in our lab.");
    await bItem.getByLabel("How do you know their work?").fill("His advisor");
    await more.getByRole("listitem", { name: T.c }).getByText("I can't vouch").click();
    await more.getByRole("button", { name: "Answer these 2" }).click();
    await more.getByText("Done: 2 answered. Thank you.").waitFor({ timeout: 15000 });
    const rows = psql(`select m.title || '=' || m.status || '/' || v.state from public.milestone_vouches v join public.milestones m on m.id = v.milestone_id where m.title like 'Signers e2e:%${tag})' order by m.title`);
    const want = [`${T.c}=pending/declined`, `${T.b}=verified/vouched`, `${T.d}=pending/asked`, `${T.a}=verified/vouched`].sort().join("\n");
    if (rows.split("\n").sort().join("\n") !== want) throw new Error("after answering: " + rows);
  }, anon);

  await step("What you've signed: her vouches, grouped by person, with her words", async () => {
    // Cara's account takes Prof. Lee's address (as if she'd signed up with it).
    psql(`update auth.users set email = 'prof.lee@utexas.edu', email_confirmed_at = now() where email = 'cara@forge.test';`);
    try {
      const page = await as(b, "prof.lee@utexas.edu");
      await go(page, "/signed");
      const ben = page.getByRole("region", { name: "Ben Cho" });
      await ben.waitFor({ timeout: 15000 });
      await ben.getByText(T.a).waitFor();
      await ben.getByText(T.b).waitFor();
      if (await ben.getByText(T.c).count()) throw new Error("a declined ask is listed as signed");
      await ben.getByText("I watched the injector flow test on the bench in our lab.", { exact: false }).waitFor();
      await page.getByRole("button", { name: "Print or save as PDF" }).waitFor();
    } finally {
      psql(`update auth.users set email = 'cara@forge.test' where email = 'prof.lee@utexas.edu';`);
    }
  });

  await b.close();
  summary();
})();
