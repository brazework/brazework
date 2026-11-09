"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowUp, ChevronDown, ExternalLink, Loader2, MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { cn, timeAgo } from "@/lib/forge";
import { sendChatMessage, markChatRead } from "@/lib/chats";
import { markConversationRead, sendMessage } from "@/lib/messages";
import { dockInbox, dockThread, type DockItem, type DockMsg } from "@/lib/dock";
import { getBrowserClient } from "@/lib/supabase/client";

const KEY = "forge-dock";

// Messages without leaving the feed (desktop): a bar in the corner that opens into your recent
// conversations and group chats; open one to read and answer it right here.
export function MessageDock() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DockItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [thread, setThread] = useState<DockItem | null>(null);
  const [msgs, setMsgs] = useState<DockMsg[] | null>(null);
  const [canSend, setCanSend] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => { try { setOpen(localStorage.getItem(KEY) === "open"); } catch {} }, 0); return () => clearTimeout(t); }, []);
  const toggle = () => setOpen((o) => { try { localStorage.setItem(KEY, o ? "closed" : "open"); } catch {} return !o; });

  const refreshInbox = useCallback(async () => { const r = await dockInbox().catch(() => null); if (r) { setItems(r.items); setUnread(r.unread); } }, []);
  const refreshThread = useCallback(async (t: DockItem) => {
    const r = await dockThread(t.kind, t.id).catch(() => null);
    if (r?.ok) { setMsgs(r.msgs); setCanSend(r.canSend); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void refreshInbox(), 0); return () => clearTimeout(t); }, [refreshInbox]);

  // New messages anywhere refresh the dock (Realtime, with a slow poll as a fallback).
  useEffect(() => {
    const sb = getBrowserClient();
    const ch = sb.channel(`dock-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => { void refreshInbox(); if (thread) void refreshThread(thread); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => { void refreshInbox(); if (thread) void refreshThread(thread); })
      .subscribe();
    const poll = setInterval(() => { if (open) { void refreshInbox(); if (thread) void refreshThread(thread); } }, 20_000);
    return () => { sb.removeChannel(ch); clearInterval(poll); };
  }, [open, thread, refreshInbox, refreshThread]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const openThread = async (t: DockItem) => {
    setThread(t); setMsgs(null); setError("");
    await refreshThread(t);
    if (t.kind === "dm" && !t.request) void markConversationRead(t.id); else if (t.kind === "group") void markChatRead(t.id);
    setItems((l) => l?.map((x) => (x.id === t.id ? { ...x, unread: false } : x)) ?? l);
    setUnread((n) => Math.max(0, n - (t.unread ? 1 : 0)));
  };
  const send = async () => {
    const text = draft.trim();
    if (!text || !thread || sending) return;
    setSending(true); setError("");
    setMsgs((m) => [...(m ?? []), { id: `p-${Date.now()}`, mine: true, name: "You", body: text, at: new Date().toISOString() }]);
    setDraft("");
    const r = await (thread.kind === "dm" ? sendMessage(thread.id, text) : sendChatMessage(thread.id, text)).catch(() => ({ ok: false, message: "Couldn't send. Check your connection." }));
    setSending(false);
    if (!r.ok) { setError(r.message); setDraft(text); }
    void refreshThread(thread); void refreshInbox();
  };

  return (
    // Steps aside while the welcome tour's card is in the same corner.
    <div className="fixed right-6 bottom-6 z-40 hidden w-[340px] lg:block [html[data-tour=on]_&]:!hidden">
      <AnimatePresence initial={false}>
        {open && (
          <motion.section aria-label="Messages" initial={{ opacity: 0, y: 12, height: 0 }} animate={{ opacity: 1, y: 0, height: 460 }} exit={{ opacity: 0, y: 12, height: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="mb-2 flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)]">
            {thread ? (
              <>
                <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                  <button type="button" onClick={() => { setThread(null); setMsgs(null); void refreshInbox(); }} aria-label="Back to conversations" className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-text"><ArrowLeft className="size-4" /></button>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{thread.title}</span>
                  <Link href={thread.kind === "dm" ? `/messages/${thread.id}` : `/messages/g/${thread.id}`} aria-label="Open in Messages" title="Open in Messages" className="grid size-8 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><ExternalLink className="size-4" /></Link>
                </header>
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
                  {msgs === null && <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Loading…</p>}
                  {msgs?.length === 0 && <p className="py-8 text-center text-xs text-muted">No messages yet. Say hello.</p>}
                  {msgs?.map((m, i) => (
                    <div key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
                      {thread.kind === "group" && !m.mine && msgs[i - 1]?.name !== m.name && <span className="px-2 text-[10px] text-faint">{m.name}</span>}
                      <p className={cn("max-w-[85%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap", m.mine ? "bg-accent-grad text-on-accent" : "bg-surface-2 text-text", m.id.startsWith("p-") && "opacity-60")}>{m.body}</p>
                    </div>
                  ))}
                  <div ref={end} />
                </div>
                {canSend ? (
                  <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="border-t border-line p-2">
                    {error && <p role="alert" className="mb-1 px-2 text-xs text-danger">{error}</p>}
                    <div className="flex items-end gap-1.5 rounded-2xl bg-surface-2/70 p-1">
                      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} maxLength={2000} placeholder="Write a message" aria-label="Write a message" className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm outline-none" />
                      <button type="submit" disabled={!draft.trim() || sending} aria-label="Send" className="bg-accent-grad grid size-9 shrink-0 place-items-center rounded-full text-on-accent disabled:opacity-40"><ArrowUp className="size-4" /></button>
                    </div>
                  </form>
                ) : (
                  <Link href={`/messages/${thread.id}`} className="border-t border-line p-3 text-center text-xs text-muted hover:text-text">Accept or decline this request in Messages →</Link>
                )}
              </>
            ) : (
              <>
                <header className="flex items-center justify-between border-b border-line px-4 py-3">
                  <span className="text-sm font-semibold">Messages</span>
                  <Link href="/messages" className="text-xs text-muted hover:text-text">Open all</Link>
                </header>
                <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
                  {items === null && <li className="flex items-center gap-2 p-3 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Loading…</li>}
                  {items?.length === 0 && <li className="p-6 text-center text-xs text-muted">No conversations yet. Message someone from their profile.</li>}
                  {items?.map((t) => (
                    <li key={`${t.kind}:${t.id}`}>
                      <button type="button" onClick={() => void openThread(t)} className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition hover:bg-hover">
                        {t.kind === "dm" ? <Avatar first={t.first} last={t.last} size={36} /> : <span className="nav-tile grid size-9 shrink-0 place-items-center rounded-xl text-text-2"><Users className="size-4" /></span>}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2"><span className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.title}</span>{t.request && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] text-muted">Request</span>}<span className="ml-auto shrink-0 text-[10px] text-faint">{t.at ? timeAgo(t.at) : ""}</span></span>
                          <span className={cn("block truncate text-xs", t.unread ? "text-text-2" : "text-muted")}>{t.preview || "No messages yet"}</span>
                        </span>
                        {t.unread && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
      <button type="button" onClick={toggle} aria-expanded={open} className="glass flex w-full items-center gap-2.5 rounded-2xl border border-line px-4 py-2.5 shadow-[var(--shadow)] transition hover:-translate-y-px">
        <MessageSquare className="size-4" />
        <span className="text-sm font-semibold">Messages</span>
        {unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent tabular-nums">{unread}</span>}
        <ChevronDown className={cn("ml-auto size-4 text-muted transition", !open && "rotate-180")} />
      </button>
    </div>
  );
}
