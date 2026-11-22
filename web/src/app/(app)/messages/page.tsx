import { avatarSrc } from "@/lib/media";
import type { Metadata } from "next";
import { MessageSquare, Send, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/ui";
import { List, ListRow } from "@/components/app/list";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

// Desktop: the right pane before a conversation is picked. (Phones show the list instead.)
// Not an empty screen: your club chats and the people in your clubs, one click from a conversation.
export default function MessagesHome() {
  return (
    <div className="h-full overflow-y-auto p-6 sm:p-8">
      <Suspense fallback={<Intro />}>
        <Starts />
      </Suspense>
    </div>
  );
}

function Intro() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-raised text-muted"><MessageSquare className="size-5" /></div>
      <p className="mt-4 font-medium">Pick a conversation, or start one</p>
      <p className="mt-1 max-w-xs text-sm text-muted">People you&apos;re not connected with arrive as requests, so your inbox stays yours.</p>
    </div>
  );
}

async function Starts() {
  const { supabase, user } = await getViewer();
  if (!user) return <Intro />;
  const { groupChats } = await dbFeatures();
  const [{ data: mine }, chats] = await Promise.all([
    supabase.from("community_members").select("community_id").eq("uid", user.id).limit(50),
    groupChats ? supabase.rpc("my_chats") : Promise.resolve({ data: [] }),
  ]);
  const clubIds = ((mine ?? []) as { community_id: string }[]).map((r) => r.community_id);
  const { data: mates } = clubIds.length
    ? await supabase.from("community_members").select("uid, first_name, last_name, headline").in("community_id", clubIds).neq("uid", user.id).order("joined_at", { ascending: false }).limit(40)
    : { data: [] };
  const seen = new Set<string>();
  const people = ((mates ?? []) as { uid: string; first_name: string; last_name: string; headline: string }[]).filter((m) => !seen.has(m.uid) && seen.add(m.uid)).slice(0, 6);
  const { data: pics } = people.length ? await supabase.from("profiles").select("id, avatar_path").in("id", people.map((p) => p.uid)) : { data: [] };
  const pic = new Map(((pics ?? []) as { id: string; avatar_path?: string | null }[]).map((p) => [p.id, avatarSrc(p)]));
  const rooms = ((chats.data ?? []) as { id: string; kind: string; title: string; subtitle: string }[]).filter((c) => c.kind !== "event").slice(0, 4);
  return (
    <div className="mx-auto max-w-lg">
      <Intro />
      {/* No club chats and nobody in a club yet: say where the first conversation can come from. */}
      {!rooms.length && !people.length && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/network?tab=suggested" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-on-accent"><Users className="size-4" /> Find people</Link>
          <Link href="/communities?tab=discover" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-sm font-medium transition hover:bg-hover">Join a club</Link>
        </div>
      )}
      {rooms.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold">Your club chats</h2>
          {/* One column: this panel is narrow even on wide screens, and two columns cut club names off. */}
          <List label="Your club chats">
            {rooms.map((c) => (
              <ListRow key={c.id} href={`/messages/g/${c.id}`} title={c.title} meta={c.subtitle}
                leading={<span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-text-2"><Users className="size-4" /></span>} />
            ))}
          </List>
        </section>
      )}
      {people.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">People in your clubs</h2>
          <List label="People in your clubs">
            {people.map((p) => (
              <ListRow key={p.uid} title={`${p.first_name} ${p.last_name}`.trim()} meta={p.headline || undefined}
                leading={<Avatar first={p.first_name} last={p.last_name} size={36} src={pic.get(p.uid)} />}
                trailing={<Link href={`/messages/new?to=${p.uid}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium transition hover:border-line-strong"><Send className="size-3.5" /> Message</Link>} />
            ))}
          </List>
        </section>
      )}
    </div>
  );
}
