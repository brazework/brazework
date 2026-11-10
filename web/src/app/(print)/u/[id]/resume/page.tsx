import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { linkName, openToLabel, type ProfileLink } from "@/lib/profile-meta";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Résumé" };

// A one-page proof résumé, built from the profile: club-verified work first, then projects, clubs
// and skills. Paper colours on screen and in print; "Save as PDF" is the browser's print dialog.
export default function ResumePage({ params }: PageProps<"/u/[id]/resume">) {
  return (
    <div className="min-h-dvh bg-zinc-100 py-8 print:bg-white print:py-0">
      <Suspense fallback={<div className="mx-auto h-[1000px] max-w-[816px] animate-pulse bg-white" />}>
        <Resume params={params} />
      </Suspense>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-7 border-b border-zinc-300 pb-1 text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">{children}</h2>;
}

type Proj = { id: string; title: string; summary: string; status: string; year: number | null; private: boolean; tools?: string[] };
type Ms = { id: string; project_id: string; community_name: string; title: string; achieved_on: string; reviewer_name: string };

async function Resume({ params }: { params: PageProps<"/u/[id]/resume">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const own = user.id === id;
  const f = await dbFeatures();
  const [pr, projRes, msRes, clubRes] = await Promise.all([
    supabase.from("profiles").select(`id, first_name, last_name, account_type, headline, bio, field${f.profileExtras ? ", open_to, links, location" : ""}`).eq("id", id).maybeSingle(),
    supabase.from("projects").select(f.projectTools ? "id, title, summary, status, year, private, tools" : "id, title, summary, status, year, private").eq("owner_id", id).order("updated_at", { ascending: false }).limit(30),
    f.milestones ? supabase.from("milestones").select("id, project_id, community_name, title, achieved_on, reviewer_name").eq("owner_id", id).eq("status", "verified").order("achieved_on", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
    supabase.from("community_members").select("role, communities(name)").eq("uid", id).limit(12),
  ]);
  if (!pr.data) notFound();
  const p = pr.data as unknown as { first_name: string; last_name: string; account_type: string; headline: string; bio: string; field: string; open_to?: string[]; links?: ProfileLink[]; location?: string };
  const projects = ((projRes.data ?? []) as unknown as Proj[]).filter((x) => own || !x.private);
  const titles = new Map(projects.map((x) => [x.id, x.title]));
  const proof = ((msRes.data ?? []) as Ms[]).filter((m) => titles.has(m.project_id));
  const clubs = ((clubRes.data ?? []) as unknown as { role: string; communities: { name: string } | null }[]).filter((c) => c.communities);
  const skills = [...projects.flatMap((x) => x.tools ?? []).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 16);
  const when = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const name = `${p.first_name} ${p.last_name}`.trim() || "Brazework member";

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[816px] justify-end gap-2 px-4 print:hidden">
        <a href={`/u/${id}`} className="rounded-full px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-200">Back to profile</a>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[816px] bg-white px-14 py-12 text-[13px] leading-relaxed text-zinc-800 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header>
          <h1 className="text-[28px] font-semibold tracking-tight text-zinc-950">{name}</h1>
          {p.headline && <p className="mt-0.5 text-[15px] text-zinc-700">{p.headline}</p>}
          <p className="mt-2 flex flex-wrap gap-x-3 text-zinc-500">
            <span>{p.account_type === "student" ? "Student" : "Professional"}{p.field && ` · ${p.field}`}</span>
            {p.location && <span>{p.location}</span>}
            {(p.links ?? []).map((l) => <a key={l.url} href={l.url} className="text-zinc-700 underline underline-offset-2">{linkName(l)}</a>)}
          </p>
          {(p.open_to ?? []).length > 0 && <p className="mt-2 text-zinc-700">Open to {(p.open_to ?? []).map(openToLabel).join(", ").toLowerCase()}.</p>}
        </header>
        {p.bio && <p className="mt-5 whitespace-pre-wrap text-zinc-700">{p.bio}</p>}

        {proof.length > 0 && (
          <>
            <H>Club-verified work</H>
            <ul className="mt-3 space-y-2.5">
              {proof.map((m) => (
                <li key={m.id} className="grid grid-cols-[1fr_auto] gap-x-4">
                  <span><strong className="font-semibold text-zinc-950">{m.title}</strong> <span className="text-zinc-500">· {titles.get(m.project_id)}</span></span>
                  <span className="text-zinc-500">{when(m.achieved_on)}</span>
                  <span className="col-span-2 text-[12px] text-zinc-500">Verified by {m.community_name}{m.reviewer_name && ` (${m.reviewer_name})`}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {projects.length > 0 && (
          <>
            <H>Projects</H>
            <ul className="mt-3 space-y-3.5">
              {projects.map((x) => (
                <li key={x.id} className="break-inside-avoid">
                  <div className="flex justify-between gap-4"><strong className="font-semibold text-zinc-950">{x.title}</strong><span className="shrink-0 text-zinc-500">{x.status === "completed" ? `Completed${x.year ? ` ${x.year}` : ""}` : "In progress"}</span></div>
                  <p className="text-zinc-700">{x.summary}</p>
                  {(x.tools ?? []).length > 0 && <p className="mt-0.5 text-[12px] text-zinc-500">Built with {(x.tools ?? []).join(", ")}</p>}
                </li>
              ))}
            </ul>
          </>
        )}

        {clubs.length > 0 && (
          <>
            <H>Clubs</H>
            <p className="mt-3 text-zinc-700">{clubs.map((c) => `${c.communities!.name}${c.role !== "member" ? ` (${c.role})` : ""}`).join(" · ")}</p>
          </>
        )}
        {skills.length > 0 && (
          <>
            <H>Skills from their work</H>
            <p className="mt-3 text-zinc-700">{skills.join(" · ")}</p>
          </>
        )}
        <footer className="mt-10 border-t border-zinc-200 pt-3 text-[11px] text-zinc-400">Verified work is checked by the named club on Brazework. Full profile: /u/{id}</footer>
      </article>
    </>
  );
}
