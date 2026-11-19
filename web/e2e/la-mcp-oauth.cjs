// One-click connect (lib/mcp-oauth.ts, supabase/mcp-oauth.sql): an AI assistant signs Ben in through
// Supabase Auth's OAuth 2.1 server (switched on in the local stack, e2e/local-supabase.sh) instead of
// a pasted token. The assistant here is this script, doing what Claude, Cursor or VS Code do:
// 1. /api/mcp without a token says where to sign in (RFC 9728), and the metadata names Supabase Auth.
// 2. The app registers itself (dynamic client registration) and sends Ben to authorize, with PKCE.
// 3. Ben sees Brazework's consent page (which app, what it can do) and connects.
// 4. The code becomes an access token, and the MCP tools answer as Ben: reading and drafting, not posting.
// 5. Settings lists the sign-in; revoking it stops the assistant at once.
// 6. "Not now" sends the assistant away with access_denied.
const crypto = require("crypto");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");
const AUTH = "http://localhost:54321/auth/v1";
const CB = "http://localhost:3999/oauth-callback";
const b64url = (buf) => buf.toString("base64url");

(async () => {
  const b = await browser();
  const mcp = (method, params, token) => fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });

  let meta = null;
  await step("without a token, /api/mcp says where to sign in, and the metadata names Supabase Auth", async () => {
    const r = await mcp("initialize", { protocolVersion: "2025-06-18" });
    const h = r.headers.get("www-authenticate") ?? "";
    if (r.status !== 401 || !/resource_metadata="[^"]*\/\.well-known\/oauth-protected-resource\/api\/mcp"/.test(h)) throw new Error(`401 header: ${r.status} ${h}`);
    meta = await (await fetch(`${BASE}/.well-known/oauth-protected-resource/api/mcp`)).json();
    if (meta.resource !== `${BASE}/api/mcp` || meta.authorization_servers?.[0] !== AUTH) throw new Error(`metadata: ${JSON.stringify(meta)}`);
    const as_ = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
    if (!as_.registration_endpoint || !as_.authorization_endpoint) throw new Error(`server metadata: ${JSON.stringify(as_).slice(0, 200)}`);
  });

  // The assistant registers itself and starts a PKCE sign-in.
  const register = async (name) => (await fetch(`${AUTH}/oauth/clients/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: name, redirect_uris: [CB], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) })).json();
  const reg = await register("Test Assistant");
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const authorizeUrl = (state, client = reg.client_id) => `${AUTH}/oauth/authorize?${new URLSearchParams({ response_type: "code", client_id: client, redirect_uri: CB, code_challenge: challenge, code_challenge_method: "S256", state, scope: "email" })}`;
  // Where the browser ends up: the assistant's callback (nothing listens there; we read the address).
  const landing = (page) => new Promise((resolve) => page.route(`${CB}**`, (route) => { resolve(route.request().url()); route.fulfill({ status: 200, body: "back in the assistant" }); }));

  const ben = await as(b, "ben@forge.test");
  let access = "";
  await step("Ben sees Brazework's consent page: which app, what it can and can't do; he connects", async () => {
    if (!reg.client_id) throw new Error(`registration: ${JSON.stringify(reg)}`);
    const back = landing(ben);
    await ben.goto(authorizeUrl("s1"));
    await ben.waitForURL(/\/oauth\/consent\?authorization_id=/, { timeout: 20000 });
    await ben.getByRole("heading", { name: "Connect Test Assistant to your Brazework?" }).waitFor({ timeout: 15000 });
    await ben.getByText(/can't post, email anyone or sign anything as you/).waitFor();
    await ben.getByRole("button", { name: "Connect" }).click();
    const url = new URL(await back);
    if (url.searchParams.get("state") !== "s1" || !url.searchParams.get("code")) throw new Error(`callback: ${url}`);
    const tok = await (await fetch(`${AUTH}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: url.searchParams.get("code"), redirect_uri: CB, client_id: reg.client_id, code_verifier: verifier }) })).json();
    access = tok.access_token ?? "";
    if (!access || !tok.refresh_token) throw new Error(`token: ${JSON.stringify(tok).slice(0, 200)}`);
  }, ben);

  await step("with the access token, the tools answer as Ben: he reads and drafts, and can't post yet", async () => {
    const init = await (await mcp("initialize", { protocolVersion: "2025-06-18" }, access)).json();
    if (!/can't post/.test(init.result?.instructions ?? "")) throw new Error(`instructions: ${init.result?.instructions?.slice(0, 160)}`);
    const names = ((await (await mcp("tools/list", {}, access)).json()).result?.tools ?? []).map((t) => t.name);
    if (!names.includes("draft_milestone") || names.includes("post_update")) throw new Error(`tools: ${names.join()}`);
    const me = await (await mcp("tools/call", { name: "me", arguments: {} }, access)).json();
    if (!JSON.stringify(me.result?.structuredContent ?? {}).includes("Ben")) throw new Error(`me: ${JSON.stringify(me).slice(0, 200)}`);
  });

  await step("Settings → Your tools lists the sign-in by its app's name; revoking it stops the assistant at once", async () => {
    await go(ben, "/settings/tools");
    await ben.getByText("Sign in from your assistant, no token").waitFor({ timeout: 15000 });
    const row = ben.getByText("Test Assistant (signed in)").first();
    await row.waitFor({ timeout: 15000 });
    // Revoke it as the member would (the same function the Revoke button calls).
    const { execSync } = require("child_process");
    execSync(`docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -tA`, { input: "update public.api_tokens set revoked_at = now() where name = 'Test Assistant (signed in)' and revoked_at is null;" });
    const r = await mcp("tools/call", { name: "me", arguments: {} }, access);
    const body = await r.json();
    if (r.status !== 401 || !/disconnected this assistant/.test(body.error?.message ?? "")) throw new Error(`after revoking: ${r.status} ${JSON.stringify(body).slice(0, 200)}`);
  }, ben);

  await step("'Not now' sends the assistant back with access_denied, and nothing is connected", async () => {
    // Another app Ben hasn't approved before (one he approved goes straight back, with no page).
    const other = await register("Another Assistant");
    await ben.unroute(`${CB}**`);
    const back = landing(ben);
    await ben.goto(authorizeUrl("s2", other.client_id));
    await ben.waitForURL(/\/oauth\/consent\?authorization_id=/, { timeout: 20000 });
    await ben.getByRole("button", { name: "Not now" }).click();
    const url = new URL(await back);
    if (url.searchParams.get("error") !== "access_denied" || url.searchParams.get("state") !== "s2") throw new Error(`denied callback: ${url}`);
  }, ben);

  await step("a browser session's token (not an app's) can't use the MCP server", async () => {
    const session = await (await fetch(`${AUTH}/token?grant_type=password`, { method: "POST", headers: { "content-type": "application/json", apikey: require("fs").readFileSync(require("path").join(__dirname, ".anon-key"), "utf8").trim() }, body: JSON.stringify({ email: "ben@forge.test", password: "forge-test-pass-1" }) })).json();
    const r = await mcp("tools/call", { name: "me", arguments: {} }, session.access_token);
    if (r.status !== 401) throw new Error(`a session token got ${r.status}`);
  });

  summary();
  await b.close();
})();
