import { createHash } from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Forge as an MCP server (supabase/mcp.sql). Each tool is a database function that checks the
// member's token first and returns only what they could already see in the app. Read-only for now.

export const MCP_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"];
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

type Tool = { name: string; title: string; description: string; inputSchema: Record<string, unknown>; rpc: string; args: (input: Record<string, unknown>) => Record<string, unknown> };
const none = { type: "object", properties: {}, additionalProperties: false };

export const MCP_TOOLS: Tool[] = [
  { name: "me", title: "My Forge profile", description: "The signed-in member's Forge profile at a glance: headline, field, interests, and counts of projects, club-verified milestones, clubs and unread notifications.", inputSchema: none, rpc: "mcp_me", args: () => ({}) },
  { name: "my_clubs", title: "My clubs", description: "Clubs the member belongs to, with their role in each.", inputSchema: none, rpc: "mcp_my_clubs", args: () => ({}) },
  { name: "upcoming_events", title: "Upcoming events", description: "Published events in the next N days (default 14, up to 90) from public clubs and the member's clubs, with whether the member is going.", inputSchema: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 90, description: "How many days ahead to look." } }, additionalProperties: false }, rpc: "mcp_events", args: (i) => ({ p_days: typeof i.days === "number" ? Math.round(i.days) : 14 }) },
  { name: "my_projects", title: "My projects", description: "The member's projects, newest first, each with its club-verified milestones (the proof on their profile).", inputSchema: none, rpc: "mcp_my_projects", args: () => ({}) },
  { name: "search", title: "Search Forge", description: "Find clubs (public ones and the member's own) and people on Forge by name, field or headline.", inputSchema: { type: "object", properties: { query: { type: "string", minLength: 2, maxLength: 80, description: "Words to look for." } }, required: ["query"], additionalProperties: false }, rpc: "mcp_search", args: (i) => ({ p_query: String(i.query ?? "") }) },
  { name: "notifications", title: "My notifications", description: "The member's 20 most recent notifications: likes, comments, mentions, follows, club requests and verified milestones.", inputSchema: none, rpc: "mcp_notifications", args: () => ({}) },
];

// One client per request with only the public key: there's no session, the token is the identity.
export const mcpDb = () => createSupabase(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Links in results ("/c/abc") become absolute, so they work outside Forge.
export function absolutize(value: unknown, origin: string): unknown {
  if (typeof value === "string") return /^\/(c|u|events|projects|post)\//.test(value) ? origin + value : value;
  if (Array.isArray(value)) return value.map((v) => absolutize(v, origin));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutize(v, origin)]));
  return value;
}
