import { CalendarDays, Sparkles, UserPlus } from "lucide-react";
import { Carousel } from "@/components/app/carousel";
import { EventMiniCard, SpotlightCard } from "@/components/app/discover-cards";
import { PersonCard, type PersonCardData } from "@/components/network/person-card";
import { eventWithHost, postSelect } from "@/lib/db-features";
import { DAY_MS, withHost, type HostedEvent } from "@/lib/events";
import { requestTime, type Post } from "@/lib/forge";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";

// Discovery strips woven into the feed and other pages. Each is its own async component, so it
// streams in behind a skeleton and never holds up the page around it; each hides when it's empty.

export async function WeekStrip() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const now = requestTime();
  const [ev, going] = await Promise.all([
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", new Date(now).toISOString()).lt("starts_at", new Date(now + 7 * DAY_MS).toISOString()).order("starts_at", { ascending: true }).limit(12),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
  ]);
  const events = ((ev.data ?? []) as unknown as Parameters<typeof withHost>[0][]).map(withHost) as HostedEvent[];
  if (!events.length) return null;
  const goingSet = new Set((going.data ?? []).map((g) => g.event_id as string));
  return (
    <Carousel title="This week" icon={<CalendarDays className="size-3.5" />} href="/events">
      {events.map((e) => <EventMiniCard key={e.id} e={e} going={goingSet.has(e.id)} />)}
    </Carousel>
  );
}

export async function SpotlightStrip() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const since = new Date(requestTime() - 30 * DAY_MS).toISOString();
  const { data } = await supabase.from("posts").select(await postSelect()).is("community_id", null).in("kind", ["project", "result"]).gt("created_at", since).order("like_count", { ascending: false }).limit(10);
  const posts = (data ?? []) as unknown as Post[];
  if (posts.length < 2) return null;
  return (
    <Carousel title="Spotlight: what people are building" icon={<Sparkles className="size-3.5" />} href="/feed?tab=latest">
      {posts.map((p) => <SpotlightCard key={p.id} post={p} />)}
    </Carousel>
  );
}

type Row = { id: string; first_name: string; last_name: string; headline: string; field: string; interests: string[]; avatar_path?: string };

// People to follow: same field or shared interests, not you, not people you already follow.
export async function PeopleStrip({ field, interests, exclude = [], title = "Builders to follow" }: { field?: string; interests: string[]; exclude?: string[]; title?: string }) {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const base = "id, first_name, last_name, headline, field, interests";
  const pick = async (cols: string) => {
    const [byInterest, byField] = await Promise.all([
      interests.length ? supabase.from("profiles").select(cols).overlaps("interests", interests).eq("onboarded", true).limit(40) : Promise.resolve({ data: [], error: null }),
      field ? supabase.from("profiles").select(cols).eq("field", field).eq("onboarded", true).limit(20) : Promise.resolve({ data: [], error: null }),
    ]);
    return { rows: [...((byInterest.data ?? []) as unknown as Row[]), ...((byField.data ?? []) as unknown as Row[])], error: byInterest.error ?? byField.error };
  };
  // Profile photos exist once media.sql has run; fall back to names only before that.
  let res = await pick(`${base}, avatar_path`);
  if (res.error?.code === "42703") res = await pick(base);
  const { data: follows } = await supabase.from("follows").select("target").eq("follower", user.id).limit(500);
  const skip = new Set<string>([user.id, ...exclude, ...(follows ?? []).map((f) => f.target as string)]);
  const mine = new Set(interests);
  const seen = new Set<string>();
  const people: PersonCardData[] = [];
  for (const r of res.rows) {
    if (skip.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    const shared = (r.interests ?? []).filter((t) => mine.has(t));
    people.push({ id: r.id, first_name: r.first_name, last_name: r.last_name, headline: r.headline, field: r.field, avatar: avatarSrc(r), shared: shared.length ? `#${shared[0]}${shared.length > 1 ? ` +${shared.length - 1}` : ""}` : r.field === field ? r.field : undefined });
  }
  if (!people.length) return null;
  return (
    <Carousel title={title} icon={<UserPlus className="size-3.5" />} href="/network?tab=suggested">
      {people.slice(0, 12).map((p) => <PersonCard key={p.id} p={p} />)}
    </Carousel>
  );
}
