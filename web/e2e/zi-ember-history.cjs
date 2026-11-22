// Ember remembers the whole conversation (FIX-239), with a stand-in for Claude: a small server on
// :3998 that speaks the Messages API, records every request, and answers from what it was sent. A
// second copy of the built app runs on :3201 pointed at it (the main one on :3200 keeps Ember off).
//   1. A saved chat reopened: Ember answers from something said 17 messages earlier, and the server
//      read the chat from the database, not just from what the browser sent.
//   2. A chat past the budget: the middle is summarised by the small model and the start stays.
//   3. The Ask bar: a follow-up in the same answer card carries the question before it, and
//      "Continue in Ember" opens that conversation on Ember's page.
//   4. Ember's page is centred, with past chats in a column on the left.
const http = require("http");
const { spawn, execSync } = require("child_process");
process.env.BASE = "http://localhost:3201";
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const maya = psql("select id from auth.users where email = 'maya@forge.test'");

// ---- The stand-in for Claude ----
const seen = [];
const text = (c) => (typeof c === "string" ? c : (c || []).map((b) => b.text || "").join(""));
function reply(body) {
  const all = body.messages.map((m) => text(m.content)).join("\n");
  const last = text(body.messages.at(-1).content);
  if (/condense/.test(text(body.messages[0].content))) return "The member's rocket is called Kestrel. They plan to launch on the 3rd.";
  if (/what is my rocket called/i.test(last)) { const m = /my rocket is called (\w+)/i.exec(all) || /rocket is called (\w+)/i.exec(all); return m ? `Your rocket is called ${m[1]}.` : "I don't know your rocket's name."; }
  if (/and the second one/i.test(last)) return /which two clubs/i.test(all) ? "The second one is Robotics Society, which meets on Thursdays." : "Which one do you mean?";
  if (/which two clubs/i.test(last)) return "Rocketry Club and Robotics Society fit you best.";
  return "Noted.";
}
const stub = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (!req.url.startsWith("/v1/messages")) { res.writeHead(404).end("{}"); return; }
    const body = JSON.parse(raw || "{}");
    seen.push(body);
    const out = reply(body);
    const message = { id: `msg_${seen.length}`, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } };
    if (!body.stream) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ...message, content: [{ type: "text", text: out }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 } }));
      return;
    }
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    ev("message_start", { message });
    ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: out } });
    ev("content_block_stop", { index: 0 });
    ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 10 } });
    ev("message_stop", {});
    res.end();
  });
});

