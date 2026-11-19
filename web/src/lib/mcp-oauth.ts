import { createHmac } from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// One-click connect (supabase/mcp-oauth.sql): an AI assistant signs the member in through Supabase
// Auth's OAuth 2.1 server instead of using a pasted token. This file says where that server is, tells
// clients so (RFC 9728 protected resource metadata), and turns an access token into the member's
// token row for this sign-in, which every MCP tool already understands.

/** The authorization server: Supabase Auth. Clients find its metadata from here (RFC 8414). */
export const authServer = () => `${env.supabaseUrl.replace(/\/$/, "")}/auth/v1`;
export const mcpResource = (site: string) => `${site.replace(/\/$/, "")}/api/mcp`;
/** Where the MCP endpoint's metadata lives: the well-known path with the resource's path after it. */
export const resourceMetadataUrl = (site: string) => `${site.replace(/\/$/, "")}/.well-known/oauth-protected-resource/api/mcp`;

export function resourceMetadata(site: string) {
  return {
    resource: mcpResource(site),
    authorization_servers: [authServer()],
    bearer_methods_supported: ["header"],
    resource_name: "Brazework",
    resource_documentation: `${site.replace(/\/$/, "")}/settings/tools`,
  };
}

/** Is the OAuth server switched on in Supabase (a founder's switch)? Checked at most every 5 minutes. */
export async function oauthEnabled(): Promise<boolean> {
  try {
    const r = await fetch(`${authServer()}/.well-known/oauth-authorization-server`, { next: { revalidate: 300 } });
    if (!r.ok) return false;
    const m = (await r.json()) as { authorization_endpoint?: string; registration_endpoint?: string };
    return Boolean(m.authorization_endpoint && m.registration_endpoint);
  } catch { return false; }
}

/** A JWT (an OAuth access token) rather than a forge_ token. */
export const looksLikeJwt = (t: string) => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t) && t.length < 4096;

/** The token row's hash for one sign-in: keyed with a server-only secret, so nobody can work it out. */
export function signInHash(secret: string, sub: string, client: string, session: string): string {
  return createHmac("sha256", `brazework-mcp-oauth:${secret}`).update(`${sub}|${client}|${session}`).digest("hex");
}

export type Linked = { ok: true; hash: string; scopes: string[] } | { ok: false; status: 401 | 503; message: string };

/** Check the access token with Supabase and find (or make) this sign-in's token row, as the member. */
export async function linkSignIn(jwt: string): Promise<Linked> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!secret) return { ok: false, status: 503, message: "Signing in from an assistant isn't set up on this Brazework yet. Use a token from Settings → Your tools." };
  const db = createSupabase(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data, error } = await db.auth.getClaims(jwt);
  const c = (data?.claims ?? {}) as { sub?: string; client_id?: string; session_id?: string };
  // Only tokens Supabase issued to an app through OAuth (they carry client_id), never a browser session's.
  if (error || !c.sub || !c.client_id) return { ok: false, status: 401, message: "Sign in to Brazework from your assistant again." };
  const hash = signInHash(secret, c.sub, c.client_id, c.session_id ?? "");
  const link = await db.rpc("mcp_oauth_link", { p_hash: hash });
  if (link.error) return link.error.code === "PGRST202"
    ? { ok: false, status: 503, message: "Signing in from an assistant isn't switched on on Brazework yet. Use a token from Settings → Your tools." }
    : { ok: false, status: 401, message: link.error.code === "P0001" ? link.error.message : "Sign in to Brazework from your assistant again." };
  if (!link.data) return { ok: false, status: 401, message: "You disconnected this assistant in Brazework → Settings → Your tools. Remove Brazework from your assistant and add it again to sign in." };
  return { ok: true, hash, scopes: ((link.data as { scopes?: string[] }).scopes ?? ["read"]) };
}
