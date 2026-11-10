"use server";
import { revalidatePath } from "next/cache";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Project teams (project_members, verification.sql): the owner adds and removes teammates; a teammate
// can leave. Teammates show on the project, and can't verify its milestones (the database checks).
export type TeamState = { ok: boolean; message: string };

export async function addTeammate(projectId: string, uid: string): Promise<TeamState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  if (!uid || uid === user.id) return { ok: false, message: "Pick a teammate." };
  const { error } = await supabase.from("project_members").insert({ project_id: projectId, uid });
  if (error) return { ok: false, message: error.code === "23505" ? "They're already on the team." : error.code === "42501" ? "Only the project's owner can add teammates." : friendlyError(error) };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: "Added to the team." };
}

export async function removeTeammate(projectId: string, uid: string): Promise<TeamState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data, error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("uid", uid).select("uid");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "You can't change this team." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: uid === user.id ? "You left the team." : "Removed from the team." };
}
