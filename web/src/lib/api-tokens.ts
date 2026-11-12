"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { dbFeatures } from "@/lib/db-features";
import { friendlyError } from "@/lib/forge";
import { tokenHash } from "@/lib/mcp";
import { getViewer } from "@/lib/supabase/server";

// Personal tokens for AI tools (supabase/mcp.sql). The token is shown once; only its hash is kept.
export type ApiToken = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

export async function listApiTokens(): Promise<ApiToken[]> {
  if (!(await dbFeatures()).mcp) return [];
  const { supabase, user } = await getViewer();
  if (!user) return [];
  const { data } = await supabase.from("api_tokens").select("id, name, prefix, created_at, last_used_at, revoked_at").order("created_at", { ascending: false }).limit(20);
  return (data ?? []) as ApiToken[];
}

export async function createApiToken(name: string): Promise<{ ok: boolean; message: string; token?: string; id?: string }> {
  const label = name.replace(/[<>]/g, "").trim().slice(0, 60);
  if (!label) return { ok: false, message: "Give the token a name, like the app you'll use it in." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const token = `forge_${randomBytes(30).toString("base64url")}`;
  const { data, error } = await supabase.rpc("create_api_token", { p_name: label, p_hash: tokenHash(token), p_prefix: token.slice(0, 12) });
  if (error) return { ok: false, message: error.code === "P0001" ? error.message : friendlyError(error) };
  revalidatePath("/settings");
  revalidatePath("/settings/tools");
  return { ok: true, message: "", token, id: (data as string | null) ?? undefined };
}

export async function revokeApiToken(id: string): Promise<{ ok: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  const { supabase } = await getViewer();
  const { error } = await supabase.rpc("revoke_api_token", { p_id: id });
  revalidatePath("/settings");
  return { ok: !error };
}
