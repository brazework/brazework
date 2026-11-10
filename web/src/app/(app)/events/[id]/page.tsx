import { eventWithHost } from "@/lib/db-features";
import type { Metadata } from "next";
import { ArrowLeft, BadgeCheck, Clock, ExternalLink, MapPin, MessagesSquare, Navigation, Users, Video } from "lucide-react";
import { Avatar } from "@/components/ui";
import { avatarSrc } from "@/lib/media";
import { CommunityBadge } from "../../communities/_components/badge";
import { openEventChat } from "@/lib/chats";
import { dbFeatures } from "@/lib/db-features";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Panel, Skeleton } from "@/components/app/page-ui";
import { ORG_LABEL, pluralize, whenBadge, whereLabel, withHost, type HostedEvent } from "@/lib/events";
import { CopyLink } from "@/components/app/copy-link";
import { SendPost } from "@/components/share/send-post";
import { Ember } from "@/components/ember/ember";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { CalendarButton } from "../event-controls";
import { DetailActions } from "./detail-actions";
import { DateTile, LocalTime } from "../local-time";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <div className="mx-auto max-w-3xl lg:max-w-6xl">
      <Link href="/events" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Events</Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <EventView params={params} />
      </Suspense>
    </div>
  );
}

type Mini = { id: string; title: string; starts_at: string; rsvp_count: number };

