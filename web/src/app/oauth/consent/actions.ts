"use server";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";

// The member's answer on the consent page (Supabase Auth's OAuth 2.1 server, supabase/mcp-oauth.sql).
// Approving remembers the app's name for Settings → Your tools; either way Supabase says where to send
// the browser next (back to the assistant, with a code or with "access denied").
export async function decide(form: FormData): Promise<void> {
  const id = String(form.get("authorization_id") ?? "");
  const approve = form.get("decision") === "approve";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) redirect("/settings/tools?connect=invalid");
  const { supabase, user } = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);
  if (approve) {
    const { data: details } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (details && "client" in details) await supabase.rpc("remember_oauth_app", { p_client: details.client.id, p_name: details.client.name });
  }
  const { data, error } = approve ? await supabase.auth.oauth.approveAuthorization(id) : await supabase.auth.oauth.denyAuthorization(id);
  if (error || !data?.redirect_url) redirect("/settings/tools?connect=expired");
  redirect(data.redirect_url);
}
