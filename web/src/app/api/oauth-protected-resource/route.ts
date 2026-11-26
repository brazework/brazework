import { connection } from "next/server";
import { oauthEnabled, resourceMetadata } from "@/lib/mcp-oauth";

// /.well-known/oauth-protected-resource[/api/mcp] (rewritten here in next.config.ts): RFC 9728 metadata
// for the MCP endpoint. It names Supabase Auth as the authorization server, so an assistant can sign
// the member in. Only while the OAuth server is switched on; until then, tokens are the way in.
// Named for the address the client actually called (production, a preview, a custom domain).
// Answered per request (connection()): it depends on the caller's address, so it's never prerendered.
export async function GET(req: Request) {
  await connection();
  if (!(await oauthEnabled())) return Response.json({ error: "not_found" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  return Response.json(resourceMetadata(new URL(req.url).origin), { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
