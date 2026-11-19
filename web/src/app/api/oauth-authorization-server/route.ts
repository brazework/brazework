import { authServer, oauthEnabled } from "@/lib/mcp-oauth";

// /.well-known/oauth-authorization-server on Brazework's own domain (rewritten here in next.config.ts),
// for MCP clients from before protected resource metadata, which look for it on the server's origin:
// Supabase Auth's own metadata, unchanged, so every endpoint in it is still Supabase's.
export async function GET() {
  if (!(await oauthEnabled())) return Response.json({ error: "not_found" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  const r = await fetch(`${authServer()}/.well-known/oauth-authorization-server`, { next: { revalidate: 300 } });
  if (!r.ok) return Response.json({ error: "unavailable" }, { status: 502 });
  return new Response(await r.text(), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
