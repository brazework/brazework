import { MCP_PROTOCOLS, MCP_TOOLS, absolutize, annotationsFor, mcpDb, tokenHash } from "@/lib/mcp";
import { env } from "@/lib/env";

// POST /api/mcp: Brazework's MCP server (Streamable HTTP, JSON responses, no session state).
// Clients send "Authorization: Bearer forge_…", a personal token from Settings → Your tools (/settings/tools).
type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const rpc = (id: Msg["id"], body: { result?: unknown; error?: { code: number; message: string } }, status = 200) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, ...body }, { status, headers: { "Cache-Control": "no-store" } });
const unauthorized = (message: string) =>
  Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="Brazework", error="invalid_token"' } });

export async function GET() {
  return new Response("Brazework's MCP server takes POST requests. Connect a tool in Brazework → Settings → Your tools.", { status: 405, headers: { Allow: "POST" } });
}

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^forge_[A-Za-z0-9_-]{20,80}$/.test(token)) return unauthorized("Add a Brazework token: Authorization: Bearer forge_…");
  const hash = tokenHash(token);
  const db = mcpDb();
  // Who the token is for and what it may do (supabase/mcp-writes.sql); before that step, every token reads.
  let who = await db.rpc("mcp_token", { p_hash: hash });
  let scopes: string[] = ["read"];
  if (who.error?.code === "PGRST202") who = await db.rpc("mcp_user", { p_hash: hash });
  else if (who.data) scopes = ((who.data as { scopes?: string[] }).scopes ?? ["read"]);
  if (who.error) return rpc(null, { error: { code: -32603, message: who.error.code === "PGRST202" ? "AI tools aren't switched on on Brazework yet." : "Brazework couldn't check that token." } }, 503);
  if (!who.data) return unauthorized("That token isn't valid any more. Make a new one in Brazework → Settings → Your tools.");
  const canPost = scopes.includes("post");
  const tools = MCP_TOOLS.filter((t) => !t.writes || canPost);

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
        serverInfo: { name: "brazework", title: "Brazework", version: "0.2.0" },
        instructions: canPost ? "Brazework is home base for university STEM clubs. These tools read the member's Brazework (profile and club-verified work, clubs, events, projects, notifications, search) and can post a build update as them with post_update. Ask the member before posting, and write in their voice. Results include links to open in Brazework." : "Brazework is home base for university STEM clubs. These tools read the signed-in member's Brazework: their profile and club-verified work, clubs, upcoming events, projects, notifications, and search across clubs and people. Results include links to open in Brazework.",
      } });
    }
    case "ping":
      return rpc(msg.id, { result: {} });
    case "tools/list":
      return rpc(msg.id, { result: { tools: tools.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: annotationsFor(t) })) } });
    case "tools/call": {
      const tool = MCP_TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return rpc(msg.id, { error: { code: -32602, message: `Unknown tool: ${String(msg.params?.name)}` } });
      if (tool.writes && !canPost) return rpc(msg.id, { result: { content: [{ type: "text", text: "This token can only read. To let this tool post for you, turn on \"Can post\" for it in Brazework → Settings → Your tools." }], isError: true } });
      const input = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (tool.name === "search" && String(input.query ?? "").trim().length < 2) return rpc(msg.id, { result: { content: [{ type: "text", text: "Give at least 2 characters to search for." }], isError: true } });
      const { data, error } = await db.rpc(tool.rpc, { p_hash: hash, ...tool.args(input) });
      // A rule the member's post broke (P0001: not your project, too fast, …) is said as it is.
      if (error) return rpc(msg.id, { result: { content: [{ type: "text", text: error.code === "P0001" ? error.message : "Brazework couldn't answer that right now. Try again." }], isError: true } });
      const out = absolutize(data, env.siteUrl);
      const structured = Array.isArray(out) ? { items: out } : out;
      return rpc(msg.id, { result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: structured } });
    }
    default:
      return rpc(msg.id, { error: { code: -32601, message: `Method not found: ${msg.method}` } });
  }
}
