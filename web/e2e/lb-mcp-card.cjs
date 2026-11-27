// The in-chat milestone card (lib/mcp-card.ts, MCP Apps). A host that supports MCP Apps (Claude,
// ChatGPT, VS Code…) renders the card in a sandboxed frame; this test plays that host, by the spec:
// it fetches the card over MCP, answers ui/initialize, sends the tool's input and its real result, and
// records ui/open-link. Then it reads what the card shows.
// 1. log_milestone and draft_milestone name the card; resources/read serves it as text/html;profile=mcp-app.
// 2. A real log_milestone result (no club) shows the title, its evidence, "Waiting for a signature",
//    the next step, and "Open in Brazework" asks the host to open the project.
// 3. A title with markup in it stays text.
const crypto = require("crypto"), { execSync } = require("child_process");
const { BASE, step, browser, summary } = require("./lib.cjs");
const psql = (sql) => execSync(`docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -tA`, { input: sql }).toString().trim();

(async () => {
  const b = await browser();
  // A token for Ben that can post, made the way Settings makes one (only its hash is stored).
  const token = `forge_card${crypto.randomBytes(16).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  psql(`insert into public.api_tokens (user_id, name, token_hash, prefix, scopes) select id, 'Claude', '${hash}', 'forge_card', array['read','draft','post'] from auth.users where email = 'ben@forge.test';`);
  const mcp = async (method, params) => (await fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();

  let html = "";
  await step("the milestone tools name the card, and the server serves it as an MCP App", async () => {
    const tools = (await mcp("tools/list", {})).result?.tools ?? [];
    for (const n of ["log_milestone", "draft_milestone"]) if (tools.find((t) => t.name === n)?._meta?.ui?.resourceUri !== "ui://brazework/milestone-card") throw new Error(`${n} doesn't name the card`);
    if (tools.find((t) => t.name === "me")?._meta) throw new Error("reads shouldn't name a card");
    const read = (await mcp("resources/read", { uri: "ui://brazework/milestone-card" })).result?.contents?.[0];
    if (read?.mimeType !== "text/html;profile=mcp-app" || !read.text?.startsWith("<!doctype html>")) throw new Error(`resource: ${JSON.stringify(read).slice(0, 160)}`);
    html = read.text;
  });

  // The host: an iframe with the card, answering the spec's messages. ("</" is escaped so the card's
  // own </script> can't end the host's script.)
  const js = (v) => JSON.stringify(v).replace(/<\//g, "<\\/");
  async function host(args, result) {
    const page = await (await b.newContext({ viewport: { width: 640, height: 600 } })).newPage();
    page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
    // Served from an address (not set on a blank page): Chrome 158 crashes when a blank page gives a
    // sandboxed frame its srcdoc, which closed the browser under this spec. A real host has an origin too.
    const hostPage = `<!doctype html><body style="margin:0"><iframe id="v" sandbox="allow-scripts" style="width:600px;height:420px;border:0"></iframe>
      <script>
        window.__log = []; window.__links = [];
        const f = document.getElementById("v");
        window.addEventListener("message", (e) => {
          if (e.source !== f.contentWindow) return;
          const m = e.data; window.__log.push(m.method || "response");
          const reply = (result) => f.contentWindow.postMessage({ jsonrpc: "2.0", id: m.id, result }, "*");
          if (m.method === "ui/initialize") reply({ protocolVersion: "2026-01-26", hostCapabilities: {}, hostInfo: { name: "test-host", version: "1" }, hostContext: { theme: "light", styles: { variables: { "--font-sans": "Georgia, serif" } } } });
          if (m.method === "ui/notifications/initialized") {
            f.contentWindow.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-input", params: { arguments: ${js(args)} } }, "*");
            f.contentWindow.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: ${js(result)} }, "*");
          }
          if (m.method === "ui/open-link") { window.__links.push(m.params.url); reply({}); }
        });
        f.srcdoc = ${js(html)};
      </script></body>`;
    await page.route("http://card-host.test/", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: hostPage }));
    await page.goto("http://card-host.test/");
    const view = page.frameLocator("#v");
    return { page, view };
  }

  await step("a real milestone with no club: title, proof, 'Waiting for a signature', the next step, and Open asks the host", async () => {
    const args = { project_id: "p1", title: `Thrust stand calibrated to ±0.4% ${Date.now() % 100000}`, detail: "Five loads, linear fit.", evidence: ["https://github.com/acme/rig/pull/14", "https://youtu.be/cal"] };
    const res = await mcp("tools/call", { name: "log_milestone", arguments: args });
    if (res.result?.isError) throw new Error(`log_milestone: ${JSON.stringify(res.result.content)}`);
    const { page, view } = await host(args, res.result);
    await view.getByRole("heading", { name: args.title }).waitFor({ timeout: 10000 });
    await view.getByText("Waiting for a signature", { exact: true }).waitFor();
    await view.getByText("github.com/acme/rig/pull/14").waitFor();
    await view.getByText(/request_signature with milestone_id/).waitFor();
    await view.getByRole("button", { name: "Open in Brazework" }).click();
    await page.waitForFunction(() => window.__links.length === 1, null, { timeout: 5000 });
    const link = await page.evaluate(() => window.__links[0]);
    if (!/\/projects\/p1$/.test(link)) throw new Error(`open-link: ${link}`);
    const log = await page.evaluate(() => window.__log);
    if (log[0] !== "ui/initialize" || !log.includes("ui/notifications/initialized")) throw new Error(`handshake: ${log.join()}`);
    if (page.errs.length) throw new Error(page.errs.join("; "));
  });

  await step("a title with markup in it shows as text, and nothing runs", async () => {
    const args = { title: `<img src=x onerror="parent.__pwned=1">Rig v2`, evidence: ["https://example.com/x"] };
    const { page, view } = await host(args, { content: [{ type: "text", text: "{}" }], structuredContent: { status: "waiting", duplicate: false, next: "Waiting in the member's Brazework drafts.", open: `${BASE}/drafts` } });
    await view.getByText("In your drafts").waitFor({ timeout: 10000 });
    await view.getByRole("heading", { name: /<img src=x/ }).waitFor();
    if (await page.evaluate(() => window.__pwned)) throw new Error("markup in a title ran");
  });

  psql(`delete from public.api_tokens where token_hash = '${hash}';`);
  summary();
  await b.close();
})();
