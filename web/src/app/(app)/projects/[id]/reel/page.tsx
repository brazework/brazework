import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { dbFeatures, milestoneCols, postSelect } from "@/lib/db-features";
import type { Post } from "@/lib/forge";
import type { MediaItem } from "@/lib/media";
import { buildReel } from "@/lib/reel";
import { getViewer } from "@/lib/supabase/server";
import type { Milestone } from "../../../u/[id]/milestones";
import { ReelPlayer } from "./player";

export const metadata: Metadata = { title: "Project reel" };

// The project reel (Linear FIX-68): the build told as a short, interactive story, from its real
// photos and video, specs, tools, team and the milestones its club verified. Same access as the
// project page: a private project's reel is only for its owner.
export default function ReelPage({ params }: PageProps<"/projects/[id]/reel">) {
  return <Suspense fallback={<div className="fixed inset-0 z-[90] bg-black" />}><Reel params={params} /></Suspense>;
}

type P = { id: string; title: string; summary: string; status: "in_progress" | "completed"; year: number | null; private: boolean; owner_id: string; tools?: string[]; profiles: { first_name: string; last_name: string } | null };

async function Reel({ params }: { params: PageProps<"/projects/[id]/reel">["params"] }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const f = await dbFeatures();
  const { data } = await supabase.from("projects").select(`id, title, summary, status, year, private, owner_id, profiles!projects_owner_id_fkey(first_name, last_name)${f.projectTools ? ", tools" : ""}`).eq("id", id).maybeSingle();
  const p = data as unknown as P | null;
  const own = p?.owner_id === user.id;
  if (!p || (p.private && !own)) notFound();

  const [det, ms, ups, teamRes] = await Promise.all([
    supabase.from("project_details").select(f.projectSpecs ? "details, specs" : "details").eq("project_id", id).maybeSingle(),
    f.milestones ? supabase.from("milestones").select(await milestoneCols()).eq("project_id", id).eq("status", "verified").order("reviewed_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    supabase.from("posts").select(await postSelect()).eq("project_id", id).eq("status", "visible").order("created_at", { ascending: true }).limit(30),
    f.verification ? supabase.from("project_members").select("profiles(first_name, last_name)").eq("project_id", id).limit(10) : Promise.resolve({ data: [] }),
  ]);
  const details = (det.data as unknown as { details?: string; specs?: { label: string; value: string }[] } | null) ?? {};
  // Proof shows what others may see: verified, and public unless it's your own reel.
  const proof = ((ms.data ?? []) as unknown as Milestone[]).filter((m) => own || !m.private);
  const posts = (ups.data ?? []) as unknown as Post[];
  const media = posts.flatMap((x) => ((x.media ?? []) as MediaItem[]).map((item) => ({ item, caption: item.alt || x.body.split("\n")[0] || "" })));
  const name = (q: { first_name: string; last_name: string } | null) => `${q?.first_name ?? ""} ${q?.last_name ?? ""}`.trim();
  const owner = name(p.profiles) || "A Brazework member";

  const scenes = buildReel({
    title: p.title, summary: p.summary ?? "", writeup: details.details ?? "", status: p.status, year: p.year,
    owner, club: proof[0]?.community_name ?? null,
    team: ((teamRes.data ?? []) as unknown as { profiles: { first_name: string; last_name: string } | null }[]).map((t) => name(t.profiles)).filter(Boolean),
    tools: p.tools ?? [], specs: (details.specs ?? []).filter((s) => s.label && s.value),
    media,
    proof: proof.map((m) => ({ title: m.title, detail: m.detail ?? "", by: m.reviewer_name || "an officer", club: m.community_name, on: m.achieved_on })),
  });
  return <ReelPlayer scenes={scenes} back={`/projects/${p.id}`} />;
}
