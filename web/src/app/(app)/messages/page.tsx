import type { Metadata } from "next";
import { MessageSquare, Send, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/ui";
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
  const rooms = ((chats.data ?? []) as { id: string; kind: string; title: string; subtitle: string }[]).filter((c) => c.kind !== "event").slice(0, 4);
  return (
    <div className="mx-auto max-w-lg">
      <Intro />
      {rooms.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Your club chats</h2>
          {/* One column: this panel is narrow even on wide screens, and two columns cut club names off. */}
          <ul className="mt-2 grid grid-cols-1 gap-2">
            {rooms.map((c) => (
              <li key={c.id}>
                <Link href={`/messages/g/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:bg-hover">
                  <span className="bg-accent-grad grid size-9 shrink-0 place-items-center rounded-xl text-on-accent"><Users className="size-4" /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{c.title}</span><span className="block truncate text-xs text-muted">{c.subtitle}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {people.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-medium tracking-wide text-faint uppercase">People in your clubs</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {people.map((p) => (
              <li key={p.uid} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-hover">
                <Avatar first={p.first_name} last={p.last_name} size={36} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{`${p.first_name} ${p.last_name}`.trim()}</span>{p.headline && <span className="block truncate text-xs text-muted">{p.headline}</span>}</span>
                <Link href={`/messages/new?to=${p.uid}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium transition hover:bg-surface"><Send className="size-3.5" /> Message</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
