import { createHash } from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Brazework as an MCP server (supabase/mcp.sql). Each tool is a database function that checks the
// member's token first and returns only what they could already see in the app. A token allowed to
// post (supabase/mcp-writes.sql) also gets post_update, which posts as its member under the app's rules.

export const MCP_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"];
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

type Tool = { name: string; title: string; description: string; inputSchema: Record<string, unknown>; rpc: string; args: (input: Record<string, unknown>) => Record<string, unknown>; writes?: boolean };
const none = { type: "object", properties: {}, additionalProperties: false };

export const MCP_TOOLS: Tool[] = [
  { name: "me", title: "My Brazework profile", description: "The signed-in member's Brazework profile at a glance: headline, field, interests, and counts of projects, club-verified milestones, clubs and unread notifications.", inputSchema: none, rpc: "mcp_me", args: () => ({}) },
  { name: "my_clubs", title: "My clubs", description: "Clubs the member belongs to, with their role in each.", inputSchema: none, rpc: "mcp_my_clubs", args: () => ({}) },
  { name: "upcoming_events", title: "Upcoming events", description: "Published events in the next N days (default 14, up to 90) from public clubs and the member's clubs, with whether the member is going.", inputSchema: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 90, description: "How many days ahead to look." } }, additionalProperties: false }, rpc: "mcp_events", args: (i) => ({ p_days: typeof i.days === "number" ? Math.round(i.days) : 14 }) },
  { name: "my_projects", title: "My projects", description: "The member's projects, newest first, each with its club-verified milestones (the proof on their profile).", inputSchema: none, rpc: "mcp_my_projects", args: () => ({}) },
  { name: "search", title: "Search Brazework", description: "Find clubs (public ones and the member's own) and people on Brazework by name, field or headline.", inputSchema: { type: "object", properties: { query: { type: "string", minLength: 2, maxLength: 80, description: "Words to look for." } }, required: ["query"], additionalProperties: false }, rpc: "mcp_search", args: (i) => ({ p_query: String(i.query ?? "") }) },
  { name: "notifications", title: "My notifications", description: "The member's 20 most recent notifications: likes, comments, mentions, follows, club requests and verified milestones.", inputSchema: none, rpc: "mcp_notifications", args: () => ({}) },
  // Posts as the member (only with a token allowed to post). Shows on Brazework as "via <tool>".
  {
    name: "post_update", writes: true, title: "Post a build update",
    description: "Post an update to the member's Brazework feed, as them, about what they just built: a result, an update or a question. Attach it to one of their projects (ids from my_projects) and optionally share it with a club they're in (ids from my_clubs). It shows as made via this tool. Write it in the member's voice, with specifics (what changed, numbers, what's next); ask them before posting.",
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "string", minLength: 1, maxLength: 3000, description: "The post, in the member's voice. #tags in the text become topics." },
        kind: { type: "string", enum: ["update", "result", "question"], description: "result: something worked or was measured; question: asking for help; update: anything else." },
        project_id: { type: "string", description: "One of the member's projects, from my_projects." },
        club_id: { type: "string", description: "Also share it with this club (one the member is in, from my_clubs)." },
        tags: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 3, description: "Up to 3 topics." },
      },
      required: ["body"],
      additionalProperties: false,
    },
    rpc: "mcp_post_update",
    args: (i) => ({ p_body: String(i.body ?? ""), p_kind: typeof i.kind === "string" ? i.kind : "update", p_project: typeof i.project_id === "string" ? i.project_id : null, p_club: typeof i.club_id === "string" ? i.club_id : null, p_tags: Array.isArray(i.tags) ? i.tags.filter((t) => typeof t === "string").slice(0, 3) : [] }),
  },
];

// What each tool may do, for the client's approval prompts: reads change nothing; post_update adds a
// post (it doesn't change or remove anything), so it isn't destructive, but it isn't read-only either.
export const annotationsFor = (t: Tool) => (t.writes ? { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } : { readOnlyHint: true, openWorldHint: false });

// One client per request with only the public key: there's no session, the token is the identity.
export const mcpDb = () => createSupabase(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Links in results ("/c/abc") become absolute, so they work outside Brazework.
export function absolutize(value: unknown, origin: string): unknown {
  if (typeof value === "string") return /^\/(c|u|events|projects|post)\//.test(value) ? origin + value : value;
  if (Array.isArray(value)) return value.map((v) => absolutize(v, origin));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutize(v, origin)]));
  return value;
}
