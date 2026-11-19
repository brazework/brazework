import { createHash, randomBytes } from "node:crypto";
import { MCP_PROTOCOLS, MCP_TOOLS, absolutize, annotationsFor, mcpDb, scopeFlags, sourceArgs, tokenHash, toolsFor } from "@/lib/mcp";
import { actionPayload } from "@/lib/tool-actions";
import { PLAYBOOKS, PLAYBOOK_INDEX_URI, PROMPTS, playbookMarkdown, playbookUri, playbooksIndexMarkdown, promptText } from "@/lib/mcp-playbooks";
import { mailer } from "@/lib/email";
import { nextStep, withFix } from "@/lib/mcp-results";
import { env } from "@/lib/env";
import { linkSignIn, looksLikeJwt, oauthEnabled, resourceMetadataUrl } from "@/lib/mcp-oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildVouchEmail, type Relationship } from "@/lib/vouch-email";

// POST /api/mcp: Brazework's MCP server (Streamable HTTP, JSON responses, no session state).
// Clients send "Authorization: Bearer forge_…", a personal token from Settings → Your tools (/settings/tools),
// or sign in (lib/mcp-oauth.ts): the 401 points them to this server's OAuth metadata, and they come
// back with a Supabase access token, which becomes that sign-in's own token row.
// Tools (lib/mcp.ts) read and write through database functions that check the token; prompts and
// resources (lib/mcp-playbooks.ts) are the field playbooks: slash commands that turn the member's work
// in their own tools into posts, milestones and signature asks, always with their yes.
type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const rpc = (id: Msg["id"], body: { result?: unknown; error?: { code: number; message: string } }, status = 200) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, ...body }, { status, headers: { "Cache-Control": "no-store" } });
// With the OAuth server on, a 401 also says where to sign in (RFC 9728), which is how clients like Claude,
// Cursor and VS Code start one-click connect.
async function unauthorized(message: string, origin: string) {
  const meta = (await oauthEnabled()) ? `, resource_metadata="${resourceMetadataUrl(origin)}"` : "";
  return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }, { status: 401, headers: { "WWW-Authenticate": `Bearer realm="Brazework", error="invalid_token"${meta}` } });
}
// Refusals say how to fix them (lib/mcp-results.ts), so the assistant can act on them or tell the member.
const toolError = (id: Msg["id"], text: string) => rpc(id, { result: { content: [{ type: "text", text: withFix(text) }], isError: true } });

const ABOUT = "Brazework is the record of what people build, signed by the people who saw it, and home base for their clubs.";
function instructions(s: { canDraft: boolean; canPost: boolean }) {
  const reads = "These tools read the member's Brazework (profile and club-verified work, clubs, events, projects, notifications, search).";
  const playbooks = `For the tools people in each field use and the moments worth recording, read ${PLAYBOOK_INDEX_URI}; the prompts shipped, result, week, ask_signature and setup run the common workflows.`;
  const acts = "add a project (create_project), update one (update_project) and add a teammate from their clubs (add_teammate)";
  if (s.canPost) return `${ABOUT} ${reads} They can also post a build update (post_update), log a milestone (log_milestone), ask someone to sign one (request_signature), ${acts} as the member, or leave any of these as drafts for them to approve in Brazework (draft_post, draft_milestone, or draft: true). Ask the member before posting, sending or changing anything, and write in their voice. ${playbooks} Results include links to open in Brazework, and a next step.`;
  if (s.canDraft) return `${ABOUT} ${reads} This token can't post: it leaves drafts that the member edits and approves in Brazework (draft_post, draft_milestone; and ${acts}, which wait as cards in their drafts and on Ember's page), so nothing happens without them. Write in their voice, with specifics. ${playbooks} Results include links to open in Brazework, and a next step.`;
  return `${ABOUT} ${reads} ${playbooks} Results include links to open in Brazework.`;
}

