import type { Metadata } from "next";
import { BadgeCheck, Bell, Heart, MessageSquare, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { cn, timeAgo } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { ClearButton, MarkRead } from "./notification-client";

export const metadata: Metadata = { title: "Notifications" };

type N = {
  id: number; actor_id: string | null; actor_first: string; actor_last: string;
  kind: "like" | "comment" | "follow" | "connect_request" | "connect_accepted" | "community_request" | "community_approved" | "milestone_request" | "milestone_verified" | "milestone_declined";
  post_id: string | null; community_id: string | null; community_name: string; snippet: string; read: boolean; created_at: string;
};

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <LiveRefresh tables={["notifications"]} />
      <Suspense fallback={<><PageHeader title="Notifications" /><Skeleton className="mt-6 h-96" /></>}>
        <Notifications />
      </Suspense>
    </div>
  );
}

// Several likes on one post, or several new followers, read as one line (group() in the vanilla view).
function group(list: N[]) {
  const out: { key: string; items: N[] }[] = [];
  const byKey = new Map<string, { key: string; items: N[] }>();
  for (const n of list) {
    const key = n.kind === "like" ? `like:${n.post_id}` : n.kind === "follow" ? "follow" : null;
    const existing = key ? byKey.get(key) : undefined;
    if (existing) { existing.items.push(n); continue; }
    const g = { key: key ?? `n${n.id}`, items: [n] };
    if (key) byKey.set(key, g);
    out.push(g);
  }
  return out;
}

function describe(items: N[]) {
  const n = items[0];
  const rest = items.length - 1;
  const who = <strong className="font-medium text-text">{`${n.actor_first} ${n.actor_last}`.trim() || "Someone"}</strong>;
  const lead = rest ? <>{who} and {rest} {rest === 1 ? "other" : "others"}</> : who;
  const where = n.community_name ? <> in <strong className="font-medium text-text">{n.community_name}</strong></> : null;
  switch (n.kind) {
    case "like": return { icon: Heart, href: `/post/${n.post_id}`, text: <>{lead} liked your post{where}</>, quote: n.snippet };
    case "comment": return { icon: MessageSquare, href: `/post/${n.post_id}`, text: <>{who} commented on your post{where}</>, quote: n.snippet };
    case "follow": return { icon: UserPlus, href: rest ? "/network?tab=followers" : `/u/${n.actor_id}`, text: <>{lead} started following you</> };
    case "connect_request": return { icon: Users, href: "/network?tab=invitations", text: <>{who} wants to connect</>, cta: "Respond" };
    case "connect_accepted": return { icon: Users, href: `/u/${n.actor_id}`, text: <>{who} accepted your connection request</> };
    case "community_request": return { icon: Users, href: `/c/${n.community_id}/manage`, text: <>{who} asked to join <strong className="font-medium text-text">{n.community_name}</strong></>, cta: "Review" };
    case "milestone_request": return { icon: BadgeCheck, href: `/c/${n.community_id}/manage?tab=verify`, text: <>{who} asked <strong className="font-medium text-text">{n.community_name}</strong> to verify a milestone</>, quote: n.snippet, cta: "Review" };
    case "milestone_verified": return { icon: BadgeCheck, href: "/profile#projects", text: <><strong className="font-medium text-text">{n.community_name}</strong> verified your milestone</>, quote: n.snippet };
    case "milestone_declined": return { icon: BadgeCheck, href: "/profile#projects", text: <><strong className="font-medium text-text">{n.community_name}</strong> didn&apos;t verify your milestone. See why</>, quote: n.snippet };
    case "community_approved": return { icon: Users, href: `/c/${n.community_id}`, text: <>You&apos;re in: your request to join <strong className="font-medium text-text">{n.community_name}</strong> was approved</> };
  }
}

async function Notifications() {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const list = (data ?? []) as N[];
  const unread = list.filter((n) => !n.read).length;
  const groups = group(list);

  return (
    <>
      <PageHeader title="Notifications" subtitle={unread ? `${unread} new` : "You're all caught up"} />
      {/* Opening the page marks everything read; what was new stays highlighted until you leave. */}
      {unread > 0 && <MarkRead />}
      <div className="mt-6">
        {!groups.length ? (
          <EmptyState icon={<Bell className="size-5" />} title="Nothing yet" body="Likes, comments, follows and requests show up here." />
        ) : (
          <Panel className="divide-y divide-line p-0">
            {groups.map((g) => {
              const d = describe(g.items);
              const fresh = g.items.some((n) => !n.read);
              const Icon = d.icon;
              return (
                <div key={g.key} className={cn("group relative flex gap-4 px-5 py-4 transition hover:bg-hover", fresh && "bg-raised/50")}>
                  {fresh && <span className="absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-accent" aria-label="New" />}
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-muted"><Icon className="size-4" /></span>
                  <Link href={d.href} className="min-w-0 flex-1 after:absolute after:inset-0">
                    <p className="text-sm leading-relaxed text-text-2">{d.text}</p>
                    {d.quote && <p className="mt-1 truncate text-sm text-faint">&ldquo;{d.quote}&rdquo;</p>}
                    <p className="mt-1 text-xs text-faint">{timeAgo(g.items[0].created_at)}{d.cta && <> · <span className="text-text underline underline-offset-4">{d.cta}</span></>}</p>
                  </Link>
                  <ClearButton ids={g.items.map((n) => n.id)} />
                </div>
              );
            })}
          </Panel>
        )}
      </div>
    </>
  );
}
