import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { getViewer } from "@/lib/supabase/server";
import { SponsorshipDecision } from "../challenges/challenge-client";
import { ResolveReport } from "@/components/report/report-dialog";
import { SchoolDecision } from "../../request-school/form";

export const metadata: Metadata = { title: "Forge admin" };

type Metrics = {
  members: number; onboarded: number; weekly_active: number; in_a_club: number; with_project: number; with_verified: number;
  submitted_30d: number; verified_30d: number; median_hours_to_verify: number | null;
  clubs: number; clubs_active_7d: number; handoffs: number; top_clubs: { id: string; name: string; posts: number; members: number }[];
  companies: number; challenges_live: number; challenge_entries: number; sponsorships_paid: number; sponsorships_pilot: number; open_queue: number;
};

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

// Forge admins only (the database refuses everyone else; this page 404s for them too).
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl xl:max-w-5xl"><PageHeader title="Forge admin" /><Skeleton className="mt-6 h-96" /></div>}>
      <Admin />
    </Suspense>
  );
}

async function Admin() {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_forge_admin");
  if (!isAdmin) notFound();
  const [{ data: m }, { data: requests }, { data: queue }, { data: reportRows }, { data: schoolRows }] = await Promise.all([
    supabase.rpc("admin_metrics"),
    supabase.from("challenges").select("id, title, prize, deadline, organizations(name)").eq("sponsorship", "requested").order("created_at", { ascending: true }).limit(50),
    supabase.from("admin_queue").select("id, kind, subject_id, detail, created_at").eq("status", "open").order("created_at", { ascending: true }).limit(50),
    supabase.from("content_reports").select("id, kind, target_id, reason, detail, reported, created_at").eq("status", "open").order("created_at", { ascending: true }).limit(50),
    supabase.from("school_requests").select("id, domain, school, contact, asks, created_at").eq("status", "open").order("asks", { ascending: false }).limit(50),
  ]);
  const schools = (schoolRows ?? []) as { id: number; domain: string; school: string; contact: string; asks: number; created_at: string }[];
  type Report = { id: number; kind: string; target_id: string; reason: string; detail: string; reported: string | null; created_at: string };
  const reports = (reportRows ?? []) as Report[];
  // Who was reported, and where a milestone lives (its project page), for the links.
  const reportedIds = [...new Set(reports.map((r) => r.reported).filter((x): x is string => !!x))];
  const msIds = reports.filter((r) => r.kind === "milestone").map((r) => r.target_id);
  const [{ data: reportedPeople }, { data: msRows }] = await Promise.all([
    reportedIds.length ? supabase.from("profiles").select("id, first_name, last_name").in("id", reportedIds) : Promise.resolve({ data: [] }),
    msIds.length ? supabase.from("milestones").select("id, project_id").in("id", msIds) : Promise.resolve({ data: [] }),
  ]);
  const personName = new Map((reportedPeople ?? []).map((p) => [p.id as string, `${p.first_name} ${p.last_name}`.trim()]));
  const msProject = new Map((msRows ?? []).map((r) => [r.id as string, r.project_id as string]));
  const reportHref = (r: Report) => ({ post: `/post/${r.target_id}`, person: `/u/${r.target_id}`, project: `/projects/${r.target_id}`, challenge: `/challenges/${r.target_id}`, milestone: msProject.get(r.target_id) ? `/projects/${msProject.get(r.target_id)}` : "" } as Record<string, string>)[r.kind] ?? "";
  const x = m as Metrics | null;
  const reqs = (requests ?? []) as unknown as { id: string; title: string; prize: string; organizations: { name: string } | null }[];

  // The loop, as a funnel: each step's share of members.
  const funnel = x ? [
    ["Members", x.members], ["Finished onboarding", x.onboarded], ["In a club", x.in_a_club], ["Has a project", x.with_project], ["Has verified work", x.with_verified],
  ] as const : [];
  const tiles = x ? [
    ["Weekly active", `${x.weekly_active}`, pct(x.weekly_active, x.members) + " of members"],
    ["Verified (30 days)", `${x.verified_30d}`, `of ${x.submitted_30d} submitted`],
    ["Median time to verify", x.median_hours_to_verify == null ? "–" : `${x.median_hours_to_verify} h`, "submission to badge"],
    ["Clubs active this week", `${x.clubs_active_7d}`, `of ${x.clubs} · ${x.handoffs} handoffs`],
    ["Verified companies", `${x.companies}`, `${x.challenges_live} live challenges · ${x.challenge_entries} entries`],
    ["Sponsorships", `${x.sponsorships_paid} paid`, `${x.sponsorships_pilot} pilots`],
  ] : [];

  return (
    <div className="mx-auto max-w-3xl xl:max-w-5xl">
      <PageHeader title="Forge admin" subtitle="Whether the loop works, and what's waiting on the Forge team." />

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Metrics">
        {tiles.map(([label, value, sub]) => (
          <Panel key={label} className="p-4">
            <p className="text-xs text-faint">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-0.5 text-xs text-muted">{sub}</p>
          </Panel>
        ))}
      </section>

      {x && (
        <Panel className="mt-4 p-5">
          <Kicker>The loop</Kicker>
          <ol className="mt-3 flex flex-col gap-2">
            {funnel.map(([label, n]) => (
              <li key={label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-text-2">{label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-accent" style={{ width: pct(n, x.members) === "–" ? "0%" : pct(n, x.members) }} /></span>
                <span className="w-20 text-right tabular-nums">{n} <span className="text-faint">{pct(n, x.members)}</span></span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <section className="mt-8">
        <Kicker>Sponsorship requests · {reqs.length}</Kicker>
        <div className="mt-3 flex flex-col gap-2">
          {reqs.map((r) => (
            <Panel key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/challenges/${r.id}`} className="block truncate font-medium hover:underline">{r.title}</Link>
                <p className="truncate text-xs text-muted">{r.organizations?.name ?? "Sponsor"}{r.prize ? ` · ${r.prize}` : ""}</p>
              </div>
              <SponsorshipDecision id={r.id} />
            </Panel>
          ))}
          {!reqs.length && <p className="text-sm text-muted">Nothing waiting.</p>}
        </div>
      </section>

      <section className="mt-8" aria-label="School requests">
        <Kicker>School requests · {schools.length}</Kicker>
        <p className="mt-1 text-xs text-faint">Check the domain belongs to a real school before adding it: its students can then sign up with it.</p>
        <div className="mt-3 flex flex-col gap-2">
          {schools.map((r) => (
            <Panel key={r.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.school} <span className="font-mono text-xs font-normal text-muted">@{r.domain}</span></p>
                <p className="text-xs text-faint">{r.asks} {r.asks === 1 ? "request" : "requests"}{r.contact ? ` · ${r.contact}` : ""}</p>
              </div>
              <SchoolDecision id={r.id} />
            </Panel>
          ))}
          {!schools.length && <p className="text-sm text-muted">No schools waiting.</p>}
        </div>
      </section>

      <section className="mt-8" aria-label="Reports">
        <Kicker>Reports · {reports.length}</Kicker>
        <div className="mt-3 flex flex-col gap-2">
          {reports.map((r) => (
            <Panel key={r.id} className="flex flex-wrap items-start gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {r.kind.replace("_", " ")} · {r.reason}
                  {r.reported && <span className="font-normal text-muted"> · by {personName.get(r.reported) ?? "a member"}</span>}
                  <span className="ml-2 text-xs font-normal text-faint">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
                </p>
                {r.detail && <p className="mt-1 text-text-2">{r.detail}</p>}
                {reportHref(r) && <Link href={reportHref(r)} className="mt-1 inline-block text-xs text-muted underline hover:text-text">Open what was reported</Link>}
              </div>
              <ResolveReport id={r.id} />
            </Panel>
          ))}
          {!reports.length && <p className="text-sm text-muted">No open reports.</p>}
        </div>
      </section>

      <section className="mt-8">
        <Kicker>Review queue · {queue?.length ?? 0}</Kicker>
        <div className="mt-3 flex flex-col gap-2">
          {(queue ?? []).map((q) => (
            <Panel key={q.id as number} className="p-4 text-sm">
              <span className="font-medium">{({ dispute: "Escalated dispute", verify_outlier: "Unusual verification volume", duplicate_club: "Possible duplicate club", report: "Report" } as Record<string, string>)[q.kind as string] ?? q.kind}</span>
              <span className="ml-2 text-xs text-faint">{new Date(q.created_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
              {q.detail && <p className="mt-1 text-text-2">{q.detail as string}</p>}
            </Panel>
          ))}
          {!queue?.length && <EmptyState title="The queue is clear" body="Escalated disputes and unusual verification patterns land here." />}
        </div>
      </section>
    </div>
  );
}