export async function GET() {
  return new Response("Brazework's MCP server takes POST requests. Connect a tool in Brazework → Settings → Your tools.", { status: 405, headers: { Allow: "POST" } });
}

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const db = mcpDb();
  let hash: string;
  let scopes: string[] = ["read"];
  if (looksLikeJwt(token)) {
    // Signed in from the assistant: this sign-in's token row (made on the first call).
    const linked = await linkSignIn(token);
    if (!linked.ok) return linked.status === 401 ? unauthorized(linked.message, origin) : rpc(null, { error: { code: -32603, message: linked.message } }, 503);
    ({ hash, scopes } = linked);
  } else {
    if (!/^forge_[A-Za-z0-9_-]{20,80}$/.test(token)) return unauthorized("Sign in to Brazework from your assistant, or add a token from Brazework → Settings → Your tools: Authorization: Bearer forge_…", origin);
    hash = tokenHash(token);
    // Who the token is for and what it may do (supabase/mcp-writes.sql); before that step, every token reads.
    let who = await db.rpc("mcp_token", { p_hash: hash });
    if (who.error?.code === "PGRST202") who = await db.rpc("mcp_user", { p_hash: hash });
    else if (who.data) scopes = ((who.data as { scopes?: string[] }).scopes ?? ["read"]);
    if (who.error) return rpc(null, { error: { code: -32603, message: who.error.code === "PGRST202" ? "AI tools aren't switched on on Brazework yet." : "Brazework couldn't check that token." } }, 503);
    if (!who.data) return unauthorized("That token isn't valid any more. Make a new one in Brazework → Settings → Your tools.", origin);
  }
  const can = scopeFlags(scopes);
  const tools = toolsFor(scopes);

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
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { name: "brazework", title: "Brazework", version: "0.3.0" },
        instructions: instructions(can),
      } });
    }
    case "ping":
      return rpc(msg.id, { result: {} });
    case "tools/list":
      return rpc(msg.id, { result: { tools: tools.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: annotationsFor(t) })) } });
    case "prompts/list":
      return rpc(msg.id, { result: { prompts: PROMPTS } });
    case "prompts/get": {
      const name = String(msg.params?.name ?? "");
      const raw = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      const args = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 300)]));
      const text = promptText(name, args, can);
      const def = PROMPTS.find((p) => p.name === name);
      if (!text || !def) return rpc(msg.id, { error: { code: -32602, message: `Unknown prompt: ${name}` } });
      return rpc(msg.id, { result: { description: def.description, messages: [{ role: "user", content: { type: "text", text } }] } });
    }
    case "resources/list":
      return rpc(msg.id, { result: { resources: [
        { uri: PLAYBOOK_INDEX_URI, name: "playbooks", title: "Brazework playbooks", description: "One playbook per field: the tools that connect, the moments worth recording, who signs.", mimeType: "text/markdown" },
        ...PLAYBOOKS.map((p) => ({ uri: playbookUri(p), name: `playbook-${p.id}`, title: `${p.field} playbook`, description: `How people in ${p.field} turn their work into their Brazework record.`, mimeType: "text/markdown" })),
      ] } });
    case "resources/read": {
      const uri = String(msg.params?.uri ?? "");
      const p = PLAYBOOKS.find((x) => playbookUri(x) === uri);
      const text = uri === PLAYBOOK_INDEX_URI ? playbooksIndexMarkdown() : p ? playbookMarkdown(p) : null;
      if (!text) return rpc(msg.id, { error: { code: -32002, message: `Resource not found: ${uri}` } });
      return rpc(msg.id, { result: { contents: [{ uri, mimeType: "text/markdown", text }] } });
    }
    case "tools/call": {
      const tool = MCP_TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return rpc(msg.id, { error: { code: -32602, message: `Unknown tool: ${String(msg.params?.name)}` } });
      if (tool.needs === "post" && !can.canPost) return toolError(msg.id, can.canDraft
        ? `This token can't post for you. Leave it as a draft instead (draft_post, draft_milestone) for the member to approve in Brazework, or turn on "Can post" for it in Brazework → Settings → Your tools.`
        : `This token can only read. To let this tool post for you, turn on "Can post" for it in Brazework → Settings → Your tools.`);
      if (tool.needs === "draft" && !can.canDraft) return toolError(msg.id, "This token can only read. Make a new token in Brazework → Settings → Your tools to leave drafts for the member to approve.");
      const input = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (tool.name === "search" && String(input.query ?? "").trim().length < 2) return toolError(msg.id, "Give at least 2 characters to search for.");
      if (tool.name === "request_signature") return requestSignature(msg.id, hash, tool.args(input));
      // Actions shared with Ember (lib/tool-actions.ts): done with a token that posts, else drafted.
      const { data, error } = tool.act
        ? await db.rpc("mcp_act", { p_hash: hash, p_kind: tool.act, p_payload: actionPayload(tool.act, input), p_draft: !can.canPost || input.draft === true, ...sourceArgs(input) })
        : await db.rpc(tool.rpc, { p_hash: hash, ...tool.args(input) });
      // A rule the member's post broke (P0001: not your project, too fast, …) is said as it is.
      if (error) return toolError(msg.id, error.code === "P0001" ? error.message : error.code === "PGRST202" ? "That isn't switched on on Brazework yet. Try again in a few minutes." : "Brazework couldn't answer that right now. Try again.");
      return ok(msg.id, data, tool.name);
    }
    default:
      return rpc(msg.id, { error: { code: -32601, message: `Method not found: ${msg.method}` } });
  }
}

