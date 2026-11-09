import { Suspense } from "react";
import { LiveRefresh } from "@/components/app/live-refresh";
import { Skeleton } from "@/components/app/page-ui";
import { loadConversations, loadGroups } from "./data";
import { ConvList, PaneSwitch } from "./messages-client";

// Two panes on desktop (list + thread); one at a time on phones.
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl">
      <LiveRefresh tables={["conversations", "messages", "chats", "chat_messages"]} delay={250} />
      <PaneSwitch
        list={
          <Suspense fallback={<Skeleton className="h-full min-h-96" />}>
            <List />
          </Suspense>
        }
      >
        {children}
      </PaneSwitch>
    </div>
  );
}

async function List() {
  const [{ convs, requestsOn }, { on, groups }] = await Promise.all([loadConversations(), loadGroups()]);
  return <ConvList convs={convs} requestsOn={requestsOn} groups={on ? groups : null} />;
}
