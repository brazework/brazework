import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";

export const metadata: Metadata = { title: "Messages" };

// Desktop: the right pane before a conversation is picked. (Phones show the list instead.)
export default function MessagesHome() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="flex flex-col items-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-raised text-muted"><MessageSquare className="size-5" /></div>
        <p className="mt-4 font-medium">Pick a conversation</p>
        <p className="mt-1 max-w-xs text-sm text-muted">Messages from people you&apos;re not connected with arrive as requests, so your inbox stays yours.</p>
      </div>
    </div>
  );
}
