import { eventWithHost } from "@/lib/db-features";
import { CalendarDays, Plus, Users } from "lucide-react";
import Link from "next/link";
import { Kicker } from "@/components/ui";
import { DROP_AFTER_MS, dateParts, withHost, type HostedEvent } from "@/lib/events";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { CommunityBadge } from "../communities/_components/badge";

// The feed's right rail (wide screens): your clubs and what's coming up, so the rest of Forge
// is one glance away from where people spend most of their time.
export async function FeedRail() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const cutoff = new Date(requestTime() - DROP_AFTER_MS).toISOString();
  const [mine, ev, going] = await Promise.all([
    supabase.from("community_members").select("role, communities(id, name, member_count)").eq("uid", user.id).limit(6),
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", cutoff).order("starts_at", { ascending: true }).limit(4),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
  ]);
  type C = { id: string; name: string; member_count: number };
  const clubs = ((mine.data ?? []) as unknown as { communities: C | C[] | null }[])
    .flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []))
    .slice(0, 5);
  const events = ((ev.data ?? []) as unknown as Parameters<typeof withHost>[0][]).map(withHost) as HostedEvent[];
  const goingSet = new Set((going.data ?? []).map((g) => g.event_id as string));

  return (
    <div className="sticky top-8 flex flex-col gap-4">
      <section className="rounded-3xl border border-line bg-surface/70 p-4">
        <div className="flex items-center justify-between">
          <Kicker>Your clubs</Kicker>
          <Link href="/communities" className="text-xs text-muted hover:text-text">All</Link>
        </div>
        <ul className="mt-3 flex flex-col gap-1">
          {clubs.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.id}`} className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-hover">
                <CommunityBadge id={c.id} name={c.name} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        {!clubs.length && <p className="mt-2 text-sm text-muted">Join your club, or start it here.</p>}
        <Link href={clubs.length ? "/communities?tab=discover" : "/communities?tab=create"} className="mt-3 flex items-center gap-2 rounded-xl px-1.5 py-1 text-sm text-muted transition hover:text-text">
          <Plus className="size-4" /> {clubs.length ? "Find more" : "Start your club"}
        </Link>
      </section>

      <section className="rounded-3xl border border-line bg-surface/70 p-4">
        <div className="flex items-center justify-between">
          <Kicker>Coming up</Kicker>
          <Link href="/events" className="text-xs text-muted hover:text-text">All</Link>
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {events.map((e) => {
            const d = dateParts(e.starts_at, "UTC");
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="flex gap-3 rounded-xl p-1 transition hover:bg-hover">
                  <span className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-raised py-1">
                    <span className="font-mono text-[9px] text-muted uppercase">{d.mon}</span>
                    <span className="text-sm leading-none font-semibold">{d.day}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="block truncate text-xs text-faint">{goingSet.has(e.id) ? "You're going · " : ""}{e.host}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {!events.length && <p className="mt-2 flex items-center gap-2 text-sm text-muted"><CalendarDays className="size-4" /> Nothing scheduled yet.</p>}
      </section>

      <section className="rounded-3xl border border-dashed border-line p-4">
        <div className="flex items-center gap-2 text-sm font-medium"><Users className="size-4" /> Bring your club</div>
        <p className="mt-1 text-xs leading-relaxed text-muted">Run your club&apos;s posts, roles and events here, and every member&apos;s work counts toward their profile.</p>
      </section>
    </div>
  );
}
