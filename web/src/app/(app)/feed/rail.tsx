import { eventWithHost } from "@/lib/db-features";
import { ArrowRight, CalendarDays, Check, Flame, Plus, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { DROP_AFTER_MS, dateParts, withHost, type HostedEvent } from "@/lib/events";
import { cn, requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { CommunityBadge } from "../communities/_components/badge";
import { UpdatesPanel } from "@/components/tour/updates-panel";

const box = "rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow)]";

function Head({ icon: Icon, title, href }: { icon: typeof Users; title: string; href?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-accent-grad text-on-accent"><Icon className="size-3.5" /></span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {href && <Link href={href} className="ml-auto text-xs text-muted hover:text-text">See all</Link>}
    </div>
  );
}

// The feed's right rail (wide screens): Forge updates (recent and coming next), how complete your profile is and what to do next,
// what's trending, your clubs and what's coming up, so the rest of Forge is one glance away.
export async function FeedRail() {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const now = requestTime();
  const cutoff = new Date(now - DROP_AFTER_MS).toISOString();
  const since = new Date(now - 14 * 864e5).toISOString();
  const [mine, ev, going, projects, posts, recent] = await Promise.all([
    supabase.from("community_members").select("role, communities(id, name, member_count)").eq("uid", user.id).limit(6),
    supabase.from("events").select(await eventWithHost()).eq("status", "published").gt("ends_at", cutoff).order("starts_at", { ascending: true }).limit(4),
    supabase.from("event_rsvps").select("event_id").eq("user_id", user.id).limit(500),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("posts").select("tags").is("community_id", null).gt("created_at", since).limit(300),
  ]);
  type C = { id: string; name: string; member_count: number };
  const clubs = ((mine.data ?? []) as unknown as { communities: C | C[] | null }[])
    .flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []))
    .slice(0, 5);
  const events = ((ev.data ?? []) as unknown as Parameters<typeof withHost>[0][]).map(withHost) as HostedEvent[];
  const goingSet = new Set((going.data ?? []).map((g) => g.event_id as string));

  // Trending: the most-used tags on public posts in the last two weeks.
  const counts = new Map<string, number>();
  for (const r of (recent.data ?? []) as { tags: string[] }[]) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  const trending = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Profile strength: the steps that make a profile worth finding, in the order to do them.
  const p = profile as typeof profile & { avatar_path?: string | null };
  const steps = [
    { done: !!p.avatar_path, label: "Add a profile photo", href: "/profile" },
    { done: !!p.headline?.trim(), label: "Write your headline", href: "/settings#profile" },
    { done: (p.interests ?? []).length >= 3, label: "Pick 3 interests", href: "/settings#profile" },
    { done: clubs.length > 0, label: "Join your club", href: "/communities?tab=discover" },
    { done: (projects.count ?? 0) > 0, label: "Add a project", href: "/profile#projects" },
    { done: (posts.count ?? 0) > 0, label: "Share your first post", href: "/feed" },
  ];
  return <RailView steps={steps} trending={trending} clubs={clubs} events={events} going={goingSet} />;
}

type Step = { done: boolean; label: string; href: string };
type Club = { id: string; name: string; member_count: number };

// The rail's markup, separate from its queries so it can be previewed with sample data.
export function RailView({ steps, trending, clubs, events, going: goingSet }: { steps: Step[]; trending: [string, number][]; clubs: Club[]; events: HostedEvent[]; going: Set<string> }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const pct = Math.round((done / steps.length) * 100);
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <div className="sticky top-8 flex flex-col gap-4">
      <UpdatesPanel />
      <section className={cn(box, "relative overflow-hidden")}>
        <div className="bg-accent-grad pointer-events-none absolute -top-16 -right-10 size-40 rounded-full banner-glow blur-2xl" aria-hidden="true" />
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" role="img" aria-label={`Profile ${pct}% complete`}>
            <defs><linearGradient id="ring" x1="0" x2="1"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0.6" /></linearGradient></defs>
            <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="url(#ring)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / steps.length)} />
            <text x="32" y="32" transform="rotate(90 32 32)" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="600" fill="var(--text)">{pct}%</text>
          </svg>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Profile strength</h2>
            <p className="mt-0.5 text-xs text-muted">{next ? "Complete profiles get found more." : "Your profile is ready to be found."}</p>
          </div>
        </div>
        {next ? (
          <Link href={next.href} className="group mt-4 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm font-medium transition hover:bg-hover">
            <Sparkles className="size-4 text-accent" /> {next.label}
            <ArrowRight className="ml-auto size-4 transition group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm"><Check className="size-4 text-ok" /> All done</p>
        )}
        <ul className="mt-3 flex gap-1" aria-hidden="true">
          {steps.map((s) => <li key={s.label} className={cn("h-1 flex-1 rounded-full", s.done ? "bg-accent-grad" : "bg-raised")} />)}
        </ul>
      </section>

      {trending.length > 0 && (
        <section className={box}>
          <Head icon={Flame} title="Trending" />
          <ol className="mt-3 flex flex-col">
            {trending.map(([t, n], i) => (
              <li key={t}>
                <Link href={`/feed?tab=latest&tag=${encodeURIComponent(t)}`} className="group flex items-center gap-3 rounded-xl px-1.5 py-2 transition hover:bg-hover">
                  <span className="w-4 text-xs font-semibold text-faint tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-text">#{t}</span>
                  <span className="text-xs text-faint tabular-nums">{n} {n === 1 ? "post" : "posts"}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className={box}>
        <Head icon={Users} title="Your clubs" href="/communities" />
        <ul className="mt-3 flex flex-col gap-1">
          {clubs.map((cl) => (
            <li key={cl.id}>
              <Link href={`/c/${cl.id}`} className="group flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-hover">
                <CommunityBadge id={cl.id} name={cl.name} size={32} className="transition group-hover:scale-105" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{cl.name}</span>
                  <span className="block text-xs text-faint">{cl.member_count} {cl.member_count === 1 ? "member" : "members"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!clubs.length && <p className="mt-2 text-sm text-muted">Join your club, or start it here.</p>}
        <Link href={clubs.length ? "/communities?tab=discover" : "/communities?tab=create"} className="mt-2 flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-sm text-muted transition hover:bg-hover hover:text-text">
          <Plus className="size-4" /> {clubs.length ? "Find more clubs" : "Start your club"}
        </Link>
      </section>

      <section className={box}>
        <Head icon={CalendarDays} title="Coming up" href="/events" />
        <ul className="mt-3 flex flex-col gap-2">
          {events.map((e) => {
            const d = dateParts(e.starts_at, "UTC");
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="group flex gap-3 rounded-xl p-1.5 transition hover:bg-hover">
                  <span className="flex w-11 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-line bg-surface">
                    <span className="bg-accent-grad w-full py-0.5 text-center text-[9px] font-semibold text-on-accent uppercase">{d.mon}</span>
                    <span className="py-1 text-base leading-none font-semibold">{d.day}</span>
                  </span>
                  <span className="min-w-0 self-center">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="block truncate text-xs text-faint">{goingSet.has(e.id) ? "✓ You're going · " : ""}{e.host}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {!events.length && <p className="mt-2 text-sm text-muted">Nothing scheduled yet.</p>}
      </section>
    </div>
  );
}