async function up() {
  await new Promise((ok) => stub.listen(3998, ok));
  const app = spawn("npx", ["next", "start", "-p", "3201"], { env: { ...process.env, ANTHROPIC_API_KEY: "sk-ant-e2e-stub", ANTHROPIC_BASE_URL: "http://localhost:3998", EMBER_VIA_GATEWAY: "" }, stdio: "ignore", detached: true });
  for (let i = 0; i < 120; i++) {
    const ok = await fetch(`${BASE}/login`).then((r) => r.ok).catch(() => false);
    if (ok) return app;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("the second app didn't start on :3201");
}

const turns = (pairs) => JSON.stringify(pairs.flatMap(([q, a]) => [{ role: "user", content: q }, { role: "assistant", content: a }])).replace(/'/g, "''");
const save = (title, json) => psql(`insert into public.copilot_chats (user_id, title, messages) values ('${maya}', '${title}', '${json}'::jsonb) returning id`).split("\n").pop();
const ask = async (page, q) => { await page.locator("#copilot-input").fill(q); await page.getByRole("button", { name: "Send" }).click(); };
const mainCalls = () => seen.filter((b) => b.stream);

(async () => {
  const app = await up();
  const b = await browser();
  // Reset Maya's daily Ember allowance, so this spec never depends on what ran before it.
  psql(`delete from public.copilot_usage where user_id = '${maya}'`);
  const page = await as(b, "maya@forge.test");

  await step("a reopened saved chat answers from something said 17 messages earlier, read from the database", async () => {
    const pairs = [["Hi Ember. My rocket is called Kestrel.", "Nice name. What are you working on with it?"]];
    for (let i = 1; i < 9; i++) pairs.push([`Update ${i}: worked on the avionics bay.`, `Got it, update ${i} noted.`]);
    const id = save("Kestrel build", turns(pairs));
    await go(page, `/copilot?chat=${id}`);
    await page.getByText("Update 8: worked on the avionics bay.").waitFor({ timeout: 15000 });
    const before = mainCalls().length;
    await ask(page, "What is my rocket called?");
    await page.getByText("Your rocket is called Kestrel.").waitFor({ timeout: 20000 });
    const sent = mainCalls().slice(before)[0];
    if (!sent) throw new Error("Ember's model was never called");
    if (sent.messages.length !== 19) throw new Error(`expected the 18 saved messages plus the question, got ${sent.messages.length}`);
    if (!sent.cache_control) throw new Error("the conversation isn't cached");
    // The server read the chat itself: change the stored copy, ask again, and the change shows up
    // even though the open page still holds the old words.
    // Wait for the page's own save of that answer first, or it would write the old words back.
    for (let i = 0; i < 50 && psql(`select jsonb_array_length(messages) from public.copilot_chats where id = '${id}'`) !== "20"; i++) await new Promise((r) => setTimeout(r, 200));
    psql(`update public.copilot_chats set messages = jsonb_set(messages, '{0,content}', '"Hi Ember. My rocket is called Osprey."') where id = '${id}'`);
    await ask(page, "What is my rocket called?");
    await page.getByText("Your rocket is called Osprey.").waitFor({ timeout: 20000 });
  }, page);

  await step("a chat past the budget keeps its start, and the small model summarises the middle", async () => {
    const pairs = [["Hi Ember. My rocket is called Kestrel.", "Nice name."]];
    for (let i = 1; i < 40; i++) pairs.push([`Log ${i}: ${"telemetry ".repeat(580)}`, `Noted log ${i}. ${"ok ".repeat(1900)}`]);
    const id = save("Long Kestrel log", turns(pairs));
    await go(page, `/copilot?chat=${id}`);
    const before = seen.length;
    await ask(page, "What is my rocket called?");
    await page.getByText("Your rocket is called Kestrel.").waitFor({ timeout: 30000 });
    const calls = seen.slice(before);
    const sum = calls.find((c) => !c.stream);
    if (!sum || !/claude-haiku-5-5$/.test(sum.model)) throw new Error("no summary request to the small model: " + calls.map((c) => c.model).join(", "));
    const main = calls.find((c) => c.stream);
    const firsts = main.messages.map((m) => text(m.content));
    if (firsts[0] !== "Hi Ember. My rocket is called Kestrel.") throw new Error("the start of the chat wasn't kept");
    if (!firsts.some((t) => /summarised so the chat fits: The member's rocket is called Kestrel/.test(t))) throw new Error("the summary isn't in what Ember saw");
    if (main.messages.length >= 81) throw new Error("nothing was folded");
  }, page);

  await step("Ember's page is centred, with past chats in a column on the left", async () => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await go(page, "/copilot");
    const rail = await page.getByRole("complementary", { name: "Your Ember chats" }).boundingBox();
    const box = await page.locator("#copilot-input").boundingBox();
    const main = await page.locator("main").boundingBox();
    if (!rail || !box || !main) throw new Error("missing the rail or the composer");
    if (rail.x + rail.width > box.x) throw new Error("the chat list isn't to the left of the chat");
    const off = Math.abs((box.x + box.width / 2) - (main.x + main.width / 2));
    if (off > 40) throw new Error(`the chat is ${Math.round(off)}px off the middle of the page`);
  }, page);

  await step("in the Ask bar, a follow-up knows the question before it, and Continue in Ember carries the conversation", async () => {
    await go(page, "/feed");
    const bar = page.getByRole("searchbox").or(page.getByLabel("Ask Ember or search Brazework")).first();
    await bar.fill("Which two clubs fit me?");
    await bar.press("Enter");
    const card = page.getByRole("region", { name: "Ember's answer" });
    await card.getByText("Rocketry Club and Robotics Society fit you best.").waitFor({ timeout: 20000 });
    await bar.fill("and the second one?");
    await bar.press("Enter");
    await card.getByText("The second one is Robotics Society, which meets on Thursdays.").waitFor({ timeout: 20000 });
    await card.getByRole("list", { name: "Earlier in this conversation" }).getByText("Which two clubs fit me?").waitFor();
    await card.getByRole("button", { name: "Continue in Ember" }).click();
    await page.waitForURL(/\/copilot\?chat=/, { timeout: 15000 });
    await page.getByText("The second one is Robotics Society, which meets on Thursdays.").waitFor({ timeout: 15000 });
    await page.getByText("Which two clubs fit me?").first().waitFor();
  }, page);

  await page.context().close();
  await b.close();
  psql(`delete from public.copilot_chats where user_id = '${maya}'; delete from public.copilot_usage where user_id = '${maya}'`);
  try { process.kill(-app.pid); } catch {}
  stub.close();
  summary();
})();
