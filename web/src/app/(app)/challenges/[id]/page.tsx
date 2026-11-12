import type { Metadata } from "next";
import { ReportLink } from "@/components/report/report-dialog";
import { ArrowLeft, BadgeCheck, Building2, CalendarClock, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Panel, Skeleton } from "@/components/app/page-ui";
import { Avatar, Kicker } from "@/components/ui";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { LocalTime } from "../../events/local-time";
import { EnterForm, PlaceButtons, SponsorControls, WithdrawButton } from "../challenge-client";
import { PLACE, SPONSOR_LABEL, STATUS_LABEL, daysLeft, type Challenge } from "../shared";

export const metadata: Metadata = { title: "Challenge" };

type Entry = { id: number; project_id: string; uid: string; note: string; placement: number | null; created_at: string; projects: { title: string } | null };

export default function ChallengePage({ params }: PageProps<"/challenges/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl"><Skeleton className="mt-10 h-48" /><Skeleton className="mt-4 h-64" /></div>}>
      <ChallengeView params={params} />
    </Suspense>
  );
}

async function ChallengeView({ params }: { params: PageProps<"/challenges/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data } = await supabase.from("challenges").select("id, org_id, title, brief, prize, topic, deadline, status, sponsorship, organizations(name)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as unknown as Challenge;

  const [{ data: admin }, { data: entryRows }, { data: counts }, { data: myProjects }] = await Promise.all([
    supabase.from("organization_admins").select("org_id").eq("uid", user.id).eq("org_id", c.org_id).limit(1),
    // What this viewer may see: their own entry, every entry (sponsor) or the winners (once closed).
    supabase.from("challenge_entries").select("id, project_id, uid, note, placement, created_at, projects(title)").eq("challenge_id", id).order("created_at", { ascending: true }).limit(500),
    supabase.rpc("challenge_entry_counts", { p_ids: [id] }),
    supabase.from("projects").select("id, title").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const isSponsor = !!admin?.length;
  const entries = (entryRows ?? []) as unknown as Entry[];
  const total = Number((counts as { entries: number }[] | null)?.[0]?.entries ?? 0);
  const mine = entries.find((e) => e.uid === user.id);
  const shown = isSponsor ? entries : entries.filter((e) => e.placement != null);
  // Names, plus each entry's verified milestones (what makes Brazework entries worth judging).
  const uids = [...new Set(shown.map((e) => e.uid))];
  const pids = [...new Set(shown.map((e) => e.project_id))];
  const [{ data: people }, { data: verified }] = await Promise.all([
    uids.length ? supabase.from("profiles").select("id, first_name, last_name, headline").in("id", uids) : Promise.resolve({ data: [] }),
    pids.length ? supabase.from("milestones").select("project_id").eq("status", "verified").in("project_id", pids) : Promise.resolve({ data: [] }),
  ]);
  const who = new Map((people ?? []).map((p) => [p.id as string, p as { id: string; first_name: string; last_name: string; headline: string }]));
  const vcount = (pid: string) => (verified ?? []).filter((m) => m.project_id === pid).length;
  const now = requestTime();
  const left = daysLeft(c.deadline, now);
  const canEnter = c.status === "open" && Date.parse(c.deadline) > now && !mine && !isSponsor;
  const enterable = (myProjects ?? []).filter((p) => !entries.some((e) => e.project_id === p.id));
  const sorted = [...shown].sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/challenges" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Challenges</Link>
      <header className="glass-card relative mt-4 overflow-hidden rounded-3xl p-6">
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
            <span className="inline-flex items-center gap-1"><Building2 className="size-3.5" /> {c.organizations?.name ?? "Sponsor"}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-2">{STATUS_LABEL[c.status]}</span>
            {isSponsor && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-2">{SPONSOR_LABEL[c.sponsorship]}</span>}
          </div>
          <h1 className="text-grad mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{c.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-2">
            {c.prize && <span className="inline-flex items-center gap-1.5 font-medium text-text"><Trophy className="size-4" /> {c.prize}</span>}
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" /> Due <LocalTime kind="full-clock" value={c.deadline} />{c.status === "open" ? ` · ${left} ${left === 1 ? "day" : "days"} left` : ""}</span>
            <span>{total} {total === 1 ? "entry" : "entries"}</span>
            {!isSponsor && <ReportLink kind="challenge" id={c.id} label="this challenge" />}
          </div>
          {isSponsor && <div className="mt-5"><SponsorControls id={c.id} status={c.status} sponsorship={c.sponsorship} entries={total} /></div>}
        </div>
      </header>

      <Panel className="mt-4 p-6">
        <Kicker>The brief</Kicker>
        <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-text-2">{c.brief}</p>
      </Panel>

      {mine && (
        <Panel className="mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <Kicker>Your entry</Kicker>
            <Link href={`/projects/${mine.project_id}`} className="mt-1 block truncate font-semibold hover:underline">{mine.projects?.title ?? "Your project"}</Link>
            <p className="text-sm text-muted">{mine.placement ? `You placed ${PLACE[mine.placement - 1]}.` : c.status === "open" ? "Keep adding verified milestones: the sponsor sees them when judging." : "Entries are closed. Winners are announced here."}</p>
          </div>
          {c.status === "open" && !mine.placement && <WithdrawButton challengeId={c.id} entryId={mine.id} />}
        </Panel>
      )}

      {canEnter && (
        <Panel className="mt-4 p-6">
          <Kicker>Enter</Kicker>
          <p className="mt-1 mb-4 text-sm text-muted">Enter a project you own. The sponsor sees it with every milestone your club verified.</p>
          <EnterForm challengeId={c.id} projects={enterable.map((p) => ({ id: p.id as string, title: p.title as string }))} />
        </Panel>
      )}

      {(isSponsor || c.status === "closed") && (
        <section className="mt-6">
          <Kicker>{isSponsor ? `Entries · ${shown.length}` : "Winners"}</Kicker>
          {isSponsor && c.status === "judging" && <p className="mt-1 text-xs text-faint">Pick up to three places, then announce the winners.</p>}
          <div className="mt-3 flex flex-col gap-2">
            {sorted.map((e) => {
              const p = who.get(e.uid);
              const v = vcount(e.project_id);
              return (
                <article key={e.id} className="glass-card flex flex-wrap items-center gap-3 rounded-2xl p-4">
                  {e.placement && <span className="bg-accent-grad grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-on-accent">{PLACE[e.placement - 1]}</span>}
                  <Avatar first={p?.first_name ?? ""} last={p?.last_name ?? ""} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/projects/${e.project_id}`} className="block truncate font-medium hover:underline">{e.projects?.title ?? "Private project"}</Link>
                    <p className="truncate text-xs text-muted">
                      <Link href={`/u/${e.uid}`} className="hover:text-text hover:underline">{p ? `${p.first_name} ${p.last_name}` : "Member"}</Link>
                      {v > 0 && <span className="ml-2 inline-flex items-center gap-0.5 text-ok"><BadgeCheck className="size-3" /> {v} verified</span>}
                    </p>
                    {isSponsor && e.note && <p className="mt-1 line-clamp-2 text-sm text-text-2">{e.note}</p>}
                  </div>
                  {isSponsor && c.status === "judging" && <PlaceButtons challengeId={c.id} entryId={e.id} placement={e.placement} />}
                </article>
              );
            })}
            {!sorted.length && <p className="text-sm text-muted">{isSponsor ? (c.status === "draft" ? "Entries appear here once it's live." : "No entries yet.") : "No winners announced."}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
