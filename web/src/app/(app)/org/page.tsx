import { eventCols } from "@/lib/db-features";
import type { Metadata } from "next";
import { BadgeCheck, Search, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { ORG_LABEL, inLog, type ForgeEvent, type Organization } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { EventEditor, EventRow, RegisterOrg } from "./org-client";
import { SchoolLinkDecision } from "@/components/clubs/school-link-decision";

export const metadata: Metadata = { title: "Your organization" };

export default function OrgPage() {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-5xl">
      <Suspense fallback={<><PageHeader title="Your organization" /><Skeleton className="mt-6 h-96" /></>}>
        <Org />
      </Suspense>
    </div>
  );
}

async function Org() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const { data: rows } = await supabase.from("organization_admins").select("organizations(*)").eq("uid", user.id);
  const orgs = ((rows ?? []) as unknown as { organizations: Organization | Organization[] | null }[]).flatMap((r) => (Array.isArray(r.organizations) ? r.organizations : r.organizations ? [r.organizations] : []));
  const org = orgs[0];

  if (!org)
    return (
      <>
        <PageHeader title="Host events on Brazework" subtitle="Companies and schools are verified by the domain of the email you signed up with." />
        <Panel className="mt-6 p-6"><RegisterOrg email={user.email} /></Panel>
      </>
    );

  const { data } = await supabase.from("events").select(await eventCols()).eq("org_id", org.id).order("starts_at", { ascending: false }).limit(200);
  const events = (data ?? []) as unknown as ForgeEvent[];
  const now = requestTime();
  const upcoming = events.filter((e) => !inLog(e, now)).reverse();
  const log = events.filter((e) => inLog(e, now));
  // An official school account (set up by Brazework, step 56) reviews the clubs that say they operate
  // under it, and sees the ones it has verified. That's the start of the school's view.
  const officialSchool = org.type === "school" && (org as Organization & { official?: boolean }).official === true && !!org.domain;
  type ClubLink = { community_id: string; school_name: string; evidence_url: string; status: string; requester_at_school: boolean; requested_at: string; communities: { name: string; member_count: number } | null };
  const clubLinks = officialSchool
    ? (((await supabase.from("club_school_links").select("community_id, school_name, evidence_url, status, requester_at_school, requested_at, communities(name, member_count)").eq("school_domain", org.domain!).in("status", ["pending", "verified"]).order("requested_at", { ascending: true }).limit(200)).data ?? []) as unknown as ClubLink[])
    : [];
  const asking = clubLinks.filter((l) => l.status === "pending");
  const ourClubs = clubLinks.filter((l) => l.status === "verified").sort((a, b) => (b.communities?.member_count ?? 0) - (a.communities?.member_count ?? 0));

  return (
    <>
      <PageHeader title={org.name} subtitle={<span className="inline-flex items-center gap-1.5"><BadgeCheck className="size-4" /> {ORG_LABEL[org.type]}{org.domain ? ` · ${org.domain}` : ""}</span>} actions={<>{org.verification_status === "verified" && <Link href="/talent" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm transition hover:border-line-strong hover:bg-hover"><Search className="size-4" /> Find builders</Link>}{org.verification_status === "verified" && <Link href="/challenges/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm transition hover:border-line-strong hover:bg-hover"><Trophy className="size-4" /> Post a challenge</Link>}<EventEditor orgId={org.id} /></>} />
      {officialSchool && (
        <section className="mt-8" aria-label="Your school's clubs">
          <Kicker>Clubs asking to be verified · {asking.length}</Kicker>
          <p className="mt-1 text-xs text-faint">Verify the clubs that really operate under {org.name}. They get a &ldquo;Verified club of {org.name}&rdquo; badge and are listed with your school&apos;s clubs.</p>
          <div className="mt-3 flex flex-col gap-2">
            {asking.map((a) => (
              <Panel key={a.community_id} className="flex flex-wrap items-start gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium"><Link href={`/c/${a.community_id}`} className="hover:underline">{a.communities?.name ?? "A club"}</Link></p>
                  <p className="mt-0.5 text-xs text-faint">{a.communities?.member_count ?? 0} members · {a.requester_at_school ? "asked from a school email" : "not asked from a school email"}</p>
                  <a href={a.evidence_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1.5 block text-sm break-all text-text-2 underline underline-offset-2">{a.evidence_url}</a>
                </div>
                <SchoolLinkDecision cid={a.community_id} />
              </Panel>
            ))}
            {!asking.length && <p className="text-sm text-muted">No clubs waiting.</p>}
          </div>
          <div className="mt-8"><Kicker>Your school&apos;s clubs · {ourClubs.length}</Kicker></div>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ourClubs.map((c) => (
              <li key={c.community_id}><Link href={`/c/${c.community_id}`} className="glass-card flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm transition hover:border-line-strong"><span className="truncate font-medium">{c.communities?.name ?? "A club"}</span><span className="shrink-0 text-xs text-muted">{c.communities?.member_count ?? 0} members</span></Link></li>
            ))}
            {!ourClubs.length && <li className="text-sm text-muted">No verified clubs yet.</li>}
          </ul>
        </section>
      )}
      <section className="mt-8">
        <Kicker>Upcoming</Kicker>
        <div className="mt-3 flex flex-col gap-3">
          {upcoming.map((e) => <EventRow key={e.id} event={e} editable />)}
          {!upcoming.length && <EmptyState title="No upcoming events" body="Post a career night, workshop or talk. It shows up for everyone in Events." />}
        </div>
      </section>
      <section className="mt-10">
        <Kicker>Past events log</Kicker>
        <p className="mt-1 text-xs text-faint">Only your organization&apos;s admins see events here once they&apos;re a day past.</p>
        <div className="mt-3 flex flex-col gap-3">
          {log.map((e) => <EventRow key={e.id} event={e} editable={false} />)}
          {!log.length && <p className="text-sm text-muted">Nothing yet.</p>}
        </div>
      </section>
    </>
  );
}
