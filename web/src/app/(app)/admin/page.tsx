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
import { ClaimDecision } from "@/components/clubs/claim";
import { dbFeatures } from "@/lib/db-features";
import { SchoolLinkDecision } from "@/components/clubs/school-link-decision";
import { SchoolLinkBackers } from "@/components/clubs/school-link-backers";
import { launchTiles, weekLabel, type LaunchMetrics } from "@/lib/launch-metrics";
import { torchTiles, type TorchMetrics } from "@/lib/torch-metrics";

export const metadata: Metadata = { title: "Brazework admin" };

type Metrics = {
  members: number; onboarded: number; weekly_active: number; in_a_club: number; with_project: number; with_verified: number;
  submitted_30d: number; verified_30d: number; median_hours_to_verify: number | null;
  clubs: number; clubs_active_7d: number; handoffs: number; top_clubs: { id: string; name: string; posts: number; members: number }[];
  companies: number; challenges_live: number; challenge_entries: number; sponsorships_paid: number; sponsorships_pilot: number; open_queue: number;
};

// Weekly sign-up cohorts and whether students answer companies (supabase/admin-retention.sql).
type Retention = {
  cohorts: { week: string; size: number; active: number[] }[];
  company_conversations_90d: number; company_replied_90d: number; company_median_hours_to_reply: number | null;
};

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

// Brazework admins only (the database refuses everyone else; this page 404s for them too).
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl xl:max-w-5xl"><PageHeader title="Brazework admin" /><Skeleton className="mt-6 h-96" /></div>}>
      <Admin />
    </Suspense>
  );
}

