"use server";
import { redirect } from "next/navigation";
import { dbFeatures } from "@/lib/db-features";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Chapters (supabase/chapters.sql, Linear FIX-71): a club at a school that belongs to a national
// network ("NSBE - University of Hartford" under NSBE National).
export type Network = { id: string; name: string; short: string; slug: string | null };
export type ChapterSetup = { school: { domain: string; school: string } | null; networks: Network[] };

// What "Start a chapter" needs: your school (from your email) and the networks to pick from.
export async function chapterSetup(): Promise<ChapterSetup | null> {
  if (!(await dbFeatures()).chapters) return null;
  const { supabase } = await getViewer();
  const [school, nets] = await Promise.all([supabase.rpc("my_school"), supabase.rpc("list_networks")]);
  return { school: (school.data as ChapterSetup["school"]) ?? null, networks: (nets.data as Network[] | null) ?? [] };
}

// Starts the chapter, makes its first invite link, and opens the chapter on "Invite your chapter".
export async function startChapter(network: string, privacy: "public" | "approval"): Promise<{ ok: false; message: string }> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(network)) return { ok: false, message: "Pick a national organization." };
  if (privacy !== "public" && privacy !== "approval") return { ok: false, message: "Choose who can join." };
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login?next=/chapters/new");
  const { data, error } = await supabase.rpc("create_chapter", { p_network: network, p_privacy: privacy });
  if (error || !data) return { ok: false, message: error?.code === "P0001" || error?.code === "42501" ? error.message : friendlyError(error) };
  const cid = String(data);
  const invite = await supabase.from("community_invites").insert({ community_id: cid }).select("code").single();
  redirect(`/c/${encodeURIComponent(cid)}?created=chapter${invite.data?.code ? `&invite=${invite.data.code}` : ""}`);
}
