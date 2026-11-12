"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { GOAL_KINDS, type GoalKind } from "@/lib/goals";
import { getViewer } from "@/lib/supabase/server";

// Goals (supabase/goals.sql, Linear FIX-95): set, reach, drop. The database keeps one active goal per
// member and ticks the matching "Open to"; these validate and turn errors into sentences.

export type GoalState = { ok: boolean; message: string };
const reason = (e: { message?: string; code?: string }) => (e.code === "P0001" ? e.message ?? friendlyError(e) : friendlyError(e));
const kinds = Object.keys(GOAL_KINDS) as [GoalKind, ...GoalKind[]];
const goal = z.object({
  kind: z.enum(kinds, { message: "Pick what you're working toward." }),
  target: z.string().trim().max(80, "Keep what it's in under 80 characters.").refine((v) => !/[<>]/.test(v), "Leave out < and >."),
  visible: z.boolean(),
});

export async function setGoal(kind: string, target: string, visible: boolean): Promise<GoalState> {
  const v = goal.safeParse({ kind, target, visible });
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("set_goal", { p_kind: v.data.kind, p_target: v.data.target, p_visible: v.data.visible });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/feed");
  return { ok: true, message: "Goal set. Your path is below." };
}

export async function reachGoal(note: string): Promise<GoalState> {
  const n = z.string().trim().max(160, "Keep it under 160 characters.").safeParse(note);
  if (!n.success) return { ok: false, message: n.error.issues[0]?.message ?? "Check the note." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("reach_goal", { p_note: n.data });
  if (error) return { ok: false, message: reason(error) };
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/feed");
  return { ok: true, message: "Congratulations. It's on your profile." };
}

export async function dropGoal(): Promise<GoalState> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.rpc("drop_goal");
  if (error) return { ok: false, message: reason(error) };
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/feed");
  return { ok: true, message: "Goal cleared." };
}
