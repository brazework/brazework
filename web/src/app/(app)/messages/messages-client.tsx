"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Hash, Search, Users, X } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui";
import { WithPresence } from "@/components/presence/presence";
import { cn, timeAgo } from "@/lib/forge";
import type { Conv, GroupChat } from "./data";

// Two panes on desktop; on phones the list shows until a thread page (marked data-thread) is open.
// Pure CSS (:has), so the layout needs no runtime URL read and still prerenders.
export function PaneSwitch({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-card group/msg grid grid-cols-1 h-[calc(100dvh-12rem)] min-h-[420px] overflow-hidden rounded-3xl md:h-[calc(100dvh-7.5rem)] md:grid-cols-[320px_1fr] 2xl:grid-cols-[360px_1fr]">
      <aside className="flex min-h-0 flex-col border-line group-has-[[data-thread]]/msg:hidden md:flex! md:border-r">{list}</aside>
      <section className="hidden min-h-0 flex-col group-has-[[data-thread]]/msg:flex md:flex">{children}</section>
    </div>
  );
}

const isRequestToMe = (c: Conv) => c.status === "request" && !c.startedByMe;

const KIND_ICON = { club: Users, event: CalendarDays, team: Hash } as const;

export function ConvList({ convs, requestsOn, groups = null }: { convs: Conv[]; requestsOn: boolean; groups?: GroupChat[] | null }) {
  const path = usePathname();
  const params = useSearchParams();
  const inGroup = path.startsWith("/messages/g/");
  const activeGroup = inGroup ? decodeURIComponent(path.split("/")[3] ?? "") : "";
  const activeId = path.startsWith("/messages/") ? decodeURIComponent(path.split("/")[2] ?? "") : "";
  const requests = convs.filter(isRequestToMe);
  // With the request inbox off, requests stay in the Inbox, marked "Not connected".
  const inbox = requestsOn ? convs.filter((c) => !isRequestToMe(c)) : convs;
  const unread = inbox.filter((c) => c.unread);
  const startTab = groups && (inGroup || params.get("tab") === "groups") ? "groups" : activeId && requestsOn && requests.some((c) => c.id === activeId) ? "requests" : "inbox";
  const [tab, setTab] = useState<"inbox" | "groups" | "unread" | "requests">(startTab);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = (tab === "requests" ? requests : tab === "unread" ? unread : inbox).filter((c) => !needle || `${c.other.firstName} ${c.other.lastName} ${c.lastBody}`.toLowerCase().includes(needle));
  const shownGroups = (groups ?? []).filter((g) => !needle || `${g.title} ${g.subtitle} ${g.lastBody}`.toLowerCase().includes(needle));
  const tabs = [
    ["inbox", "Inbox", unread.length],
    ...(groups ? [["groups", "Groups", groups.filter((g) => g.unread).length] as const] : []),
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
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <label htmlFor="conv-q" className="sr-only">Search messages</label>
          <input id="conv-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people and messages" style={{ outline: "none" }} className="h-9 w-full rounded-full bg-surface-2/70 pr-8 pl-9 text-sm placeholder:text-faint focus:bg-surface-2" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-text"><X className="size-3.5" /></button>}
        </div>
      </div>
      {tab === "requests" && <p className="border-b border-line px-4 py-3 text-xs text-muted">People you&apos;re not connected with land here first. They can&apos;t see that you&apos;ve read their message until you accept.</p>}
      {tab === "groups" ? (
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {shownGroups.map((g) => {
            const Icon = KIND_ICON[g.kind];
            return (
              <li key={g.id}>
                <Link href={`/messages/g/${g.id}`} aria-current={g.id === activeGroup ? "page" : undefined} className={cn("flex gap-3 rounded-2xl px-3 py-3 transition hover:bg-hover/70", g.id === activeGroup && "nav-pill")}>
                  <span className="nav-tile grid size-10 shrink-0 place-items-center rounded-xl text-text-2"><Icon className="size-[18px]" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", g.unread ? "font-semibold" : "font-medium")}>{g.title}</span>
                      {g.lastAt && <span className="shrink-0 text-[11px] text-faint">{timeAgo(g.lastAt)}</span>}
                    </div>
                    <p className={cn("truncate text-sm", g.unread ? "text-text" : "text-muted")}>
                      {g.lastBody ? <>{g.lastFromMe ? "You" : g.lastSenderName || "Someone"}: {g.lastBody}</> : <span className="text-faint">{g.subtitle} · say hello</span>}
                    </p>
                  </div>
                  {g.unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
          {!shownGroups.length && <li className="p-6 text-sm text-muted">{needle ? <>Nothing matches &ldquo;{q}&rdquo;.</> : "Join a club or RSVP to an event and its chat shows up here."}</li>}
        </ul>
      ) : (
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} aria-current={c.id === activeId ? "page" : undefined} className={cn("flex gap-3 rounded-2xl px-3 py-3 transition hover:bg-hover/70", c.id === activeId && "nav-pill")}>
              <WithPresence id={c.other.id} className="self-start"><Avatar first={c.other.firstName} last={c.other.lastName} size={40} /></WithPresence>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{`${c.other.firstName} ${c.other.lastName}`.trim() || "Brazework member"}</span>
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
            {needle ? <>Nothing matches &ldquo;{q}&rdquo;.</> : tab === "requests" ? "No message requests. You're all caught up." : tab === "unread" ? "No unread messages." : "No conversations yet. Message someone from their profile or your network."}
          </li>
        )}
      </ul>
      )}
    </>
  );
}
