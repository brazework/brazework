import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState, PageHeader, Panel, Skeleton, Tabs } from "@/components/app/page-ui";
import { PersonRow } from "@/components/network/person-row";
import { CONNECTION_COLS, FOLLOW_COLS, otherOf, toPerson, type ConnectionRow, type FollowRow } from "@/components/network/queries";
import { timeAgo } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { AcceptAll, RowActions } from "./row-actions";

export const metadata: Metadata = { title: "Network" };

const TAB_IDS = ["invitations", "connections", "sent", "following", "followers", "suggested"] as const;
type Tab = (typeof TAB_IDS)[number];

export default function NetworkPage({ searchParams }: PageProps<"/network">) {
  return (
    <div className="mx-auto max-w-3xl">
      <LiveRefresh tables={["connections", "follows"]} />
      <Suspense fallback={<NetworkSkeleton />}>
        <Network searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Network({ searchParams }: { searchParams: PageProps<"/network">["searchParams"] }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const me = user.id;

  const [conns, fg, fr] = await Promise.all([
    supabase.from("connections").select(CONNECTION_COLS).contains("users", [me]).order("created_at", { ascending: false }).limit(500),
    supabase.from("follows").select(FOLLOW_COLS).eq("follower", me).order("created_at", { ascending: false }).limit(500),
    supabase.from("follows").select(FOLLOW_COLS).eq("target", me).order("created_at", { ascending: false }).limit(500),
  ]);
  const all = (conns.data ?? []) as ConnectionRow[];
  const inv = all.filter((c) => c.status === "pending" && c.to_id === me);
  const snt = all.filter((c) => c.status === "pending" && c.from_id === me);
  const con = all.filter((c) => c.status === "accepted");
  const following = (fg.data ?? []) as FollowRow[];
  const followers = (fr.data ?? []) as FollowRow[];

  const asked = TAB_IDS.find((t) => t === sp.tab);
  const tab: Tab = asked ?? (inv.length ? "invitations" : con.length ? "connections" : "suggested");
  const counts: Partial<Record<Tab, number>> = { invitations: inv.length, connections: con.length, sent: snt.length, following: following.length, followers: followers.length };
  const labels: Record<Tab, string> = { invitations: "Invitations", connections: "Connections", sent: "Sent", following: "Following", followers: "Followers", suggested: "People you may know" };

  return (
    <>
      <PageHeader title="Network" subtitle={`${con.length} connection${con.length === 1 ? "" : "s"} · ${followers.length} follower${followers.length === 1 ? "" : "s"}`} />
      <div className="mt-6">
        <Tabs active={tab} tabs={TAB_IDS.map((id) => ({ id, label: labels[id], href: `/network?tab=${id}`, count: id === "suggested" ? undefined : counts[id] }))} />
      </div>
      <div className="mt-6">
        {tab === "invitations" &&
          (inv.length ? (
            <Panel className="p-0">
              <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm text-muted">
                <span>{inv.length} waiting</span>
                {inv.length > 1 && <AcceptAll />}
              </div>
              <div className="divide-y divide-line">
                {inv.map((c) => (
                  <PersonRow key={c.id} person={otherOf(c, me)} note={c.note} sub={`Sent ${timeAgo(c.created_at)}`} actions={<RowActions kind="invite" id={c.id} />} />
                ))}
              </div>
            </Panel>
          ) : (
            <EmptyState icon={<Users className="size-5" />} title="No invitations right now" body="When someone asks to connect, it shows up here." />
          ))}

        {tab === "connections" &&
          (con.length ? (
            <List>
              {con.map((c) => {
                const p = otherOf(c, me);
                return <PersonRow key={c.id} person={p} sub={c.accepted_at ? `Connected ${timeAgo(c.accepted_at)}` : undefined} actions={<RowActions kind="connection" id={c.id} personId={p.id} />} />;
              })}
            </List>
          ) : (
            <EmptyState icon={<Users className="size-5" />} title="No connections yet" action={<Link className="text-sm underline" href="/network?tab=suggested">Find people you may know</Link>} />
          ))}

        {tab === "sent" &&
          (snt.length ? (
            <List>
              {snt.map((c) => (
                <PersonRow key={c.id} person={otherOf(c, me)} note={c.note} sub={`Sent ${timeAgo(c.created_at)}`} actions={<RowActions kind="sent" id={c.id} />} />
              ))}
            </List>
          ) : (
            <EmptyState title="No pending requests" body="Requests you send wait here until they're answered." />
          ))}

        {tab === "following" &&
          (following.length ? (
            <List>
              {following.map((f) => (
                <PersonRow key={f.target} person={toPerson(f.target, f.target_info)} actions={<RowActions kind="following" id={f.target} />} />
              ))}
            </List>
          ) : (
            <EmptyState title="You're not following anyone yet" body="Follow people to see their posts in your Following feed." />
          ))}

        {tab === "followers" &&
          (followers.length ? (
            <List>
              {followers.map((f) => (
                <PersonRow key={f.follower} person={toPerson(f.follower, f.follower_info)} sub={`Followed you ${timeAgo(f.created_at)}`} />
              ))}
            </List>
          ) : (
            <EmptyState title="No followers yet" body="Post what you're building. People in your field will find it." />
          ))}

        {tab === "suggested" && (
          <Suspense fallback={<Skeleton className="h-64" />}>
            <Suggested me={me} interests={profile.interests ?? []} field={profile.field} known={[...con.map((c) => otherOf(c, me).id), ...snt.map((c) => c.to_id), ...inv.map((c) => c.from_id)]} />
          </Suspense>
        )}
      </div>
    </>
  );
}

// People who share your interests or field, ranked by shared interests (drawSuggested() in public/js/views/network.js).
async function Suggested({ me, interests, field, known }: { me: string; interests: string[]; field: string; known: string[] }) {
  const { supabase } = await getViewer();
  const cols = "id, first_name, last_name, headline, field, interests, onboarded, account_type";
  type P = { id: string; first_name: string; last_name: string; headline: string; field: string; interests: string[]; onboarded: boolean; account_type: string };
  const [byInterest, byField] = await Promise.all([
    interests.length ? supabase.from("profiles").select(cols).overlaps("interests", interests).limit(40) : Promise.resolve({ data: [] as P[] }),
    field ? supabase.from("profiles").select(cols).eq("field", field).limit(20) : Promise.resolve({ data: [] as P[] }),
  ]);
  const skip = new Set([me, ...known]);
  const mine = new Set(interests);
  const found = new Map<string, P>();
  for (const p of [...((byInterest.data ?? []) as P[]), ...((byField.data ?? []) as P[])]) found.set(p.id, p);
  const people = [...found.values()]
    .filter((p) => !skip.has(p.id) && p.onboarded)
    .map((p) => ({ ...p, shared: (p.interests ?? []).filter((t) => mine.has(t)) }))
    .sort((a, b) => b.shared.length - a.shared.length || Number(b.field === field) - Number(a.field === field))
    .slice(0, 20);

  if (!people.length) return <EmptyState icon={<Users className="size-5" />} title="No suggestions right now" body="As more people join in your fields, they'll show up here." />;
  return (
    <>
      <p className="mb-3 text-sm text-muted">Based on your field and interests.</p>
      <List>
        {people.map((p) => (
          <PersonRow
            key={p.id}
            person={{ id: p.id, firstName: p.first_name, lastName: p.last_name, headline: p.headline }}
            sub={p.shared.length ? `${p.shared.length} shared interest${p.shared.length > 1 ? "s" : ""}: ${p.shared.slice(0, 2).join(", ")}` : p.field}
            actions={<RowActions kind="suggested" id={p.id} firstName={p.first_name} />}
          />
        ))}
      </List>
    </>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <Panel className="divide-y divide-line p-0">{children}</Panel>;
}

function NetworkSkeleton() {
  return (
    <div aria-busy="true">
      <PageHeader title="Network" />
      <Skeleton className="mt-6 h-9 w-2/3 rounded-full" />
      <Skeleton className="mt-6 h-80" />
    </div>
  );
}
