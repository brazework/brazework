"use server";
import { redirect } from "next/navigation";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { canPostFor } from "./modes";

// The member's answer on the consent page (Supabase Auth's OAuth 2.1 server, supabase/mcp-oauth.sql).
// Approving remembers the app's name for Settings → Your tools and the member's choice of how it adds
// things (supabase/mcp-oauth-post.sql: after a yes in chat, or drafts only); either way Supabase says
// where to send the browser next (back to the assistant, with a code or with "access denied").
export async function decide(form: FormData): Promise<void> {
  const id = String(form.get("authorization_id") ?? "");
  const approve = form.get("decision") === "approve";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) redirect("/settings/tools?connect=invalid");
  const { supabase, user } = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);
  if (approve) {
    const { data: details } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (details && "client" in details) {
      const app = { p_client: details.client.id, p_name: details.client.name };
      await ((await dbFeatures()).mcpOauthPost
        ? supabase.rpc("remember_oauth_app", { ...app, p_can_post: canPostFor(form.get("mode")) })
        : supabase.rpc("remember_oauth_app", app));
    }
  }
  const { data, error } = approve ? await supabase.auth.oauth.approveAuthorization(id) : await supabase.auth.oauth.denyAuthorization(id);
  if (error || !data?.redirect_url) redirect("/settings/tools?connect=expired");
  redirect(data.redirect_url);
}
