// /standup and the review packet.
// 1. /standup over MCP: the prompt is listed; its text tells the assistant to save a draft once a day
//    and never post. Saving it twice with the same source_key (as the assistant would) makes one draft,
//    which waits for Ben on /drafts; nothing is posted.
// 2. The review packet (a Plus preview, lib/plans.ts): Ben opens it from his profile; it lists his
//    signed work in the period with who signed it and their role, leaves private work out unless he
//    asks, narrows by date, and only he can open it.
const crypto = require("crypto"), { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const ben = psql("select id from auth.users where email = 'ben@forge.test'");
const token = `forge_${crypto.randomBytes(30).toString("base64url")}`;
const hash = crypto.createHash("sha256").update(token).digest("hex");
const mcp = (method, params) => fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then((r) => r.json());
const today = new Date().toISOString().slice(0, 10);
const body = `Done: thrust logger v2 merged, CI green. Next: static fire #5 prep. Blocked: nothing. (${Date.now()})`;

(async () => {
  const b = await browser();

  await step("/standup: listed, saves a draft once a day, never posts", async () => {
    psql(`insert into public.api_tokens (user_id, name, token_hash, prefix, scopes) values ('${ben}', 'Claude Code (standup e2e)', '${hash}', '${token.slice(0, 12)}', '{read,draft,post}');`);
    const list = await mcp("prompts/list", {});
    if (!list.result?.prompts?.some((p) => p.name === "standup")) throw new Error("standup isn't listed");
    const got = await mcp("prompts/get", { name: "standup", arguments: { field: "Software" } });
    const text = got.result?.messages?.[0]?.content?.text ?? "";
    if (!/draft_post/.test(text) || /post_update/.test(text) || !/standup:/.test(text)) throw new Error("prompt text: " + text.slice(0, 200));
    for (let i = 0; i < 2; i++) {
      const r = await mcp("tools/call", { name: "draft_post", arguments: { body, kind: "update", project_id: "p1", source: "Standup", source_key: `standup:${today}` } });
      if (r.error || r.result?.isError) throw new Error("draft_post: " + JSON.stringify(r).slice(0, 200));
    }
    if (psql(`select count(*) from public.tool_drafts where user_id = '${ben}' and source_key = 'standup:${today}'`) !== "1") throw new Error("running it twice made two drafts");
    if (psql(`select count(*) from public.posts where body = '${body}'`) !== "0") throw new Error("the standup was posted");
  });

  const page = await as(b, "ben@forge.test");
  await step("the standup waits for Ben on /drafts", async () => {
    await go(page, "/drafts");
    await page.getByText(body.slice(0, 40)).first().waitFor({ timeout: 15000 });
    psql(`update public.tool_drafts set status = 'dismissed' where user_id = '${ben}' and source_key = 'standup:${today}'; delete from public.api_tokens where token_hash = '${hash}';`);
  }, page);

  await step("the review packet: Ben's signed work in the period, who signed it and their role", async () => {
    await go(page, `/u/${ben}`);
    await page.getByRole("link", { name: "Review packet" }).click();
    await page.waitForURL(/\/review/);
    await page.getByRole("heading", { name: "Ben Cho" }).waitFor({ timeout: 15000 });
    await page.getByText("Plus preview: free while Plus is coming").waitFor();
    await page.getByRole("listitem", { name: "Static fire at 1.2 kN" }).getByText(/Verified by Maya Patel.* of Rocketry Club/).waitFor();
    await page.getByRole("listitem", { name: "Flight computer passed vibration test" }).waitFor();
    if (await page.getByRole("listitem", { name: "Private milestone" }).count()) throw new Error("private work shows without asking");
    const sum = await page.locator("[data-summary]").innerText();
    if (!/signed milestones? across \d+ projects?/.test(sum)) throw new Error("summary: " + sum);
    await page.getByRole("button", { name: "Save as PDF" }).waitFor();
  }, page);

  await step("private work only when asked; dates narrow it", async () => {
    await go(page, `/u/${ben}/review?private=1`);
    await page.getByRole("listitem", { name: "Private milestone" }).waitFor({ timeout: 15000 });
    const from = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10);
    await go(page, `/u/${ben}/review?from=${from}`);
    await page.getByRole("listitem", { name: "Static fire at 1.2 kN" }).waitFor({ timeout: 15000 });
    if (await page.getByRole("listitem", { name: "Flight computer passed vibration test" }).count()) throw new Error("work from before the range shows");
  }, page);

  await step("only Ben can open his packet", async () => {
    const maya = await as(b, "maya@forge.test");
    // notFound() inside the streamed part can't change a 200 already sent (as on the résumé page), so check what shows.
    await maya.goto(`${BASE}/u/${ben}/review`, { waitUntil: "networkidle" });
    // The not-found page (app/not-found.tsx), found by its heading rather than its words, which change
    // with the copy ("Nothing forged" became "Nothing built here." in #141).
    await maya.getByRole("heading", { level: 1, name: /^Nothing\b/ }).waitFor({ timeout: 15000 });
    if (await maya.getByRole("heading", { name: "Ben Cho" }).count()) throw new Error("Maya sees Ben's packet");
    if (await maya.getByRole("listitem", { name: "Static fire at 1.2 kN" }).count()) throw new Error("Maya sees Ben's signed work in a packet");
    if (await maya.getByText("Review packet · signed work").count()) throw new Error("the packet rendered for Maya");
  });

  await b.close();
  summary();
})();
