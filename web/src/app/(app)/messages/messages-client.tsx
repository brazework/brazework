"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui";
import { cn, timeAgo } from "@/lib/forge";
import type { Conv } from "./data";

export function PaneSwitch({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const inThread = path !== "/messages";
  return (
    <div className="grid h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden rounded-3xl border border-line bg-surface/70 md:h-[calc(100dvh-4rem)] md:grid-cols-[320px_1fr]">
      <aside className={cn("min-h-0 flex-col border-line md:flex md:border-r", inThread ? "hidden" : "flex")}>{list}</aside>
      <section className={cn("min-h-0 flex-col md:flex", inThread ? "flex" : "hidden")}>{children}</section>
    </div>
  );
}

const isRequestToMe = (c: Conv) => c.status === "request" && !c.startedByMe;

export function ConvList({ convs, requestsOn }: { convs: Conv[]; requestsOn: boolean }) {
  const path = usePathname();
  const activeId = path.startsWith("/messages/") ? decodeURIComponent(path.split("/")[2] ?? "") : "";
  const requests = convs.filter(isRequestToMe);
  // With the request inbox off, requests stay in the Inbox, marked "Not connected".
  const inbox = requestsOn ? convs.filter((c) => !isRequestToMe(c)) : convs;
  const unread = inbox.filter((c) => c.unread);
  const startTab = activeId && requestsOn && requests.some((c) => c.id === activeId) ? "requests" : "inbox";
  const [tab, setTab] = useState<"inbox" | "unread" | "requests">(startTab);
  const shown = tab === "requests" ? requests : tab === "unread" ? unread : inbox;
  const tabs = [
    ["inbox", "Inbox", unread.length],
    ["unread", "Unread", 0],
    ...(requestsOn ? [["requests", "Requests", requests.length] as const] : []),
  ] as const;

  return (
    <>
      <div className="border-b border-line p-4">
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
        <div role="tablist" aria-label="Conversations" className="mt-3 flex gap-1">
          {tabs.map(([id, label, n]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition", tab === id ? "bg-accent text-on-accent" : "text-muted hover:bg-hover hover:text-text")}>
              {label}
              {n > 0 && <span className={cn("rounded-full px-1.5 font-mono text-[10px]", tab === id ? "bg-on-accent/15" : "bg-raised")}>{n}</span>}
            </button>
          ))}
        </div>
      </div>
      {tab === "requests" && <p className="border-b border-line px-4 py-3 text-xs text-muted">People you&apos;re not connected with land here first. They can&apos;t see that you&apos;ve read their message until you accept.</p>}
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} aria-current={c.id === activeId ? "page" : undefined} className={cn("flex gap-3 border-b border-line px-4 py-3.5 transition hover:bg-hover", c.id === activeId && "bg-raised")}>
              <Avatar first={c.other.firstName} last={c.other.lastName} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{`${c.other.firstName} ${c.other.lastName}`.trim() || "Forge member"}</span>
                  {c.lastAt && <span className="shrink-0 text-[11px] text-faint">{timeAgo(c.lastAt)}</span>}
                </div>
                <p className={cn("truncate text-sm", c.unread ? "text-text" : "text-muted")}>
                  {c.status === "request" && c.startedByMe && <span className="text-faint">Request sent · </span>}
                  {isRequestToMe(c) && !requestsOn && <span className="text-faint">Not connected · </span>}
                  {c.lastFromMe && "You: "}
                  {c.lastBody || "No messages yet"}
                </p>
              </div>
              {c.unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
            </Link>
          </li>
        ))}
        {!shown.length && (
          <li className="p-6 text-sm text-muted">
            {tab === "requests" ? "No message requests. You're all caught up." : tab === "unread" ? "No unread messages." : "No conversations yet. Message someone from their profile or your network."}
          </li>
        )}
      </ul>
    </>
  );
}
