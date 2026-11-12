// Connecting AI tools (Linear FIX-78): every command, install link and config snippet, checked
// against the formats each tool documents. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { SERVER_NAME, TOOLS, cursorLink, isConnected, setupSteps, toolFor, vscodeLink } from "@/lib/tool-setup";

const URL_ = "https://brazework.app/api/mcp";
// Obviously fake (and low-entropy, so the secret scanner doesn't mistake it for a real key).
const TOKEN = `forge_${"example".repeat(5)}`;

test("Claude Code: claude mcp add over HTTP, with the token as a header, for every project", () => {
  const [s] = setupSteps("claude-code", URL_, TOKEN);
  assert.equal(s.kind, "command");
  assert.equal(s.kind === "command" && s.text, `claude mcp add --transport http brazework ${URL_} --header "Authorization: Bearer ${TOKEN}" --scope user`);
});

test("Cursor: the install link carries the server as base64 JSON (url + Authorization header)", () => {
  const link = cursorLink(URL_, TOKEN);
  assert.ok(link.startsWith(`cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=`));
  const config = JSON.parse(Buffer.from(decodeURIComponent(new URL(link).searchParams.get("config")!), "base64").toString("utf8"));
  assert.deepEqual(config, { url: URL_, headers: { Authorization: `Bearer ${TOKEN}` } });
  const file = setupSteps("cursor", URL_, TOKEN)[1];
  assert.ok(file.kind === "file" && JSON.parse(file.text).mcpServers.brazework.url === URL_);
});

test("VS Code: vscode:mcp/install with a URL-encoded http server (type is required, or it's taken for a command)", () => {
  const link = vscodeLink(URL_, TOKEN);
  assert.ok(link.startsWith("vscode:mcp/install?"));
  const config = JSON.parse(decodeURIComponent(link.slice("vscode:mcp/install?".length)));
  assert.deepEqual(config, { name: "brazework", type: "http", url: URL_, headers: { Authorization: `Bearer ${TOKEN}` } });
  const file = setupSteps("vscode", URL_, TOKEN)[1];
  assert.ok(file.kind === "file" && JSON.parse(file.text).servers.brazework.type === "http", "workspace file uses \"servers\", not \"mcpServers\"");
});

test("Codex: the token goes in an environment variable (Codex reads bearer tokens only from one)", () => {
  const [s] = setupSteps("codex", URL_, TOKEN);
  assert.ok(s.kind === "command");
  assert.equal(s.text, `export BRAZEWORK_TOKEN=${TOKEN}\ncodex mcp add brazework --url ${URL_} --bearer-token-env-var BRAZEWORK_TOKEN`);
});

test("Windsurf uses serverUrl; Zed uses context_servers", () => {
  const w = setupSteps("windsurf", URL_, TOKEN)[0];
  assert.ok(w.kind === "file" && JSON.parse(w.text).mcpServers.brazework.serverUrl === URL_);
  const z = setupSteps("zed", URL_, TOKEN)[0];
  assert.ok(z.kind === "file" && JSON.parse(z.text).context_servers.brazework.headers.Authorization === `Bearer ${TOKEN}`);
});

test("every tool has steps, and a token's name finds its tool", () => {
  for (const t of TOOLS) assert.ok(setupSteps(t.id, URL_, TOKEN).length > 0, t.id);
  assert.equal(toolFor("Cursor")?.id, "cursor");
  assert.equal(toolFor("Claude Code on my laptop")?.id, "claude-code");
  assert.equal(toolFor("Something else"), undefined);
});

test("connected means used since it was made", () => {
  assert.equal(isConnected({ created_at: "2026-11-11T10:00:00Z", last_used_at: null }), false);
  assert.equal(isConnected({ created_at: "2026-11-11T10:00:00Z", last_used_at: "2026-11-11T10:01:00Z" }), true);
});

// Phase 2: what each MCP tool tells the client about itself, so Claude, Codex and VS Code ask before
// anything that writes (lib/mcp.ts).
test("MCP tools are annotated honestly: reads are read-only; post_update writes but never destroys", async () => {
  const { MCP_TOOLS, annotationsFor } = await import("@/lib/mcp");
  for (const t of MCP_TOOLS.filter((x) => !x.writes)) assert.equal(annotationsFor(t).readOnlyHint, true, t.name);
  const post = MCP_TOOLS.find((t) => t.name === "post_update");
  assert.ok(post?.writes);
  assert.deepEqual(annotationsFor(post!), { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
  assert.deepEqual(post!.args({ body: "Hi", kind: "result", project_id: "p1", tags: ["a", "b", "c", "d", 5] }),
    { p_body: "Hi", p_kind: "result", p_project: "p1", p_club: null, p_tags: ["a", "b", "c"] });
  assert.deepEqual(post!.inputSchema.required, ["body"]);
});