async function Admin() {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_forge_admin");
  if (!isAdmin) notFound();
  const [{ data: m }, { data: requests }, { data: queue }, { data: reportRows }, { data: schoolRows }, { data: ret }, { data: claimRows }, { data: launchRow }, { data: torchRow }] = await Promise.all([
    supabase.rpc("admin_metrics"),
    supabase.from("challenges").select("id, title, prize, deadline, organizations(name)").eq("sponsorship", "requested").order("created_at", { ascending: true }).limit(50),
    supabase.from("admin_queue").select("id, kind, subject_id, detail, created_at").eq("status", "open").order("created_at", { ascending: true }).limit(50),
    supabase.from("content_reports").select("id, kind, target_id, reason, detail, reported, created_at").eq("status", "open").order("created_at", { ascending: true }).limit(50),
    supabase.from("school_requests").select("id, domain, school, contact, asks, created_at").eq("status", "open").order("asks", { ascending: false }).limit(50),
    // Until step 33 runs, this errors and the retention section stays hidden.
    supabase.rpc("admin_retention"),
    // Until step 35 runs, this errors and the section stays hidden. Two links to profiles: name the claimant's.
    supabase.from("club_claims").select("id, community_id, role_title, evidence, created_at, communities(name, owner_name), profiles!club_claims_claimant_fkey(first_name, last_name)").eq("status", "open").order("created_at", { ascending: true }).limit(50),
    // The launch numbers (step 92). Until it runs, this errors and the panel stays hidden.
    supabase.rpc("admin_launch_metrics"),
    // Torch's numbers (step 108). Until it runs, this errors and the panel stays hidden.
    supabase.rpc("admin_torch_metrics")
  ]);
  type Claim = { id: number; community_id: string; role_title: string; evidence: string; created_at: string; communities: { name: string; owner_name: string } | null; profiles: { first_name: string; last_name: string } | null };
  const claims = claimRows as unknown as Claim[] | null;
  // Clubs asking to be verified as one of a school's clubs (step 56), while the school has no official account.
  type SchoolAsk = { community_id: string; school_name: string; school_domain: string; evidence_url: string; requester_at_school: boolean; requested_at: string; communities: { name: string; member_count: number } | null };
  // Which officers' confirmed school addresses back each request (step 89, FIX-237).
  const backersOn = (await dbFeatures()).schoolLinkEmail;
  const schoolAsks = (await dbFeatures()).schoolLinks
    ? (((await supabase.from("club_school_links").select("community_id, school_name, school_domain, evidence_url, requester_at_school, requested_at, communities(name, member_count)").eq("status", "pending").order("requested_at", { ascending: true }).limit(50)).data ?? []) as unknown as SchoolAsk[])
    : null;
  const r = ret as Retention | null;
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
  const launch = launchRow as LaunchMetrics | null;
  const torch = torchRow as TorchMetrics | null;
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
    ...(r ? [["Students reply to companies", pct(r.company_replied_90d, r.company_conversations_90d),
      `${r.company_conversations_90d} conversations (90 days)${r.company_median_hours_to_reply == null ? "" : ` · median ${r.company_median_hours_to_reply} h`}`] as [string, string, string]] : []),
  ] : [];

  return (
    <div className="mx-auto max-w-3xl xl:max-w-5xl">
      <PageHeader title="Brazework admin" subtitle="Whether the loop works, and what's waiting on the Brazework team." />

      {launch && <LaunchNumbers m={launch} />}
      {torch && <TorchNumbers m={torch} />}

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

      {r && r.cohorts.length > 0 && <Cohorts cohorts={r.cohorts} />}

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

      {schoolAsks && (
        <section className="mt-8" aria-label="Clubs asking to be verified by their school">
          <Kicker>School clubs · {schoolAsks.length}</Kicker>
          <p className="mt-1 text-xs text-faint">Open the proof: the school&apos;s own site should list the club. Once a school&apos;s official account is set up (set_up_school), its admins review their own clubs.</p>
          <div className="mt-3 flex flex-col gap-2">
            {schoolAsks.map((a) => (
              <Panel key={a.community_id} className="flex flex-wrap items-start gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium"><Link href={`/c/${a.community_id}`} className="hover:underline">{a.communities?.name ?? "A club"}</Link> · a club of {a.school_name}</p>
                  <p className="mt-0.5 text-xs text-faint">{a.school_domain} · {a.communities?.member_count ?? 0} members · {a.requester_at_school ? "asked from a school email" : "not asked from a school email"}</p>
                  <a href={a.evidence_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1.5 block text-sm break-all text-text-2 underline underline-offset-2">{a.evidence_url}</a>
                  {backersOn && <SchoolLinkBackers cid={a.community_id} domain={a.school_domain} />}
                </div>
                <SchoolLinkDecision cid={a.community_id} />
              </Panel>
            ))}
            {!schoolAsks.length && <p className="text-sm text-muted">No clubs waiting.</p>}
          </div>
        </section>
      )}

      {claims && (
        <section className="mt-8" aria-label="Club claims">
          <Kicker>Club claims · {claims.length}</Kicker>
          <p className="mt-1 text-xs text-faint">Check the proof before approving: the claimant becomes the owner and the current owner becomes a member.</p>
          <div className="mt-3 flex flex-col gap-2">
            {claims.map((c) => (
              <Panel key={c.id} className="flex flex-wrap items-start gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {`${c.profiles?.first_name ?? ""} ${c.profiles?.last_name ?? ""}`.trim() || "A member"} · {c.role_title} of{" "}
                    <Link href={`/c/${c.community_id}`} className="hover:underline">{c.communities?.name ?? "a club"}</Link>
                  </p>
                  <p className="mt-0.5 text-xs text-faint">Owner now: {c.communities?.owner_name || "unknown"}</p>
                  <p className="mt-1.5 text-sm break-words whitespace-pre-wrap text-text-2">{c.evidence}</p>
                </div>
                <ClaimDecision id={c.id} />
              </Panel>
            ))}
            {!claims.length && <p className="text-sm text-muted">No claims waiting.</p>}
          </div>
        </section>
      )}

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
              <span className="font-medium">{({ dispute: "Escalated dispute", verify_outlier: "Unusual verification volume", duplicate_club: "Possible duplicate club", report: "Report", sales: "Sales request" } as Record<string, string>)[q.kind as string] ?? q.kind}</span>
              <span className="ml-2 text-xs text-faint">{new Date(q.created_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span>
              {q.detail && <p className="mt-1 text-text-2">{q.detail as string}</p>}
            </Panel>
          ))}
          {!queue?.length && <EmptyState title="The queue is clear" body="Escalated disputes, unusual verification patterns and sales requests (pilots, sponsorships, demos, the Plus waitlist) land here." />}
        </div>
      </section>
    </div>
  );
}