// Writes also say what happens next and where to see it (lib/mcp-results.ts).
function ok(id: Msg["id"], data: unknown, tool = "") {
  const plain = absolutize(data, env.siteUrl);
  const step = nextStep(tool, plain, env.siteUrl);
  const out = step && plain && typeof plain === "object" && !Array.isArray(plain) ? { ...plain, ...step } : plain;
  const structured = Array.isArray(out) ? { items: out } : out;
  return rpc(id, { result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: structured } });
}

// A signature ask, as lib/vouches.ts makes one from the app: the server makes the link, the database
// keeps only its hash and checks every guard (supabase/vouches.sql), and the link goes out by email.
// Nobody can answer an ask whose email never went out, so a failed send withdraws it.
async function requestSignature(id: Msg["id"], hash: string, args: Record<string, unknown>) {
  const mail = mailer();
  if (!mail.enabled) return toolError(id, "Brazework's email isn't available right now, so the ask can't be sent. Try again later, or ask from the milestone in Brazework.");
  const link = randomBytes(32).toString("base64url");
  const { data, error } = await mcpDb().rpc("mcp_request_vouch", { p_hash: hash, ...args, p_token_hash: createHash("sha256").update(link).digest("hex") });
  if (error) return toolError(id, error.code === "P0001" ? error.message : error.code === "42501" ? "You can only ask about your own milestones (open_milestones in my_projects)." : error.code === "PGRST202" ? "That isn't switched on on Brazework yet. Try again in a few minutes." : "Brazework couldn't send that right now. Try again.");
  const r = data as { vouch_id: number; member: string; title: string; project: string; milestone_url: string };
  const email = String(args.p_email);
  const sent = await mail.send({ to: email, ...buildVouchEmail({ member: r.member, title: r.title, project: r.project, relationship: args.p_relationship as Relationship, link: `${env.siteUrl}/vouch/${link}` }) });
  if (!sent.ok) {
    await createAdminClient()?.from("milestone_vouches").update({ state: "withdrawn" }).eq("id", r.vouch_id);
    return toolError(id, "Brazework couldn't send the email. Check the address and try again.");
  }
  return ok(id, { status: "asked", email, milestone: r.title, milestone_url: r.milestone_url, next: `We emailed ${email} a one-time link. The member is notified when they answer.` });
}
