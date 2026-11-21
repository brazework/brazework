"use server";
import { mailer } from "@/lib/email";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { requestVouch } from "@/lib/vouches";

// Drafts your tools left for you (supabase/mcp-workflows.sql, docs/mcp-workflows.md). The database
// decides what's allowed: approving checks the draft again and makes it as you, under the app's rules.
export type ToolDraft = {
  id: string; kind: string; via: string; source: string; created_at: string;
  payload: Record<string, unknown> & { body?: string; kind?: string; tags?: string[]; title?: string; detail?: string; evidence?: { type: string; url: string }[]; achieved_on?: string; project_id?: string | null; club_id?: string | null };
};
export type DraftResult = { ok: boolean; message: string; url?: string };
/** A post or milestone draft: the two kinds Today's triage decides (other kinds wait on /drafts). */
export type TriageDraft = ToolDraft & { kind: "post" | "milestone" };

const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" ? e.message ?? friendlyError(e) : e.code === "42501" ? "That draft isn't yours." : friendlyError(e));
const idOk = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const RETRY = "We couldn't check your sign-in just now. Try again in a moment.";

// Each action answers its own card. getViewer() throws when the sign-in server is briefly busy (so a
// page shows "try again" rather than signing people out); here that becomes a message on the card,
// so one draft's hiccup never takes the whole Drafts page down.
async function viewerOrRetry() {
  try { return await getViewer(); } catch { return null; }
}
async function settle(run: () => Promise<DraftResult>): Promise<DraftResult> {
  try { return await run(); } catch { return { ok: false, message: "That didn't go through. Try again." }; }
}

export async function approveDraft(id: string, edit: { body?: string; title?: string; detail?: string }): Promise<DraftResult> {
  if (!idOk(id)) return { ok: false, message: "That draft isn't yours." };
  return settle(async () => {
  const v = await viewerOrRetry();
  if (!v) return { ok: false, message: RETRY };
  const { supabase, user } = v;
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("approve_tool_draft", { p_id: id, p_body: edit.body ?? null, p_title: edit.title ?? null, p_detail: edit.detail ?? null });
  if (error) return { ok: false, message: reason(error) };
  const r = data as { kind: string; url: string; status: string };
  // No revalidatePath: it would refresh this page and take the card (and what happened) away. Every
  // page that shows drafts is rendered per request, so the next visit is current.
  return {
    ok: true, url: r.url,
    message: r.kind === "post" ? "Posted." : r.status === "pending" ? "Logged. Your club's officers have been asked to verify it." : "Logged. Ask the person who saw it to vouch for it from the project.",
  };
  });
}

export async function dismissDraft(id: string): Promise<DraftResult> {
  if (!idOk(id)) return { ok: false, message: "That draft isn't yours." };
  return settle(async () => {
  const v = await viewerOrRetry();
  if (!v) return { ok: false, message: RETRY };
  const { data, error } = await v.supabase.rpc("dismiss_tool_draft", { p_id: id });
  if (error || data !== true) return { ok: false, message: error ? reason(error) : "That draft was already handled." };
  return { ok: true, message: "Dismissed." };
  });
}

// ---------- Daily triage on Today (supabase/daily-triage.sql) ----------
export type TriageResult = { ok: boolean; message: string; url?: string; status?: string };

/** Keep (a post goes as drafted; a milestone waits on its project for proof) or send to a club. */
export async function triageDraft(id: string, action: "keep" | "club", club?: string | null): Promise<TriageResult> {
  if (!idOk(id) || (action !== "keep" && action !== "club")) return { ok: false, message: "That draft isn't yours." };
  if (club != null && !/^[A-Za-z0-9_-]{1,64}$/.test(club)) return { ok: false, message: "Pick one of your clubs." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("triage_tool_draft", { p_id: id, p_action: action, p_club: club ?? null });
  if (error) return { ok: false, message: reason(error) };
  const r = data as { kind: string; id: string; url: string; status: string };
  // No revalidatePath, as in approveDraft: the card says what happened, and Today is rendered per request.
  return { ok: true, message: "", url: r.url, status: r.status };
}

/**
 * Ask to sign: keep the milestone on its project, then ask the person who saw it, through
 * request_vouch() and every guard in vouches.sql. Email and the address are checked first, so a draft
 * is never used up on an ask that can't go out.
 */
export async function askToSignDraft(id: string, email: string, relationship: string): Promise<TriageResult> {
  if (!idOk(id)) return { ok: false, message: "That draft isn't yours." };
  const addr = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr) || addr.length > 254) return { ok: false, message: "Enter their email address." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  if (!mailer().enabled) return { ok: false, message: "Email isn't available right now, so we can't send the ask. Keep it and ask later." };
  const { data: okAddr } = await supabase.rpc("vouch_email_ok", { p_email: addr });
  if (okAddr !== true) return { ok: false, message: "Use the email they really use: a throwaway inbox can't sign." };
  const kept = await triageDraft(id, "keep");
  if (!kept.ok) return kept;
  const { data: d } = await supabase.from("tool_drafts").select("result_id").eq("id", id).maybeSingle();
  const asked = d?.result_id ? await requestVouch(d.result_id as string, addr, relationship, true) : { ok: false, message: "We couldn't find the milestone." };
  return asked.ok
    ? { ok: true, url: kept.url, status: "pending", message: asked.message }
    : { ok: true, url: kept.url, status: "draft", message: `Kept on your project, but the ask didn't go: ${asked.message} Ask again from the project.` };
}

// A tool's draft whose card ran the app's own action (supabase/tool-actions.sql): mark it done.
export async function settleDraft(id: string): Promise<DraftResult> {
  if (!idOk(id)) return { ok: false, message: "That draft isn't yours." };
  return settle(async () => {
  const v = await viewerOrRetry();
  if (!v) return { ok: false, message: RETRY };
  const { data, error } = await v.supabase.rpc("settle_tool_draft", { p_id: id });
  if (error || data !== true) return { ok: false, message: error ? reason(error) : "That draft was already handled." };
  return { ok: true, message: "Done." };
  });
}