// Retention by weekly sign-up cohort: of the members who joined in a week, the share active in each
// later week. One hue, darker = more retained (capped at 40% so text stays readable in every theme); the number is always printed, so color isn't the only cue.
function Cohorts({ cohorts }: { cohorts: Retention["cohorts"] }) {
  const weeks = Math.max(0, ...cohorts.map((c) => c.active.length));
  const label = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <Panel className="mt-4 overflow-x-auto p-5">
      <Kicker>Retention by sign-up week</Kicker>
      <p className="mt-1 text-xs text-muted">Of the members who joined each week, the share who posted, replied, messaged or added a milestone in each week after.</p>
      <table className="mt-3 w-full min-w-[32rem] border-separate border-spacing-1 text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-faint">
            <th scope="col" className="text-left font-normal">Joined</th>
            <th scope="col" className="text-right font-normal">Members</th>
            {Array.from({ length: weeks }, (_, i) => <th key={i} scope="col" className="text-center font-normal">Week {i + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.week}>
              <th scope="row" className="text-left font-normal text-text-2">{label(c.week)}</th>
              <td className="text-right text-text-2">{c.size}</td>
              {Array.from({ length: weeks }, (_, i) => {
                const n = c.active[i];
                if (n === undefined) return <td key={i} />;
                const share = c.size ? n / c.size : 0;
                return (
                  <td key={i} className="rounded-md px-2 py-1 text-center" style={{ background: `color-mix(in oklab, var(--accent) ${Math.round(6 + share * 34)}%, transparent)` }} title={`${n} of ${c.size}`}>
                    {c.size ? `${Math.round(share * 100)}%` : "–"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

// How Torch is doing (supabase/ember-card-counts.sql): totals across all members for the last 7 days,
// and questions a day for the last 14. Counts only: never what anyone asked or what a card held.
function TorchNumbers({ m }: { m: TorchMetrics }) {
  const top = Math.max(1, ...m.days.map((d) => d.asks + d.follows));
  return (
    <Panel className="mt-6 p-5">
      <Kicker>Torch, last 7 days</Kicker>
      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Torch numbers">
        {torchTiles(m).map((t) => (
          <div key={t.label} className="rounded-lg border border-line p-3">
            <p className="text-xs text-faint">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted">{t.sub}</p>
          </div>
        ))}
      </section>
      <figure className="mt-5">
        <figcaption className="text-xs text-faint">Questions and free follow-ups a day, last 14 days (UTC, today on the right)</figcaption>
        <ol aria-label="Torch questions a day" className="mt-2 grid h-24 grid-cols-14 items-end gap-1">
          {m.days.map((d, i) => (
            <li key={d.day} className="flex h-full flex-col justify-end gap-1 text-center" aria-label={`${d.day}: ${d.asks} questions, ${d.follows} follow-ups`}>
              <span className="text-[10px] tabular-nums text-text-2">{d.asks + d.follows}</span>
              <span className={i === m.days.length - 1 ? "rounded-t-sm bg-accent/50" : "rounded-t-sm bg-accent"} style={{ height: `${Math.max(2, ((d.asks + d.follows) / top) * 100)}%` }} />
            </li>
          ))}
        </ol>
      </figure>
    </Panel>
  );
}

// The four numbers that say whether Brazework works (supabase/launch-metrics.sql): signed results a week,
// asks signed within 48 hours, members who log a second result, companies that found someone and wrote.
function LaunchNumbers({ m }: { m: LaunchMetrics }) {
  const top = Math.max(1, ...m.signed_weeks.map((w) => w.signed));
  return (
    <Panel className="mt-6 p-5">
      <Kicker>Launch numbers</Kicker>
      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Launch numbers">
        {launchTiles(m).map((t) => (
          <div key={t.label} className="rounded-lg border border-line p-3">
            <p className="text-xs text-faint">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted">{t.sub}</p>
          </div>
        ))}
      </section>
      <figure className="mt-5">
        <figcaption className="text-xs text-faint">Signed results a week, last 8 weeks (this week so far on the right)</figcaption>
        <ol aria-label="Signed results a week" className="mt-2 grid h-28 grid-cols-8 items-end gap-2">
          {m.signed_weeks.map((w, i) => (
            <li key={w.week} className="flex h-full flex-col justify-end gap-1 text-center" aria-label={`Week of ${weekLabel(w.week)}: ${w.signed} signed`}>
              <span className="text-xs tabular-nums text-text-2">{w.signed}</span>
              <span className={i === m.signed_weeks.length - 1 ? "rounded-t-md bg-accent/50" : "rounded-t-md bg-accent"} style={{ height: `${Math.max(2, (w.signed / top) * 100)}%` }} />
              <span className="text-[10px] text-faint">{weekLabel(w.week)}</span>
            </li>
          ))}
        </ol>
      </figure>
    </Panel>
  );
}
