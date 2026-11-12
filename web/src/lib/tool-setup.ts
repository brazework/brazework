// How to connect each AI coding tool to Brazework's MCP server (Linear FIX-78). Pure, so every
// command, link and snippet is unit-tested (tests/tool-setup.test.ts). Formats checked against each
// tool's own docs in November 2026: Claude Code (code.claude.com/docs/en/mcp), Cursor
// (cursor.com/docs/context/mcp/install-links), VS Code (code.visualstudio.com/docs/copilot/reference/
// mcp-configuration), Codex (learn.chatgpt.com/docs/extend/mcp), Windsurf (docs.devin.ai/windsurf/
// plugins/cascade/mcp), Zed (zed.dev/docs/ai/mcp).

export const SERVER_NAME = "brazework";
export const TOKEN_ENV = "BRAZEWORK_TOKEN";

export type ToolId = "claude-code" | "cursor" | "vscode" | "codex" | "windsurf" | "zed";
export type Step =
  | { kind: "link"; label: string; href: string; note?: string }
  | { kind: "command"; label: string; text: string; note?: string }
  | { kind: "file"; label: string; path: string; text: string; note?: string };
export type ToolInfo = { id: ToolId; name: string; maker: string; blurb: string; monogram: string; tokenName: string };

export const TOOLS: ToolInfo[] = [
  { id: "claude-code", name: "Claude Code", maker: "Anthropic", blurb: "One command in your terminal.", monogram: "CC", tokenName: "Claude Code" },
  { id: "cursor", name: "Cursor", maker: "Anysphere", blurb: "One tap opens Cursor and adds it.", monogram: "Cu", tokenName: "Cursor" },
  { id: "vscode", name: "VS Code", maker: "GitHub Copilot agent mode", blurb: "One tap opens VS Code and adds it.", monogram: "VS", tokenName: "VS Code" },
  { id: "codex", name: "Codex", maker: "OpenAI · CLI and IDE", blurb: "Two lines in your terminal.", monogram: "Cx", tokenName: "Codex" },
  { id: "windsurf", name: "Windsurf", maker: "Cascade", blurb: "Paste into its MCP config.", monogram: "Ws", tokenName: "Windsurf" },
  { id: "zed", name: "Zed", maker: "Agent panel", blurb: "Paste into your Zed settings.", monogram: "Ze", tokenName: "Zed" },
];

const bearer = (token: string) => `Bearer ${token}`;
const json = (v: unknown) => JSON.stringify(v, null, 2);
// Base64 of UTF-8 text, in the browser and on the server.
const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

export function cursorLink(endpoint: string, token: string): string {
  const config = { url: endpoint, headers: { Authorization: bearer(token) } };
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${encodeURIComponent(b64(JSON.stringify(config)))}`;
}

export function vscodeLink(endpoint: string, token: string): string {
  const config = { name: SERVER_NAME, type: "http", url: endpoint, headers: { Authorization: bearer(token) } };
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}

// The steps for one tool, with the member's new token filled in. The token appears only here, right
// after it's made; the tool then keeps it in its own config, as it would if pasted by hand.
export function setupSteps(tool: ToolId, endpoint: string, token: string): Step[] {
  switch (tool) {
    case "claude-code":
      return [
        { kind: "command", label: "Run this in your terminal", text: `claude mcp add --transport http ${SERVER_NAME} ${endpoint} --header "Authorization: ${bearer(token)}" --scope user`, note: "--scope user makes Brazework available in every project. Then ask Claude: “What's on in my clubs this week?”" },
      ];
    case "cursor":
      return [
        { kind: "link", label: "Add to Cursor", href: cursorLink(endpoint, token), note: "Cursor opens and asks you to confirm." },
        { kind: "file", label: "Or add it by hand", path: "~/.cursor/mcp.json", text: json({ mcpServers: { [SERVER_NAME]: { url: endpoint, headers: { Authorization: bearer(token) } } } }) },
      ];
    case "vscode":
      return [
        { kind: "link", label: "Add to VS Code", href: vscodeLink(endpoint, token), note: "VS Code opens a review screen; choose Install. Use it in Copilot's agent mode." },
        { kind: "file", label: "Or add it to a workspace", path: ".vscode/mcp.json", text: json({ servers: { [SERVER_NAME]: { type: "http", url: endpoint, headers: { Authorization: bearer(token) } } } }), note: "Don't commit this file with the token in it." },
      ];
    case "codex":
      return [
        { kind: "command", label: "Run these in your terminal", text: `export ${TOKEN_ENV}=${token}\ncodex mcp add ${SERVER_NAME} --url ${endpoint} --bearer-token-env-var ${TOKEN_ENV}`, note: `Codex reads the token from ${TOKEN_ENV}; add the export line to your shell profile so it's there next time. The IDE extension uses the same setup.` },
      ];
    case "windsurf":
      return [
        { kind: "file", label: "Add to Windsurf's MCP config", path: "~/.codeium/windsurf/mcp_config.json", text: json({ mcpServers: { [SERVER_NAME]: { serverUrl: endpoint, headers: { Authorization: bearer(token) } } } }), note: "Newer builds keep it at ~/.config/devin/mcp_config.json. Or open Cascade → MCP servers → View raw config." },
      ];
    case "zed":
      return [
        { kind: "file", label: "Add to your Zed settings", path: "settings.json → \"context_servers\"", text: json({ context_servers: { [SERVER_NAME]: { url: endpoint, headers: { Authorization: bearer(token) } } } }) },
      ];
  }
}

// "Connected" means the tool has used this token since it was made.
export const isConnected = (t: { created_at: string; last_used_at: string | null }) => Boolean(t.last_used_at && Date.parse(t.last_used_at) >= Date.parse(t.created_at));
export const toolFor = (tokenName: string): ToolInfo | undefined => TOOLS.find((x) => tokenName === x.tokenName || tokenName.startsWith(`${x.tokenName} `));
