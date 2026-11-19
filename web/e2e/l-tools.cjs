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
    if (!names.includes("me") || writes.map((t) => t.name).sort().join() !== "draft_milestone,draft_post" || writes.some((t) => t.annotations?.destructiveHint !== false)) throw new Error(`tools: ${JSON.stringify(names)}`);
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

  await step("Today says a draft is waiting; Ben edits it on /drafts and sends it to Rocketry Club; Maya sees it via GitHub Actions", async () => {
    await go(ben, "/feed");
    await ben.getByRole("region", { name: "Waiting on you" }).getByRole("link", { name: /1 draft from your tools/ }).click();
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
