// Your tools (Linear FIX-78): connect an AI coding tool end to end. Ben opens Settings → Your tools,
// picks Claude Code, makes a token, and gets the exact command with it filled in. Then, as Claude
// Code would, the token calls Brazework's MCP server: it lists the tools and reads Ben's profile.
// The page sees that first call and says Claude Code is connected. Cursor's and VS Code's one-tap
// links carry the right config, and a revoked token stops working at once.
const { step, browser, as, go, summary, BASE } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const ben = await as(b, "ben@forge.test", { width: 390, height: 844 });
  let token = "", readOnly = "", cc = "";
  const mcp = (method, params, t = token) => fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${t}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });

  await step("Settings → Your tools lists the tools; Claude Code gives one command with the token in it", async () => {
    await go(ben, "/settings/tools");
    await ben.getByRole("button", { name: "Connect Claude Code" }).click();
    const sheet = ben.getByRole("dialog", { name: "Connect Claude Code" });
    await sheet.getByRole("button", { name: "Make token" }).click();
    const cmd = (await sheet.locator("pre").first().textContent({ timeout: 15000 })) ?? "";
    const m = /--header "Authorization: Bearer (forge_[A-Za-z0-9_-]+)"/.exec(cmd);
    if (!m || !cmd.startsWith("claude mcp add --transport http brazework ") || !cmd.includes("/api/mcp")) throw new Error(`unexpected command: ${cmd.slice(0, 120)}`);
    token = m[1];
    await sheet.getByText(/Waiting for Claude Code/).waitFor({ timeout: 5000 });
  }, ben);

  await step("with that token, the MCP server answers: reads are read-only, it can leave drafts but never post, and Ben's profile comes back", async () => {
    const list = await (await mcp("tools/list", {})).json();
    const names = (list.result?.tools ?? []).map((t) => t.name);
    const writes = list.result.tools.filter((t) => t.annotations?.readOnlyHint !== true);
    // New tokens draft by default (supabase/mcp-workflows.sql): drafts wait for Ben's tap in Brazework.
    // Writes are drafts only: posts, milestones, and the actions shared with Ember (create_project, …), never posting.
    const w = writes.map((t) => t.name);
    if (!names.includes("me") || !["draft_milestone", "draft_post", "create_project", "add_teammate"].every((n) => w.includes(n)) || ["post_update", "log_milestone", "request_signature"].some((n) => w.includes(n)) || writes.some((t) => t.annotations?.destructiveHint !== false)) throw new Error(`tools: ${JSON.stringify(names)}`);
    const init = await (await mcp("initialize", { protocolVersion: "2025-06-18" })).json();
    if (init.result?.serverInfo?.name !== "brazework") throw new Error(`server name ${init.result?.serverInfo?.name}`);
    const me = await (await mcp("tools/call", { name: "me", arguments: {} })).json();
    if (!JSON.stringify(me.result?.structuredContent ?? {}).includes("Ben")) throw new Error(`me: ${JSON.stringify(me).slice(0, 160)}`);
  }, ben);

  await step("the page notices the first call and says Claude Code is connected", async () => {
    const sheet = ben.getByRole("dialog", { name: "Connect Claude Code" });
    await sheet.getByText("Claude Code is connected").waitFor({ timeout: 20000 });
    await ben.keyboard.press("Escape");
    await ben.getByRole("button", { name: "Connect Claude Code" }).getByText("Connected").waitFor({ timeout: 10000 });
  }, ben);

  await step("Cursor's and VS Code's one-tap links carry the server and the token", async () => {
    for (const [tool, prefix, read] of [
      ["Cursor", "cursor://anysphere.cursor-deeplink/mcp/install?name=brazework&config=", (h) => JSON.parse(Buffer.from(decodeURIComponent(new URL(h).searchParams.get("config")), "base64").toString())],
      ["VS Code", "vscode:mcp/install?", (h) => JSON.parse(decodeURIComponent(h.slice("vscode:mcp/install?".length)))],
    ]) {
      await ben.getByRole("button", { name: `Connect ${tool}` }).click();
      const sheet = ben.getByRole("dialog", { name: `Connect ${tool}` });
      await sheet.getByRole("button", { name: "Make token" }).click();
      const href = await sheet.getByRole("link", { name: new RegExp(`Add to ${tool}`) }).getAttribute("href", { timeout: 15000 });
      if (tool === "Cursor") readOnly = /Bearer (forge_[A-Za-z0-9_-]+)/.exec(decodeURIComponent(href ?? ""))?.[1] ?? /Bearer (forge_[A-Za-z0-9_-]+)/.exec(Buffer.from(decodeURIComponent(new URL(href).searchParams.get("config")), "base64").toString())?.[1] ?? "";
      if (!href?.startsWith(prefix)) throw new Error(`${tool} link: ${href?.slice(0, 80)}`);
      const cfg = read(href);
      if (!cfg.url?.endsWith("/api/mcp") || !/^Bearer forge_/.test(cfg.headers?.Authorization ?? "")) throw new Error(`${tool} config: ${JSON.stringify(cfg).slice(0, 120)}`);
      await ben.keyboard.press("Escape");
    }
  }, ben);

  await step("revoking the token stops it at once", async () => {
    ben.once("dialog", (d) => d.accept());
    const row = ben.getByRole("region", { name: "Your tokens" }).locator("li").filter({ hasText: "Claude Code" }).first();
    await row.getByRole("button", { name: "Revoke" }).click();
    await row.waitFor({ state: "detached", timeout: 10000 });
    const r = await mcp("tools/list", {});
    if (r.status !== 401) throw new Error(`revoked token answered ${r.status}`);
  }, ben);

  await step("phase 2: Codex, allowed to post, posts a build update as Ben; it shows 'via Codex'; read-only tokens can't", async () => {
    await ben.getByRole("button", { name: "Connect Codex" }).click();
    const sheet = ben.getByRole("dialog", { name: "Connect Codex" });
    await sheet.getByRole("switch", { name: "Codex can post updates for me" }).click();
    await sheet.getByRole("button", { name: "Make token" }).click();
    const cmd = (await sheet.locator("pre").first().textContent({ timeout: 15000 })) ?? "";
    const codex = /export BRAZEWORK_TOKEN=(forge_[A-Za-z0-9_-]+)/.exec(cmd)?.[1];
    if (!codex) throw new Error(`no token in: ${cmd.slice(0, 80)}`);
    await ben.keyboard.press("Escape");
    // A read-only token (Cursor, made above) isn't offered post_update; Codex's is.
    const cursorTools = await (await mcp("tools/list", {}, readOnly)).json();
    if (cursorTools.result.tools.some((t) => t.name === "post_update")) throw new Error("a read-only token was offered post_update");
    const tools = (await (await mcp("tools/list", {}, codex)).json()).result.tools;
    const post = tools.find((t) => t.name === "post_update");
    if (!post || post.annotations?.readOnlyHint !== false || post.annotations?.destructiveHint !== false) throw new Error(`post_update: ${JSON.stringify(post?.annotations)}`);
    const text = `Bench test: the new gimbal mount held 1.4 kN. ${Date.now() % 100000}`;
    const r = await (await mcp("tools/call", { name: "post_update", arguments: { body: text, kind: "result", project_id: "p1" } }, codex)).json();
    if (r.result?.isError || !String(r.result?.structuredContent?.url ?? "").includes("/post/")) throw new Error(`post_update: ${JSON.stringify(r).slice(0, 200)}`);
    const denied = await (await mcp("tools/call", { name: "post_update", arguments: { body: "From a read-only token" } }, readOnly)).json();
    // Cursor's token can't post; it can leave a draft instead, and the refusal says so.
    if (!denied.result?.isError || !/can't post for you\. Leave it as a draft/.test(denied.result.content[0].text)) throw new Error("a token that can't post wasn't refused clearly");
    await go(ben, "/feed?tab=latest");
    const card = ben.locator("article").filter({ hasText: text }).first();
    await card.waitFor({ timeout: 15000 });
    await card.getByText("via Codex").waitFor();
  }, ben);

  await step("phase 2: turning posting off for Codex stops it at once", async () => {
    await go(ben, "/settings/tools");
    const row = ben.getByRole("region", { name: "Your tokens" }).locator("li").filter({ hasText: "Codex" }).first();
    const sw = row.getByRole("switch");
    if ((await sw.getAttribute("aria-checked")) !== "true") throw new Error("Codex's switch should show it can post");
    await sw.click();
    await ben.waitForFunction(() => [...document.querySelectorAll('[role="switch"]')].some((x) => x.getAttribute("aria-label")?.startsWith("Codex") && x.getAttribute("aria-checked") === "false"), null, { timeout: 10000 });
  }, ben);

  await step("FIX-80: Claude Code logs a milestone with a commit for Rocketry Club; Maya (an officer) sees it 'via Claude Code' with the commit, and verifies it", async () => {
    await go(ben, "/settings/tools");
    await ben.getByRole("button", { name: "Connect Claude Code" }).click();
    const sheet = ben.getByRole("dialog", { name: "Connect Claude Code" });
    await sheet.getByRole("switch", { name: "Claude Code can post updates for me" }).click();
    await sheet.getByRole("button", { name: "Make token" }).click();
    cc = /Bearer (forge_[A-Za-z0-9_-]+)/.exec((await sheet.locator("pre").first().textContent({ timeout: 15000 })) ?? "")?.[1];
    if (!cc) throw new Error("no token");
    await ben.keyboard.press("Escape");
    const title = `Gimbal mount held 1.4 kN ${Date.now() % 100000}`;
    const r = await (await mcp("tools/call", { name: "log_milestone", arguments: { project_id: "p1", club_id: "rkt", title, detail: "Static load test, three runs, no yield.", evidence: ["https://github.com/acme/rig/commit/abc1234def", "https://youtu.be/loadtest"] } }, cc)).json();
    if (r.result?.isError || r.result?.structuredContent?.status !== "pending") throw new Error(`log_milestone: ${JSON.stringify(r).slice(0, 200)}`);
    // Every write says what happens next and where to see it (lib/mcp-results.ts).
    if (!/^Sent to Rocketry Club/.test(r.result.structuredContent.next ?? "") || !/^http.*\/projects\/p1$/.test(r.result.structuredContent.open ?? "")) throw new Error(`log_milestone's next step: ${JSON.stringify(r.result.structuredContent).slice(0, 240)}`);
    const noEvidence = await (await mcp("tools/call", { name: "log_milestone", arguments: { project_id: "p1", club_id: "rkt", title: "No proof", evidence: ["http://insecure.example"] } }, cc)).json();
    if (!noEvidence.result?.isError || !/evidence/.test(noEvidence.result.content[0].text)) throw new Error("a milestone without https evidence wasn't refused clearly");
    const maya = await as(b, "maya@forge.test");
    await go(maya, "/c/rkt/manage?tab=verify");
    const card = maya.locator("article").filter({ hasText: title }).first();
    await card.waitFor({ timeout: 15000 });
    await card.getByText("via Claude Code").waitFor();
    await card.getByRole("link", { name: /Commit abc1234/ }).waitFor();
    await card.getByRole("link", { name: /youtu\.be/ }).waitFor();
    await card.getByRole("button", { name: /^Verify/ }).first().click();
    // The card leaves the queue for "Recently reviewed" once the page refreshes; the database says what happened.
    const status = () => require("child_process").execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -tA", { input: `select status || '|' || coalesce(via, '') from public.milestones where title = '${title}'` }).toString().trim();
    for (let i = 0; i < 30 && !status().startsWith("verified"); i++) await maya.waitForTimeout(500);
    if (status() !== "verified|Claude Code") throw new Error(`after Verify the milestone is ${status()}`);
    await maya.context().close();
  }, ben);

  // ---------- MCP workflows (docs/mcp-workflows.md, supabase/mcp-workflows.sql) ----------
  const psql = (sql) => require("child_process").execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -tA", { input: sql }).toString().trim();

  await step("the field playbooks: prompts (/shipped adapts to the token), resources for all 20 fields", async () => {
    const init = await (await mcp("initialize", { protocolVersion: "2025-06-18" }, cc)).json();
    if (!init.result?.capabilities?.prompts || !init.result?.capabilities?.resources) throw new Error(`capabilities: ${JSON.stringify(init.result?.capabilities)}`);
    const prompts = (await (await mcp("prompts/list", {}, cc)).json()).result?.prompts ?? [];
    if (prompts[0]?.name !== "start") throw new Error(`the first prompt should be start: ${prompts.map((p) => p.name).join()}`);
    const start = (await (await mcp("prompts/get", { name: "start", arguments: { field: "Aerospace" } }, cc)).json()).result?.messages?.[0]?.content?.text ?? "";
    if (!/last 30 days/.test(start) || !/brazework:\/\/playbooks\/aerospace/.test(start)) throw new Error(`/start: ${start.slice(0, 200)}`);
    if (["shipped", "result", "week", "ask_signature", "setup"].some((n) => !prompts.some((p) => p.name === n))) throw new Error(`prompts: ${prompts.map((p) => p.name)}`);
    const text = async (t) => (await (await mcp("prompts/get", { name: "shipped", arguments: { field: "Aerospace", what: "static fire" } }, t)).json()).result?.messages?.[0]?.content?.text ?? "";
    const posting = await text(cc), drafting = await text(readOnly);
    if (!/wait for my yes\. Then call log_milestone/.test(posting) || !/brazework:\/\/playbooks\/aerospace/.test(posting)) throw new Error(`a posting token's /shipped: ${posting.slice(0, 200)}`);
    if (!/Save it with draft_milestone/.test(drafting)) throw new Error(`a drafting token's /shipped: ${drafting.slice(0, 200)}`);
    const res = (await (await mcp("resources/list", {}, cc)).json()).result?.resources ?? [];
    if (res.filter((r) => r.mimeType === "text/markdown").length !== 21 || !res.some((r) => r.uri === "ui://brazework/milestone-card")) throw new Error(`${res.length} resources: ${res.map((r) => r.uri).slice(-3).join()}`);
    const md = (await (await mcp("resources/read", { uri: "brazework://playbooks/data-ai" }, cc)).json()).result?.contents?.[0]?.text ?? "";
    if (!md.startsWith("# Data & AI") || !md.includes("Weights & Biases")) throw new Error(`playbook: ${md.slice(0, 80)}`);
  }, ben);

  let gha = "", workflow = "";
  await step("GitHub Actions: a drafts-only token for a project, a repo secret and a workflow; no posting switch", async () => {
    await go(ben, "/settings/tools");
    await ben.getByRole("region", { name: "Recipes for your field" }).getByText("Moments worth recording").waitFor({ timeout: 15000 });
    // Playbook lanes (FIX-209): a student starts on Studying.
    const lanes = ben.getByRole("region", { name: "Recipes for your field" }).getByRole("group", { name: "Studying or working" });
    if ((await lanes.getByRole("button", { name: "Studying" }).getAttribute("aria-pressed", { timeout: 5000 })) !== "true") throw new Error("a student should start on Studying");
    await ben.getByRole("button", { name: "Connect GitHub Actions" }).click();
    const sheet = ben.getByRole("dialog", { name: "Connect GitHub Actions" });
    if (await sheet.getByRole("switch").count()) throw new Error("an automation was offered posting");
    await sheet.getByLabel("Project for drafts").selectOption("p1");
    await sheet.getByLabel("Club to verify").selectOption("rkt");
    await sheet.getByRole("button", { name: "Make token" }).click();
    const pres = sheet.locator("pre");
    await pres.nth(1).waitFor({ timeout: 15000 });
    gha = /--body "(forge_[A-Za-z0-9_-]+)"/.exec((await pres.nth(0).textContent()) ?? "")?.[1] ?? "";
    workflow = (await pres.nth(1).textContent()) ?? "";
    if (!gha || !workflow.includes('--arg project "p1"') || !workflow.includes('--arg club "rkt"') || workflow.includes(gha)) throw new Error(`secret or workflow wrong: ${workflow.slice(0, 120)}`);
    await ben.keyboard.press("Escape");
    const denied = await (await mcp("tools/call", { name: "post_update", arguments: { body: "Straight out" } }, gha)).json();
    if (!denied.result?.isError || !/draft/.test(denied.result.content[0].text)) throw new Error("the Actions token could post");
  }, ben);

  const prTitle = `Thrust logger "v2" $(touch /tmp/brazework-pwned) ${Date.now() % 100000}`;
  await step("the workflow's script, run as GitHub would on a merged PR, leaves one milestone draft (twice, still one); a hostile title stays text", async () => {
    const script = workflow.slice(workflow.indexOf("run: |") + 6).split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n").replace(/curl -sSf \S+/, `curl -sSf ${BASE}/api/mcp`);
    const env = { ...process.env, BRAZEWORK_TOKEN: gha, PR_TITLE: prTitle, PR_URL: "https://github.com/acme/rig/pull/12", PR_NUMBER: "12", REPO: "acme/rig" };
    for (let i = 0; i < 2; i++) {
      const out = require("child_process").execFileSync("bash", ["-euo", "pipefail", "-c", script], { env }).toString();
      if (!/"status":\s*"waiting"/.test(out)) throw new Error(`run ${i + 1}: ${out.slice(0, 200)}`);
    }
    if (require("fs").existsSync("/tmp/brazework-pwned")) throw new Error("the PR title ran as code");
    const rows = psql(`select count(*) || '|' || max(via) || '|' || max(payload->>'title') from public.tool_drafts where source_key = 'github:acme/rig#12'`);
    if (rows !== `1|GitHub Actions|Merged: ${prTitle}`) throw new Error(`drafts: ${rows}`);
  }, ben);

  await step("Home says a draft is waiting; Ben edits it on /drafts and sends it to Rocketry Club; Maya sees it via GitHub Actions", async () => {
    await go(ben, "/feed");
    // Today's triage (daily-triage.sql) lists it; editing happens on /drafts, through the card's Edit link.
    const today = ben.getByRole("region", { name: "Your tools noticed 1 thing" });
    await today.getByText("acme/rig #12 merged").waitFor({ timeout: 15000 });
    await today.getByRole("link", { name: "Edit" }).click();
    await ben.waitForURL(/\/drafts/);
    const card = ben.locator("article").filter({ hasText: "via GitHub Actions" }).first();
    await card.getByText("acme/rig #12 merged").waitFor({ timeout: 15000 });
    const title = `Thrust logger v2 merged, CI green ${Date.now() % 100000}`;
    await card.getByLabel("Title").fill(title);
    await card.getByRole("button", { name: "Send to club" }).click();
    await ben.getByRole("status").filter({ hasText: /officers have been asked/ }).waitFor({ timeout: 15000 });
    if (psql(`select status || '|' || via || '|' || community_id from public.milestones where title = '${title}'`) !== "pending|GitHub Actions|rkt") throw new Error("the milestone wasn't sent to the club");
    const maya = await as(b, "maya@forge.test");
    await go(maya, "/c/rkt/manage?tab=verify");
    const review = maya.locator("article").filter({ hasText: title }).first();
    await review.waitFor({ timeout: 15000 });
    await review.getByText("via GitHub Actions").waitFor();
    await maya.context().close();
    await go(ben, "/drafts");
    await ben.getByText("No drafts waiting").waitFor({ timeout: 10000 });
  }, ben);

  await step("signatures from chat: log_milestone with no club waits for one; request_signature refuses a drafts-only token, and says so when email is off", async () => {
    const r = await (await mcp("tools/call", { name: "log_milestone", arguments: { project_id: "p1", title: `Load cell calibrated to ±0.3% ${Date.now() % 100000}`, evidence: ["https://example.com/cal-report"] } }, cc)).json();
    const id = r.result?.structuredContent?.id;
    if (r.result?.isError || r.result?.structuredContent?.status !== "draft") throw new Error(`log_milestone without a club: ${JSON.stringify(r).slice(0, 200)}`);
    if (!String(r.result.structuredContent.next ?? "").includes(`request_signature with milestone_id "${id}"`)) throw new Error(`no-club next step: ${r.result.structuredContent.next}`);
    const projects = (await (await mcp("tools/call", { name: "my_projects", arguments: {} }, cc)).json()).result?.structuredContent?.items ?? [];
    if (!projects.some((p) => (p.open_milestones ?? []).some((m) => m.id === id))) throw new Error("my_projects doesn't list it as open");
    const ask = { name: "request_signature", arguments: { milestone_id: id, email: "prof.lee@utexas.edu", relationship: "professor" } };
    const drafty = await (await mcp("tools/call", ask, gha)).json();
    if (!drafty.result?.isError || !/can't post/.test(drafty.result.content[0].text)) throw new Error("a drafts-only token could ask for a signature");
    // Email is off in this test build: the ask is refused before anything is recorded.
    const off = await (await mcp("tools/call", ask, cc)).json();
    if (!off.result?.isError || !/email isn't available/.test(off.result.content[0].text)) throw new Error(`with email off: ${JSON.stringify(off).slice(0, 200)}`);
    if (psql(`select count(*) from public.milestone_vouches where milestone_id = '${id}'`) !== "0") throw new Error("an ask was left waiting");
  }, ben);

  // ---------- Intents shared with Ember (supabase/tool-actions.sql, lib/tool-actions.ts) ----------
  const call = async (name, args, t) => (await (await mcp("tools/call", { name, arguments: args }, t)).json()).result;
  const stamp = Date.now() % 100000;
  await step("intents: a drafting token's new project and teammate wait on /drafts as Ember's cards; Ben confirms one and dismisses the other", async () => {
    const proj = await call("create_project", { title: `Hopper drone ${stamp}`, summary: "A tethered hopper to test the engine gimbal.", tags: ["Aerospace", "Not a topic"], link: "https://github.com/ben/hopper" }, readOnly);
    if (proj?.isError || proj.structuredContent?.drafted !== true || !/\/drafts$/.test(proj.structuredContent.open ?? "") || !/as a card/.test(proj.structuredContent.next ?? "")) throw new Error(`create_project as a draft: ${JSON.stringify(proj).slice(0, 240)}`);
    const mate = await call("add_teammate", { project_id: "p1", person_id: process.env.JOSH_ID }, readOnly);
    if (mate?.isError || mate.structuredContent?.drafted !== true) throw new Error(`add_teammate as a draft: ${JSON.stringify(mate).slice(0, 240)}`);
    if (psql(`select count(*) from public.projects where title = 'Hopper drone ${stamp}'`) !== "0") throw new Error("a draft made the project before Ben said yes");
    await go(ben, "/drafts");
    const card = ben.getByRole("group", { name: "Add a project from Cursor" });
    await card.getByLabel("Project title").waitFor({ timeout: 15000 });
    if ((await card.getByLabel("Project title").inputValue()) !== `Hopper drone ${stamp}`) throw new Error("the card doesn't show the drafted title");
    await card.getByRole("button", { name: "Confirm" }).click();
    await card.getByText("Added to your profile").waitFor({ timeout: 15000 });
    if (psql(`select owner_id || '|' || array_to_string(tags, ',') from public.projects where title = 'Hopper drone ${stamp}'`) !== `${process.env.BEN_ID}|Aerospace`) throw new Error("the confirmed project isn't Ben's, with the app's topics only");
    const team = ben.getByRole("group", { name: "Add a teammate from Cursor" });
    await team.getByText("Josh Menzies").waitFor();
    await team.getByRole("button", { name: "Dismiss" }).click();
    await ben.getByText("Dismissed. Nothing was saved.").waitFor({ timeout: 10000 });
    const settled = psql(`select (select status from public.tool_drafts where kind = 'project' and payload->>'title' = 'Hopper drone ${stamp}') || '|' || (select string_agg(status, ',') from public.tool_drafts where kind = 'teammate' and user_id = '${process.env.BEN_ID}')`);
    if (settled !== "posted|dismissed") throw new Error(`the drafts weren't settled: ${settled}`);
    if (psql(`select count(*) from public.project_members where project_id = 'p1' and uid = '${process.env.JOSH_ID}'`) !== "0") throw new Error("a dismissed teammate was added");
  }, ben);

  await step("intents: with Ben's yes, Claude Code adds a project, updates its summary and specs, and adds Josh from his club; Cara (no shared club) is refused with how to fix it", async () => {
    const made = (await call("create_project", { title: `Thrust stand v2 ${stamp}`, summary: "Load cell, 2 kN.", status: "completed", year: "2026" }, cc)).structuredContent;
    if (made?.drafted !== false || !/\/projects\//.test(made.open ?? "") || !/log_milestone with project_id/.test(made.next ?? "")) throw new Error(`create_project: ${JSON.stringify(made).slice(0, 240)}`);
    const edit = (await call("update_project", { project_id: made.id, summary: "Load cell, 2 kN, 1 kHz logging.", specs: [{ label: "Range", value: "2 kN" }] }, cc)).structuredContent;
    if (!/Saved \(summary, specs\)/.test(edit?.next ?? "")) throw new Error(`update_project: ${JSON.stringify(edit).slice(0, 240)}`);
    const josh = (await call("add_teammate", { project_id: made.id, person_id: process.env.JOSH_ID }, cc)).structuredContent;
    if (!/Josh Menzies is on/.test(josh?.next ?? "")) throw new Error(`add_teammate: ${JSON.stringify(josh).slice(0, 240)}`);
    if (psql(`select p.summary || '|' || d.specs::text || '|' || (select role from public.project_members where project_id = p.id and uid = '${process.env.JOSH_ID}') from public.projects p join public.project_details d on d.project_id = p.id where p.id = '${made.id}'`) !== `Load cell, 2 kN, 1 kHz logging.|[{"label": "Range", "value": "2 kN"}]|member`) throw new Error("the project wasn't saved as asked");
    const caraId = psql(`select id from auth.users where email = 'cara@forge.test'`);
    const no = await call("add_teammate", { project_id: made.id, person_id: caraId }, cc);
    if (!no?.isError || !/aren't in any of your clubs/.test(no.content[0].text) || !/search/.test(no.content[0].text)) throw new Error(`a stranger was added, or the refusal doesn't say how to fix it: ${JSON.stringify(no).slice(0, 200)}`);
    // Leave Ben's projects as the later journeys expect them (u-build reads "Your projects").
    psql(`delete from public.projects where title in ('Hopper drone ${stamp}', 'Thrust stand v2 ${stamp}')`);
  }, ben);

  await step("intents: Ben asks for a spot at Rocketry Club's build night; the draft waits as Ember's RSVP card, he confirms, then Claude Code gives the spot back", async () => {
    const ev = `mcp-ev-${stamp}`;
    psql(`insert into public.events (id, community_id, title, type, format, topic, location, starts_at, ends_at) values ('${ev}', 'rkt', 'Build night ${stamp}', 'Workshop', 'In person', 'Aerospace', 'Hangar 2', now() + interval '2 days', now() + interval '2 days 2 hours')`);
    const listed = (await call("upcoming_events", { days: 7 }, readOnly)).structuredContent?.items ?? [];
    if (!listed.some((e) => e.id === ev)) throw new Error("upcoming_events doesn't list the build night");
    const d = (await call("rsvp_event", { event_id: ev }, readOnly)).structuredContent;
    if (d?.drafted !== true) throw new Error(`rsvp_event as a draft: ${JSON.stringify(d).slice(0, 200)}`);
    await go(ben, "/drafts");
    const card = ben.getByRole("group", { name: "RSVP to an event from Cursor" });
    await card.getByText(`Build night ${stamp}`).waitFor({ timeout: 15000 });
    await card.getByRole("button", { name: "Confirm" }).click();
    await card.getByText("You're going").waitFor({ timeout: 15000 });
    if (psql(`select count(*) from public.event_rsvps where event_id = '${ev}' and user_id = '${process.env.BEN_ID}'`) !== "1") throw new Error("Ben isn't going after confirming");
    const back = (await call("rsvp_event", { event_id: ev, going: false }, cc)).structuredContent;
    if (back?.status !== "not going" || !/given back/.test(back.next ?? "") || !back.open?.endsWith(`/events/${ev}`)) throw new Error(`taking the RSVP back: ${JSON.stringify(back).slice(0, 200)}`);
    const twice = await call("rsvp_event", { event_id: ev, going: false }, cc);
    if (!twice?.isError || !/nothing to cancel/.test(twice.content[0].text)) throw new Error("a second take-back wasn't refused clearly");
    if (psql(`select rsvp_count from public.events where id = '${ev}'`) !== "0") throw new Error("the count didn't go back down");
    psql(`delete from public.events where id = '${ev}'`); // leave Rocketry's calendar as later journeys expect it
  }, ben);

  await step("intents: Ben's assistant reads Josh's message and drafts a reply; it waits as Ember's message card and goes only when Ben confirms. Claude Code joins a club and accepts an invite", async () => {
    const conv = psql(`begin; select set_config('request.jwt.claim.sub', '${process.env.JOSH_ID}', true) is not null; select public.start_conversation('${process.env.BEN_ID}'); commit;`).split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l))[0];
    psql(`insert into public.messages (conversation_id, sender_id, body) values ('${conv}', '${process.env.JOSH_ID}', 'Can you look at my thrust curve before Friday? ${stamp}')`);
    const inbox = (await call("my_inbox", {}, readOnly)).structuredContent?.items ?? [];
    const row = inbox.find((c) => c.conversation_id === conv);
    // A request if they've never talked; an ordinary conversation if an earlier journey connected them.
    if (!row || !["request to you", "conversation"].includes(row.kind) || !row.unread || row.last_from !== "them" || !row.url?.startsWith("http")) throw new Error(`my_inbox: ${JSON.stringify(inbox).slice(0, 240)}`);
    const thread = (await call("my_inbox", { conversation_id: conv }, readOnly)).structuredContent;
    if (thread?.messages?.[0]?.from !== "them") throw new Error(`the conversation: ${JSON.stringify(thread).slice(0, 200)}`);
    const before = psql(`select count(*) from public.messages where conversation_id = '${conv}'`); // an earlier journey may have talked here already
    const reply = (await call("draft_reply", { conversation_id: conv, body: `Sure, send it over. ${stamp}` }, cc)).structuredContent;
    if (reply?.drafted !== true || !/press Confirm to send it/.test(reply.next ?? "")) throw new Error(`draft_reply (even with a token that posts) must be a draft: ${JSON.stringify(reply).slice(0, 200)}`);
    if (psql(`select count(*) from public.messages where conversation_id = '${conv}'`) !== before) throw new Error("a reply was sent before Ben confirmed");
    await go(ben, "/drafts");
    const card = ben.getByRole("group", { name: "Send a message from Claude Code" });
    await card.getByText("Josh Menzies").waitFor({ timeout: 15000 });
    await card.getByRole("button", { name: "Confirm" }).click();
    await card.getByText("Sent", { exact: true }).waitFor({ timeout: 15000 });
    if (psql(`select sender_id from public.messages where conversation_id = '${conv}' and body = 'Sure, send it over. ${stamp}'`) !== process.env.BEN_ID) throw new Error("Ben's confirmed reply wasn't sent as Ben");
    const club = `mcp-club-${stamp}`, closed = `mcp-closed-${stamp}`, code = `${stamp}`.padStart(16, "a").slice(-16).replace(/[^0-9a-f]/g, "a");
    psql(`insert into public.communities (id, name, type, privacy) values ('${club}', 'Hopper Lab ${stamp}', 'project', 'public'), ('${closed}', 'Closed Lab ${stamp}', 'project', 'approval');
          insert into public.community_members (community_id, uid, role) values ('${club}', '${process.env.JOSH_ID}', 'owner'), ('${closed}', '${process.env.JOSH_ID}', 'owner');
          insert into public.community_invites (code, community_id, created_by) values ('${code}', '${closed}', '${process.env.JOSH_ID}');`);
    const joined = (await call("join_club", { club_id: club }, cc)).structuredContent;
    if (joined?.status !== "joined" || !/The member is in Hopper Lab/.test(joined.next ?? "")) throw new Error(`join_club: ${JSON.stringify(joined).slice(0, 200)}`);
    const asked = (await call("join_club", { club_id: closed }, cc)).structuredContent;
    if (asked?.status !== "requested") throw new Error(`asking to join a club that approves members: ${JSON.stringify(asked).slice(0, 200)}`);
    psql(`delete from public.community_requests where community_id = '${closed}'`);
    const inv = (await call("accept_invite", { invite: `${BASE}/join/${code}` }, cc)).structuredContent;
    if (inv?.status !== "joined") throw new Error(`accept_invite: ${JSON.stringify(inv).slice(0, 200)}`);
    if (psql(`select count(*) from public.community_members where uid = '${process.env.BEN_ID}' and community_id in ('${club}', '${closed}')`) !== "2") throw new Error("Ben isn't in both clubs");
    psql(`delete from public.communities where id in ('${club}', '${closed}')`); // Ben's clubs as later journeys expect them
  }, ben);

  await step("officers: Ben (Rocketry's owner) reads Ember's weekly brief over MCP, drafts an announcement and an event; both wait as Ember's cards and go out only when he confirms", async () => {
    const brief = (await call("club_brief", { club_id: "rkt" }, cc)).structuredContent;
    if (brief?.club !== "Rocketry Club" || typeof brief.posts?.this_week !== "number" || !brief.can_host_events || !/manage\?tab=verify$/.test(brief.milestones?.review_in_brazework ?? "")) throw new Error(`club_brief: ${JSON.stringify(brief).slice(0, 240)}`);
    const body = `This week at Rocketry: ${brief.members} members, ${brief.posts.this_week} posts. Build night Thursday! ${stamp}`;
    const ann = (await call("draft_announcement", { club_id: "rkt", body }, cc)).structuredContent;
    if (ann?.drafted !== true || !/publish it to the club/.test(ann.next ?? "")) throw new Error(`draft_announcement must be a draft, even with a token that posts: ${JSON.stringify(ann).slice(0, 200)}`);
    const starts = new Date(Date.now() + 5 * 864e5).toISOString();
    const ev = (await call("draft_event", { club_id: "rkt", title: `Static fire night ${stamp}`, type: "Workshop", format: "In person", location: "Test range", starts_at: starts }, cc)).structuredContent;
    if (ev?.drafted !== true) throw new Error(`draft_event: ${JSON.stringify(ev).slice(0, 200)}`);
    if (psql(`select (select count(*) from public.posts where body = '${body}') + (select count(*) from public.events where title = 'Static fire night ${stamp}')`) !== "0") throw new Error("something went out before Ben confirmed");
    await go(ben, "/drafts");
    const post = ben.getByRole("group", { name: "Post in your club from Claude Code" });
    await post.getByLabel("Club post text").waitFor({ timeout: 15000 });
    await post.getByRole("button", { name: "Confirm" }).click();
    await post.getByText(/^(Posted|Sent for review)$/).waitFor({ timeout: 15000 });
    const event = ben.getByRole("group", { name: "Host a club event from Claude Code" });
    await event.getByLabel("Event title").waitFor({ timeout: 15000 });
    // Rocketry's own topic isn't one of the app's, so the card asks for one (as the event form does).
    if ((await event.getByLabel("Topic").inputValue()) === "") await event.getByLabel("Topic").selectOption("Aerospace");
    await event.getByRole("button", { name: "Confirm" }).click();
    await event.getByText("Published").waitFor({ timeout: 15000 });
    if (psql(`select (select community_id from public.posts where body = '${body}') || '|' || (select community_id || ':' || status from public.events where title = 'Static fire night ${stamp}')`) !== "rkt|rkt:published") throw new Error("the confirmed announcement and event aren't in Rocketry Club");
    const prompts = (await (await mcp("prompts/list", {}, cc)).json()).result?.prompts ?? [];
    if (!prompts.some((p) => p.name === "club_week")) throw new Error("no club_week prompt");
    psql(`delete from public.posts where body = '${body}'; delete from public.events where title = 'Static fire night ${stamp}'`); // Rocketry as later journeys expect it
  }, ben);

  await step("career: Ben's résumé lists his signed work with links; /career_fair chains the tools; Acme (a verified company) finds Ben by signed work in Claude as on /talent; Ben's members can't search", async () => {
    const cv = (await call("my_resume", {}, cc)).structuredContent;
    const lines = (cv?.projects ?? []).flatMap((p) => p.signed ?? []);
    if (!lines.length || !lines.every((l) => l.signed_by && /^http/.test(l.link ?? ""))) throw new Error(`my_resume: ${JSON.stringify(cv).slice(0, 240)}`);
    const fair = (await (await mcp("prompts/get", { name: "career_fair", arguments: { event: "Spring Career Fair" } }, cc)).json()).result?.messages?.[0]?.content?.text ?? "";
    if (!/request_signature/.test(fair) || !/rsvp_event/.test(fair) || !/my_resume/.test(fair)) throw new Error(`career_fair: ${fair.slice(0, 200)}`);
    // Cara administers Acme Aerospace, a verified company (e2e/seed.sql); her assistant has a token.
    const caraToken = `forge_cara${"x".repeat(30)}${stamp}`;
    psql(`insert into public.api_tokens (user_id, name, token_hash, prefix, scopes) select id, 'Claude Code', encode(sha256('${caraToken}'::bytea), 'hex'), 'forge_cara', '{read}' from auth.users where email = 'cara@forge.test'`);
    const found = (await call("find_builders", { query: "static fire" }, caraToken)).structuredContent;
    if (found?.company !== "Acme Aerospace" || found.builders?.[0]?.name !== "Ben Cho" || !/\/u\//.test(found.builders[0].url ?? "") || found.builders[0].work?.[0]?.level !== "signed") throw new Error(`find_builders: ${JSON.stringify(found).slice(0, 300)}`);
    // /talent shows Cara the same first result for the same search.
    const cara = await as(b, "cara@forge.test");
    await go(cara, "/talent?q=static+fire");
    const first = (await cara.locator("main article").first().textContent({ timeout: 15000 })) ?? "";
    if (!first.includes("Ben Cho")) throw new Error(`/talent's first result isn't Ben: ${first.slice(0, 80)}`);
    await cara.context().close();
    const no = await call("find_builders", { query: "static fire" }, cc);
    if (!no?.isError || !/verified company or school/.test(no.content[0].text)) throw new Error("someone who isn't a company admin could search");
    const f = (await call("follow_person", { person_id: psql("select id from auth.users where email = 'cara@forge.test'") }, cc)).structuredContent;
    if (f?.status !== "following" || !/follows Cara/.test(f.next ?? "")) throw new Error(`follow_person: ${JSON.stringify(f).slice(0, 200)}`);
    psql(`delete from public.follows where follower = '${process.env.BEN_ID}' and target in (select id from auth.users where email = 'cara@forge.test'); update public.api_tokens set revoked_at = now() where prefix = 'forge_cara'`);
  }, ben);

  await step("goals: Ben sets a quiet goal from chat (visibility must be his choice), my_goal shows his progress and ranks his work by it, and /week drafts toward it", async () => {
    const asked = await call("set_goal", { kind: "internship", target: "liquid rocket engines" }, cc);
    if (!asked?.isError || !/whether companies should see/.test(asked.content[0].text)) throw new Error("set_goal assumed whether companies see the goal");
    const set = (await call("set_goal", { kind: "internship", target: "liquid rocket engines", visible: false }, cc)).structuredContent;
    if (set?.status !== "set" || !/kept private/.test(set.next ?? "")) throw new Error(`set_goal: ${JSON.stringify(set).slice(0, 200)}`);
    const draftOnly = await call("set_goal", { kind: "job", visible: true }, readOnly);
    if (!draftOnly?.isError) throw new Error("a drafting token set a goal");
    const g = (await call("my_goal", {}, cc)).structuredContent;
    if (!/signed toward a summer internship in liquid rocket engines$/.test(g?.progress ?? "") || !g.next || !Array.isArray(g.path) || g.visible_to_companies !== false) throw new Error(`my_goal: ${JSON.stringify(g).slice(0, 300)}`);
    if (!(g.strongest?.[0]?.relevance > 0) || !/engine/i.test(g.strongest[0].project)) throw new Error(`the engine work should rank first: ${JSON.stringify(g.strongest?.slice(0, 2))}`);
    const week = (await (await mcp("prompts/get", { name: "week", arguments: {} }, cc)).json()).result?.messages?.[0]?.content?.text ?? "";
    if (!/call my_goal/.test(week) || !/Toward your goal: …/.test(week)) throw new Error(`/week isn't goal-aware: ${week.slice(0, 200)}`);
    if (psql(`select visible::text from public.member_goals where uid = '${process.env.BEN_ID}' and status = 'active'`) !== "false") throw new Error("the goal isn't quiet");
    const dropped = (await call("drop_goal", {}, cc)).structuredContent;
    if (dropped?.status !== "dropped") throw new Error(`drop_goal: ${JSON.stringify(dropped).slice(0, 200)}`);
  }, ben);

  await step("FIX-92: a club's Integrations tab shows how work comes in (GitHub, members' AI tools), and no Discord", async () => {
    await go(ben, "/c/rkt/manage?tab=integrations"); // Ben owns Rocketry Club
    const main = ben.locator("main");
    await main.getByRole("heading", { name: "Members' AI tools" }).waitFor({ timeout: 15000 });
    if ((await main.getByRole("link", { name: /How members connect/ }).getAttribute("href")) !== "/settings/tools") throw new Error("the AI tools card doesn't link to setup");
    if (await main.getByText(/Discord/).count()) throw new Error("Discord is still on the Integrations tab");
  }, ben);

  summary();
  await b.close();
})();
