import type { Metadata } from "next";
import { ArrowLeft, BadgeCheck, ExternalLink, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Panel, Skeleton } from "@/components/app/page-ui";
import { EVENT_WITH_HOST, ORG_LABEL, pluralize, whereLabel, withHost, type HostedEvent } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { CalendarButton } from "../event-controls";
import { DetailActions } from "./detail-actions";
import { LocalTime } from "../local-time";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/events" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Events</Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <EventView params={params} />
      </Suspense>
    </div>
  );
}

async function EventView({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data } = await supabase.from("events").select(EVENT_WITH_HOST).eq("id", id).maybeSingle();
  if (!data) return <EmptyState title="This event isn't available" body="It may have ended more than a day ago, or been removed." />;
  const e = withHost(data as Parameters<typeof withHost>[0]) as HostedEvent;
  const [g, s] = await Promise.all([
    supabase.from("event_rsvps").select("event_id").eq("event_id", id).eq("user_id", user.id),
    supabase.from("event_saves").select("event_id").eq("event_id", id).eq("user_id", user.id),
  ]);
  const over = Date.parse(e.ends_at) <= requestTime();
  const link = /^https?:\/\/\S+$/i.test(e.link) ? e.link : "";

  return (
    <Panel className="p-6">
      <div className="font-mono text-[11px] tracking-wide text-faint uppercase">{e.type} · {e.topic}</div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{e.title}</h1>
      {e.status === "cancelled" && <p className="mt-3 rounded-2xl border border-danger/40 px-4 py-2 text-sm text-danger">This event was cancelled.</p>}
      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex gap-2"><dt className="sr-only">When</dt><dd><LocalTime kind="full" value={e.starts_at} /> · <LocalTime kind="range" value={e} /></dd></div>
        <div className="flex items-center gap-1.5 text-muted"><MapPin className="size-4" /> {whereLabel(e)}</div>
        {e.host && (e.community_id
          ? <Link href={`/c/${e.community_id}`} className="flex items-center gap-1.5 text-muted hover:text-text hover:underline"><BadgeCheck className="size-4" /> Hosted by {e.host} · Club event</Link>
          : <div className="flex items-center gap-1.5 text-muted"><BadgeCheck className="size-4" /> {e.host} · {ORG_LABEL[e.host_type as keyof typeof ORG_LABEL] ?? "Verified"}</div>)}
        <div className="flex items-center gap-1.5 text-muted"><Users className="size-4" /> {pluralize(e.rsvp_count, "person", "people")} going</div>
      </dl>
      {e.description && <p className="mt-6 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{e.description}</p>}
      {link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-flex items-center gap-1.5 text-sm underline underline-offset-4"><ExternalLink className="size-4" /> Event link</a>}
      <div className="mt-8 flex flex-wrap items-start gap-2">
        <DetailActions id={e.id} going={!!g.data?.length} saved={!!s.data?.length} count={e.rsvp_count} over={over || e.status === "cancelled"} />
        <CalendarButton eventId={e.id} />
      </div>
    </Panel>
  );
}