async function EventView({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const f = await dbFeatures();
  const { data } = await supabase.from("events").select(await eventWithHost()).eq("id", id).maybeSingle();
  if (!data) return <EmptyState title="This event isn't available" body="It may have ended more than a day ago, or been removed." />;
  const e = withHost(data as unknown as Parameters<typeof withHost>[0]) as HostedEvent;
  const now = new Date(requestTime()).toISOString();
  // Everything else at once: your RSVP and save, connections going (RSVPs are private except
  // your connections'), the host club, more from the host, and similar events.
  const [g, s, conn, club, more, similar] = await Promise.all([
    supabase.from("event_rsvps").select("event_id").eq("event_id", id).eq("user_id", user.id),
    supabase.from("event_saves").select("event_id").eq("event_id", id).eq("user_id", user.id),
    supabase.from("event_rsvps").select("user_id").eq("event_id", id).neq("user_id", user.id).limit(12),
    e.community_id ? supabase.from("communities").select(`id, name, about, member_count${f.clubProfile ? ", logo_path, accent, tagline" : ""}`).eq("id", e.community_id).maybeSingle() : Promise.resolve({ data: null }),
    (e.community_id || e.org_id)
      ? supabase.from("events").select("id, title, starts_at, rsvp_count").eq(e.community_id ? "community_id" : "org_id", (e.community_id ?? e.org_id)!).eq("status", "published").gt("starts_at", now).neq("id", id).order("starts_at").limit(3)
      : Promise.resolve({ data: [] }),
    supabase.from("events").select("id, title, starts_at, rsvp_count").eq("topic", e.topic).eq("status", "published").gt("starts_at", now).neq("id", id).order("starts_at").limit(3),
  ]);
  const going = !!g.data?.length;
  // Your RSVP and the count are separate reads; never show "0 going" next to your own "Going".
  e.rsvp_count = Math.max(e.rsvp_count, going ? 1 : 0);
  const connIds = ((conn.data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  const { data: faces } = connIds.length ? await supabase.from("profiles").select(`id, first_name, last_name${f.media ? ", avatar_path" : ""}`).in("id", connIds) : { data: [] };
  const people = ((faces ?? []) as unknown as { id: string; first_name: string; last_name: string; avatar_path?: string | null }[]);
  const c = club.data as unknown as { id: string; name: string; about: string; member_count: number; logo_path?: string; accent?: string; tagline?: string } | null;
  const over = Date.parse(e.ends_at) <= requestTime();
  const link = /^https?:\/\/\S+$/i.test(e.link) ? e.link : "";
  const badge = whenBadge(e, requestTime());
  const inPerson = e.format !== "Online" && e.location.trim().length > 2;
  const q = encodeURIComponent(e.location.trim());
  const prep = `Prep me for the event "${e.title}" (${e.type}, ${e.topic}) on Brazework: what to bring, three people or kinds of people to meet there, and two good questions to ask. Keep it short.`;
  const moreList = (more.data ?? []) as Mini[];
  const similarList = ((similar.data ?? []) as Mini[]).filter((x) => !moreList.some((m) => m.id === x.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel className="overflow-hidden p-0">
          <div className="flex gap-5 p-6">
            <DateTile value={e.starts_at} className="w-16 shrink-0 self-start overflow-hidden rounded-2xl border border-line bg-surface text-center shadow-[var(--shadow)]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted">{e.type} · {e.topic} · {e.format}</span>
                {badge && e.status !== "cancelled" && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-medium ${badge.live ? "bg-emerald-500/12 text-emerald-500" : "bg-surface-2 text-text-2"}`}>{badge.live && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />}{badge.text}</span>}
              </div>
              <h1 className="mt-1.5 text-3xl leading-tight font-semibold tracking-tight">{e.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-text-2"><Clock className="size-4 text-faint" /> <LocalTime kind="full" value={e.starts_at} /> · <LocalTime kind="range" value={e} /></p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-2"><MapPin className="size-4 text-faint" /> {whereLabel(e)}</p>
              {e.host && (e.community_id
                ? <Link href={`/c/${e.community_id}`} className="mt-1 flex items-center gap-1.5 text-sm text-text-2 hover:underline"><BadgeCheck className="size-4 text-faint" /> Hosted by {e.host}</Link>
                : <p className="mt-1 flex items-center gap-1.5 text-sm text-text-2"><BadgeCheck className="size-4 text-faint" /> {e.host} · {ORG_LABEL[e.host_type as keyof typeof ORG_LABEL] ?? "Verified"}</p>)}
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-2"><Users className="size-4 text-faint" /> {pluralize(e.rsvp_count, "person", "people")} going</p>
            </div>
          </div>
          {e.status === "cancelled" && <p className="mx-6 mb-4 rounded-2xl border border-danger/40 px-4 py-2 text-sm text-danger">This event was cancelled.</p>}
          <div className="flex flex-wrap items-start gap-2 border-t border-line bg-surface-2/40 px-6 py-4">
            <DetailActions id={e.id} going={going} saved={!!s.data?.length} count={e.rsvp_count} over={over || e.status === "cancelled"} />
            <CalendarButton eventId={e.id} />
            <SendPost eventId={e.id} compact={false} />
            <CopyLink path={`/events/${e.id}`} label="Share" />
            {going && f.groupChats && (
              <form action={openEventChat.bind(null, e.id)}>
                <button className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition hover:bg-hover active:scale-95"><MessagesSquare className="size-4" /> Event chat</button>
              </form>
            )}
          </div>
        </Panel>

        {e.description && (
          <Panel className="p-6">
            <h2 className="text-xs font-medium tracking-wide text-faint uppercase">About this event</h2>
            <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{e.description}</p>
          </Panel>
        )}

        {inPerson && (
          <Panel className="overflow-hidden p-0">
            {/* Google's keyless embed takes the address as written; lazy, so it loads only when scrolled to. */}
            <iframe title={`Map of ${e.location}`} src={`https://maps.google.com/maps?q=${q}&z=15&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-72 w-full border-0 bg-surface-2" />
            <div className="flex flex-wrap items-center gap-2 p-4">
              <span className="mr-auto flex min-w-0 items-center gap-1.5 text-sm"><MapPin className="size-4 shrink-0 text-faint" /> <span className="truncate">{e.location}</span></span>
              <a href={`https://maps.apple.com/?q=${q}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm transition hover:bg-hover">Apple Maps</a>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-text px-3.5 text-sm text-bg transition hover:opacity-90"><Navigation className="size-3.5" /> Directions</a>
            </div>
          </Panel>
        )}

        {e.format !== "In person" && link && (
          <Panel className="flex items-center gap-4 p-5">
            <span className="nav-tile grid size-11 shrink-0 place-items-center rounded-xl text-text"><Video className="size-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Join online</span><span className="block truncate text-xs text-muted">{link.replace(/^https?:\/\//, "")}</span></span>
            <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent-grad px-4 text-sm font-medium text-on-accent"><ExternalLink className="size-4" /> Open link</a>
          </Panel>
        )}
        {e.format === "In person" && link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4"><ExternalLink className="size-4" /> Event link</a>}

        {!over && e.status !== "cancelled" && (
          <Link href={`/copilot?q=${encodeURIComponent(prep)}`} className="glass-card flex items-center gap-3 rounded-3xl p-5 transition hover:-translate-y-0.5">
            <Ember size={40} />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Prep me with Ember</span><span className="block text-xs text-muted">What to bring, who to meet and what to ask.</span></span>
          </Link>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Panel className="p-5">
          <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Going</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{e.rsvp_count}</p>
          <p className="text-xs text-muted">{going ? "Including you. " : ""}{people.length ? `${people.length} of your connections ${people.length === 1 ? "is" : "are"} going.` : "Connections who RSVP show here."}</p>
          {people.length > 0 && (
            <ul className="mt-3 space-y-2">
              {people.slice(0, 6).map((p) => (
                <li key={p.id}><Link href={`/u/${p.id}`} className="flex items-center gap-2.5 text-sm hover:underline"><Avatar first={p.first_name} last={p.last_name} size={28} src={avatarSrc(p)} /> {p.first_name} {p.last_name}</Link></li>
              ))}
            </ul>
          )}
        </Panel>
        {c && (
          <Panel className="p-5">
            <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Host</h2>
            <Link href={`/c/${c.id}`} className="mt-3 flex items-center gap-3">
              <CommunityBadge id={c.id} name={c.name} size={44} logo={c.logo_path || null} accent={c.accent || null} />
              <span className="min-w-0"><span className="block truncate font-medium hover:underline">{c.name}</span><span className="block text-xs text-muted">{pluralize(c.member_count, "member", "members")}</span></span>
            </Link>
            {(c.tagline || c.about) && <p className="mt-3 line-clamp-3 text-sm text-text-2">{c.tagline || c.about}</p>}
          </Panel>
        )}
        {[["More from the host", moreList], ["Similar events", similarList]].map(([title, list]) => (list as Mini[]).length > 0 && (
          <Panel key={title as string} className="p-5">
            <h2 className="text-xs font-medium tracking-wide text-faint uppercase">{title as string}</h2>
            <ul className="mt-2 space-y-1">
              {(list as Mini[]).map((x) => (
                <li key={x.id}>
                  <Link href={`/events/${x.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-hover">
                    <DateTile value={x.starts_at} className="w-10 shrink-0 overflow-hidden rounded-lg border border-line text-center text-[9px] [&>span:nth-child(2)]:text-base" />
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{x.title}</span><span className="block text-xs text-muted">{pluralize(x.rsvp_count, "person", "people")} going</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </aside>
    </div>
  );
}
