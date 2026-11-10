import type { Reaction } from "@/components/chat/message-tools";
import { dbFeatures } from "@/lib/db-features";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/app/page-ui";
import { Avatar } from "@/components/ui";
import { OnlineLabel, WithPresence } from "@/components/presence/presence";
import { getViewer } from "@/lib/supabase/server";
import { Composer, MarkRead, RequestBar, ThreadScroll, type Msg } from "./thread-client";

export const metadata: Metadata = { title: "Conversation" };

export default function ThreadPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<div data-thread className="contents"><Skeleton className="m-4 h-full" /></div>}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: { params: PageProps<"/messages/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect("/login");
  const me = user.id;
  const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
  if (!conv)
    return <div className="grid h-full place-items-center p-8 text-center text-sm text-muted">This conversation isn&apos;t available.<Link href="/messages" className="mt-3 underline">Back to messages</Link></div>;

  const otherId = conv.user_a === me ? conv.user_b : conv.user_a;
  const other = (conv.people?.[otherId] ?? {}) as { firstName?: string; lastName?: string; headline?: string };
  const name = `${other.firstName ?? ""} ${other.lastName ?? ""}`.trim() || "Brazework member";
  const requestToMe = conv.status === "request" && conv.started_by !== me;
  const requestFromMe = conv.status === "request" && conv.started_by === me;

  // Replies and reactions exist once supabase/chat-extras.sql has run.
  const extras = (await dbFeatures()).chatExtras;
  const { data } = await supabase.from("messages").select(extras ? "id, sender_id, body, created_at, reply_to" : "id, sender_id, body, created_at").eq("conversation_id", id).order("created_at", { ascending: true }).limit(300);
  const msgs = (data ?? []) as unknown as Msg[];
  const { data: rxRows } = extras && msgs.length ? await supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", msgs.map((m) => m.id)) : { data: [] };
  const iSent = msgs.some((m) => m.sender_id === me);

  return (
    <div data-thread className="contents">
      {/* Read receipts stay private: marking read never tells the sender, and requests aren't marked until accepted. */}
      {!requestToMe && <MarkRead cid={id} />}
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/messages" aria-label="Back to messages" className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-text md:hidden"><ArrowLeft className="size-4" /></Link>
        <Link href={`/u/${otherId}`} className="flex min-w-0 items-center gap-3">
          <WithPresence id={otherId} dot="size-2.5"><Avatar first={other.firstName ?? ""} last={other.lastName ?? ""} size={36} /></WithPresence>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="truncate text-sm font-medium hover:underline">{name}</span><OnlineLabel id={otherId} /></div>
            {other.headline && <div className="truncate text-xs text-faint">{other.headline}</div>}
          </div>
        </Link>
      </header>
      {requestToMe && <RequestBar cid={id} firstName={other.firstName ?? ""} />}
      <ThreadScroll msgs={msgs} me={me} cid={id} otherName={other.firstName ?? ""} reactions={(rxRows ?? []) as Reaction[]} extras={extras && !requestToMe} myName={profile?.first_name || "You"} />
      {requestToMe ? (
        <p className="border-t border-line px-4 py-3 text-center text-xs text-muted">Accept to reply. They won&apos;t know you&apos;ve read it until you do.</p>
      ) : requestFromMe && iSent ? (
        <p className="border-t border-line px-4 py-3 text-center text-xs text-muted">Request sent. You can send more once {other.firstName || "they"} accepts.</p>
      ) : (
        <Composer cid={id} placeholder={requestFromMe ? `Introduce yourself to ${other.firstName || "them"}` : "Write a message"} />
      )}
    </div>
  );
}
