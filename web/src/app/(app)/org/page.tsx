import { eventCols } from "@/lib/db-features";
import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { ORG_LABEL, inLog, type ForgeEvent, type Organization } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { EventEditor, EventRow, RegisterOrg } from "./org-client";

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
        <PageHeader title="Host events on Forge" subtitle="Companies and schools are verified by the domain of the email you signed up with." />
        <Panel className="mt-6 p-6"><RegisterOrg email={user.email} /></Panel>
      </>
    );

  const { data } = await supabase.from("events").select(await eventCols()).eq("org_id", org.id).order("starts_at", { ascending: false }).limit(200);
  const events = (data ?? []) as unknown as ForgeEvent[];
  const now = requestTime();
  const upcoming = events.filter((e) => !inLog(e, now)).reverse();
  const log = events.filter((e) => inLog(e, now));

  return (
    <>
      <PageHeader title={org.name} subtitle={<span className="inline-flex items-center gap-1.5"><BadgeCheck className="size-4" /> {ORG_LABEL[org.type]}{org.domain ? ` · ${org.domain}` : ""}</span>} actions={<EventEditor orgId={org.id} />} />
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
