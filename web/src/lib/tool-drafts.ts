"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Drafts your tools left for you (supabase/mcp-workflows.sql, docs/mcp-workflows.md). The database
// decides what's allowed: approving checks the draft again and makes it as you, under the app's rules.
export type ToolDraft = {
  id: string; kind: "post" | "milestone"; via: string; source: string; created_at: string;
  payload: { body?: string; kind?: string; tags?: string[]; title?: string; detail?: string; evidence?: { type: string; url: string }[]; achieved_on?: string; project_id?: string | null; club_id?: string | null };
};
export type DraftResult = { ok: boolean; message: string; url?: string };

const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" ? e.message ?? friendlyError(e) : e.code === "42501" ? "That draft isn't yours." : friendlyError(e));
const idOk = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function approveDraft(id: string, edit: { body?: string; title?: string; detail?: string }): Promise<DraftResult> {
  if (!idOk(id)) return { ok: false, message: "That draft isn't yours." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.rpc("approve_tool_draft", { p_id: id, p_body: edit.body ?? null, p_title: edit.title ?? null, p_detail: edit.detail ?? null });
  if (error) return { ok: false, message: reason(error) };
  const r = data as { kind: string; url: string; status: string };
  revalidatePath("/drafts");
  revalidatePath("/feed");
  return {
    ok: true, url: r.url,
    message: r.kind === "post" ? "Posted." : r.status === "pending" ? "Logged. Your club's officers have been asked to verify it." : "Logged. Ask the person who saw it to vouch for it from the project.",
  };
}

export async function dismissDraft(id: string): Promise<DraftResult> {
  if (!idOk(id)) return { ok: false, message: "That draft isn't yours." };
  const { supabase } = await getViewer();
  const { data, error } = await supabase.rpc("dismiss_tool_draft", { p_id: id });
  if (error || data !== true) return { ok: false, message: error ? reason(error) : "That draft was already handled." };
  revalidatePath("/drafts");
  return { ok: true, message: "Dismissed." };
}
