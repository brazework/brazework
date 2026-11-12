// Your tools (Linear FIX-78): connect an AI coding tool end to end. Ben opens Settings → Your tools,
// picks Claude Code, makes a token, and gets the exact command with it filled in. Then, as Claude
// Code would, the token calls Brazework's MCP server: it lists the tools and reads Ben's profile.
// The page sees that first call and says Claude Code is connected. Cursor's and VS Code's one-tap
// links carry the right config, and a revoked token stops working at once.
const { step, browser, as, go, summary, BASE } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const ben = await as(b, "ben@forge.test", { width: 390, height: 844 });
  let token = "", readOnly = "";
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

  await step("with that token, the MCP server answers: tools are listed (all read-only) and Ben's profile comes back", async () => {
    const list = await (await mcp("tools/list", {})).json();
    const names = (list.result?.tools ?? []).map((t) => t.name);
    if (!names.includes("me") || !list.result.tools.every((t) => t.annotations?.readOnlyHint === true)) throw new Error(`tools: ${JSON.stringify(names)}`);
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
    if (!denied.result?.isError || !/only read/.test(denied.result.content[0].text)) throw new Error("a read-only token's post wasn't refused clearly");
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

  summary();
  await b.close();
})();
