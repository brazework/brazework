"use server";
import { revalidatePath } from "next/cache";
import { dbFeatures } from "@/lib/db-features";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Project teams (project_members, verification.sql; roles from project-access.sql, step 55).
// - admin: manages the team like the owner (but not other admins)
// - member: a teammate who builds (posts updates and files, logs milestones)
// - viewer: can see a private project; changes nothing
// The owner adds and removes anyone and sets roles; an admin adds and removes teammates and viewers;
// anyone can leave. People on a project never verify its milestones (the database checks).
export type TeamState = { ok: boolean; message: string };
export type TeamRole = "admin" | "member" | "viewer";
const ROLES: TeamRole[] = ["admin", "member", "viewer"];
const LABEL: Record<TeamRole, string> = { admin: "an admin", member: "a teammate", viewer: "a viewer" };

export async function addTeammate(projectId: string, uid: string, role: TeamRole = "member"): Promise<TeamState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  if (!uid || uid === user.id) return { ok: false, message: "Pick someone to add." };
  if (!ROLES.includes(role)) return { ok: false, message: "Pick a role." };
  const withRole = (await dbFeatures()).projectAccess;
  const { error } = await supabase.from("project_members").insert({ project_id: projectId, uid, ...(withRole ? { role } : {}) });
  if (error) return { ok: false, message: error.code === "23505" ? "They're already on this project." : error.code === "42501" ? (role === "admin" ? "Only the project's owner can add admins." : "Only the project's owner or an admin can add people.") : friendlyError(error) };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: `Added as ${withRole ? LABEL[role] : "a teammate"}.` };
}

export async function setTeamRole(projectId: string, uid: string, role: TeamRole): Promise<TeamState> {
  if (!ROLES.includes(role)) return { ok: false, message: "Pick a role." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("project_members").update({ role }).eq("project_id", projectId).eq("uid", uid).select("uid");
  if (error) return { ok: false, message: error.code === "42501" ? "Only the project's owner can make or change admins." : friendlyError(error) };
  if (!data?.length) return { ok: false, message: "You can't change their role." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: `Now ${LABEL[role]}.` };
}

export async function removeTeammate(projectId: string, uid: string): Promise<TeamState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("uid", uid).select("uid");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "You can't change this team." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: uid === user.id ? "You left the project." : "Removed." };
}
