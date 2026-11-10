import { MCP_PROTOCOLS, MCP_TOOLS, absolutize, mcpDb, tokenHash } from "@/lib/mcp";
import { env } from "@/lib/env";

// POST /api/mcp: Brazework's MCP server (Streamable HTTP, JSON responses, no session state).
// Clients send "Authorization: Bearer forge_…", a personal token from Settings → AI tools.
type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const rpc = (id: Msg["id"], body: { result?: unknown; error?: { code: number; message: string } }, status = 200) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, ...body }, { status, headers: { "Cache-Control": "no-store" } });
const unauthorized = (message: string) =>
  Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="Brazework", error="invalid_token"' } });

export async function GET() {
  return new Response("Brazework's MCP server takes POST requests. Create a token in Brazework → Settings → AI tools.", { status: 405, headers: { Allow: "POST" } });
}

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^forge_[A-Za-z0-9_-]{20,80}$/.test(token)) return unauthorized("Add a Brazework token: Authorization: Bearer forge_…");
  const hash = tokenHash(token);
  const db = mcpDb();
  const who = await db.rpc("mcp_user", { p_hash: hash });
  if (who.error) return rpc(null, { error: { code: -32603, message: who.error.code === "PGRST202" ? "AI tools aren't switched on on Brazework yet." : "Brazework couldn't check that token." } }, 503);
  if (!who.data) return unauthorized("That token isn't valid any more. Create a new one in Brazework → Settings → AI tools.");

  let msg: Msg;
  try { msg = (await req.json()) as Msg; } catch { return rpc(null, { error: { code: -32700, message: "Parse error" } }, 400); }
  if (Array.isArray(msg) || !msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpc(null, { error: { code: -32600, message: "Invalid request" } }, 400);
  // Notifications (no id) need no answer.
  if (msg.id === undefined) return new Response(null, { status: 202 });

  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return rpc(msg.id, { result: {
        protocolVersion: MCP_PROTOCOLS.includes(asked) ? asked : MCP_PROTOCOLS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "forge", title: "Brazework", version: "0.1.0" },
        instructions: "Brazework is home base for university STEM clubs. These tools read the signed-in member's Brazework: their profile and club-verified work, clubs, upcoming events, projects, notifications, and search across clubs and people. Results include links to open in Brazework.",
      } });
    }
    case "ping":
      return rpc(msg.id, { result: {} });
    case "tools/list":
      return rpc(msg.id, { result: { tools: MCP_TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } })) } });
    case "tools/call": {
      const tool = MCP_TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return rpc(msg.id, { error: { code: -32602, message: `Unknown tool: ${String(msg.params?.name)}` } });
      const input = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (tool.name === "search" && String(input.query ?? "").trim().length < 2) return rpc(msg.id, { result: { content: [{ type: "text", text: "Give at least 2 characters to search for." }], isError: true } });
      const { data, error } = await db.rpc(tool.rpc, { p_hash: hash, ...tool.args(input) });
      if (error) return rpc(msg.id, { result: { content: [{ type: "text", text: "Brazework couldn't answer that right now. Try again." }], isError: true } });
      const out = absolutize(data, env.siteUrl);
      const structured = Array.isArray(out) ? { items: out } : out;
      return rpc(msg.id, { result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: structured } });
    }
    default:
      return rpc(msg.id, { error: { code: -32601, message: `Method not found: ${msg.method}` } });
  }
}
