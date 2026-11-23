"use client";
import { emberCreditCost } from "@/lib/ember-credits";
import { bubbleCls, dayPillCls } from "@/components/chat/bubble";
import { ArrowUp, Check, ChevronDown, Eye, Hash, Loader2, Megaphone, Plus, Search, SmilePlus, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/forge";
import { useTimeZone } from "../../../events/local-time";
import { getBrowserClient } from "@/lib/supabase/client";
import { createTeamChat, markChatRead, sendChatMessage } from "@/lib/chats";
import { GroupMessageTools, REPLY, ReactionChips, ReplyBar, ReplyQuote, UNSEND_MS, startReply, useReactions, type Reaction, type ReplyTarget } from "@/components/chat/message-tools";
import { MessageBody } from "@/components/share/message-body";
import { Ember } from "@/components/ember/ember";
import { askEmberInChat } from "@/lib/chat-ember";

export type GroupMsg = { id: string; sender_id: string; sender_first: string; sender_last: string; body: string; announcement: boolean; ember?: boolean; created_at: string; reply_to?: string | null };
export type Seen = Record<string, { seen: number; total: number }>;

const SENT = "forge-chat-sent";
const FAILED = "forge-chat-failed";
const TYPING = "forge-chat-typing";
const EMBER = "forge-chat-ember"; // detail: { id, on }
const GROUP_MS = 5 * 60_000;
// In the viewer's time zone, which the server doesn't know: the server and the hydration render both
// use UTC (useTimeZone), so their HTML matches, then React re-renders in local time.
const day = (ts: string, tz?: string) => new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
const time = (ts: string, tz?: string) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });

export function MarkChatRead({ id, count }: { id: string; count: number }) {
  // Re-mark whenever new messages arrive while the chat is open.
  useEffect(() => { void markChatRead(id); }, [id, count]);
  return null;
}

// The conversation: messages from the same person within a few minutes hug together under one name;
// announcements stand out as cards (officers see who's seen them); what you send shows at once.
export function GroupThread({ msgs, pics = {}, me, myName, chatId, seen = {}, reactions = [], extras = false }: { msgs: GroupMsg[]; pics?: Record<string, string | null>; me: string; myName: string; chatId: string; seen?: Seen; reactions?: Reaction[]; extras?: boolean }) {
  const tz = useTimeZone();
  const end = useRef<HTMLDivElement>(null);
  const rx = useReactions("group", me, reactions);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (active) document.getElementById(`group-message-tools-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const [pending, setPending] = useState<GroupMsg[]>([]);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [emberBusy, setEmberBusy] = useState(false);
  const mine = new Set(msgs.filter((m) => m.sender_id === me).slice(-20).map((m) => m.body));
  const all = [...msgs, ...pending.filter((p) => !mine.has(p.body))].filter((m) => !rx.removed.has(m.id));
  const byId = new Map(all.map((m) => [m.id, m]));
  const nameOf = (m: GroupMsg) => (m.ember ? "Ember" : m.sender_id === me ? "You" : `${m.sender_first} ${m.sender_last}`.trim());

  useEffect(() => {
    const onSent = (e: Event) => { const d = (e as CustomEvent<{ id: string; body: string; announcement: boolean }>).detail; if (d.id === chatId) setPending((p) => [...p, { id: `pending-${Date.now()}`, sender_id: me, sender_first: myName, sender_last: "", body: d.body, announcement: d.announcement, created_at: new Date().toISOString() }]); };
    const onFailed = (e: Event) => { const d = (e as CustomEvent<{ id: string; body: string }>).detail; if (d.id === chatId) setPending((p) => p.filter((m) => m.body !== d.body)); };
    const onEmber = (e: Event) => { const d = (e as CustomEvent<{ id: string; on: boolean }>).detail; if (d.id === chatId) setEmberBusy(d.on); };
    window.addEventListener(SENT, onSent);
    window.addEventListener(FAILED, onFailed);
    window.addEventListener(EMBER, onEmber);
    // "Maya is typing…": a broadcast on this chat's channel, nothing stored; each name clears after 3.5s.
    const sb = getBrowserClient();
    const ch = sb.channel(`typing:g:${chatId}`);
    ch.on("broadcast", { event: "typing" }, ({ payload }: { payload?: { uid?: string; name?: string } }) => {
      if (!payload?.uid || payload.uid === me) return;
      const name = payload.name || "Someone";
      setTyping((t) => ({ ...t, [name]: Date.now() }));
      setTimeout(() => setTyping((t) => { const n = { ...t }; if (Date.now() - (n[name] ?? 0) >= 3400) delete n[name]; return n; }), 3500);
    });
    ch.subscribe();
    let last = 0;
    const onTyping = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail.id !== chatId || Date.now() - last < 2000) return;
      last = Date.now();
      void ch.send({ type: "broadcast", event: "typing", payload: { uid: me, name: myName } });
    };
    window.addEventListener(TYPING, onTyping);
    return () => { window.removeEventListener(EMBER, onEmber); window.removeEventListener(SENT, onSent); window.removeEventListener(FAILED, onFailed); window.removeEventListener(TYPING, onTyping); sb.removeChannel(ch); };
  }, [chatId, me, myName]);
  const typers = Object.keys(typing);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [all.length, typers.length, emberBusy]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
      {!all.length && <p className="py-12 text-center text-sm text-muted">No messages yet. Start the conversation.</p>}
      <ol className="flex flex-col">
        {all.map((m, i) => {
          const isEmber = !!m.ember;
          const isMine = m.sender_id === me && !isEmber;
          const prev = all[i - 1];
          const next = all[i + 1];
          const d = day(m.created_at, tz);
          const showDay = !prev || d !== day(prev.created_at, tz);
          const joinsPrev = !showDay && !m.announcement && prev && !prev.announcement && prev.sender_id === m.sender_id && !!prev.ember === isEmber && Date.parse(m.created_at) - Date.parse(prev.created_at) < GROUP_MS;
          const joinsNext = !m.announcement && next && !next.announcement && next.sender_id === m.sender_id && !!next.ember === isEmber && day(next.created_at, tz) === d && Date.parse(next.created_at) - Date.parse(m.created_at) < GROUP_MS;
          const isPending = m.id.startsWith("pending-");
          const s = seen[m.id];
          const toolsId = `group-message-tools-${m.id}`;
          const toolsOpen = active === m.id;
          const canUseTools = extras && !isPending;
          const closeTools = () => {
            document.getElementById(`group-message-actions-${m.id}`)?.focus({ preventScroll: true });
            setActive(null);
          };
          return (
            <li key={m.id} className={cn("flex flex-col", joinsPrev ? "mt-0.5" : "mt-3")} onKeyDown={(event) => {
              if (event.key === "Escape" && toolsOpen) closeTools();
            }}>
              {showDay && <span className={cn("mb-3 self-center", dayPillCls)}>{d}</span>}
              {m.announcement ? (
                <div className={cn("glass-card mx-auto w-full max-w-xl rounded-2xl border-l-4 border-l-text p-4", isPending && "opacity-60")}>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Megaphone className="size-3.5 text-text" /> <span className="font-medium text-text">Announcement</span> · {m.sender_first} {m.sender_last} · {isPending ? "Sending…" : time(m.created_at, tz)}
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  {s && <p className="mt-2 inline-flex items-center gap-1 text-xs text-faint"><Eye className="size-3.5" /> Seen by {s.seen} of {s.total}</p>}
                </div>
              ) : (
                <div className={cn("flex items-end gap-2", isMine ? "flex-row-reverse" : "flex-row")}>
                  {!isMine && <span className="w-7 shrink-0">{!joinsNext && (isEmber ? <Ember size={28} /> : <Avatar first={m.sender_first} last={m.sender_last} size={28} className="text-[10px]" src={pics[m.sender_id]} />)}</span>}
                  <div className={cn("min-w-0 w-fit max-w-[85%]", !isMine && "mr-1")}>
                    {!isMine && !joinsPrev && <div className="mb-0.5 px-2 text-[11px] font-medium text-muted">{isEmber ? <>Ember <span className="font-normal text-faint">· asked by {m.sender_first}</span></> : <>{m.sender_first} {m.sender_last}</>}</div>}
                    <div className={cn("group/msg flex min-w-0 items-center gap-1", isMine && "flex-row-reverse")}>
                      <div className={cn("min-w-0", bubbleCls({ mine: isMine, joinsPrev: !!joinsPrev, joinsNext: !!joinsNext, pending: isPending }))}>
                        {m.reply_to && (() => { const q = byId.get(m.reply_to!); return <ReplyQuote target={q ? { id: q.id, name: nameOf(q), body: q.body } : null} mine={isMine} />; })()}
                        <MessageBody body={m.body} mine={isMine} />
                      </div>
                      {canUseTools && <button
                        id={`group-message-actions-${m.id}`}
                        type="button"
                        aria-label="Message actions"
                        title="React or reply"
                        aria-expanded={toolsOpen}
                        aria-controls={toolsOpen ? toolsId : undefined}
                        onClick={() => setActive(toolsOpen ? null : m.id)}
                        className={cn("grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-hover hover:text-text focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent", toolsOpen ? "bg-hover" : "pointer-fine:opacity-0 pointer-fine:group-hover/msg:opacity-100")}
                      ><SmilePlus className="size-[17px]" /></button>}
                    </div>
                    <ReactionChips list={rx.reactions.filter((x) => x.message_id === m.id)} me={me} mine={isMine} onToggle={(e) => void rx.toggle(m.id, e)} />
                    {!joinsNext && <div className={cn("mt-1 px-2 text-[10px] text-faint", isMine && "text-right")}>{isPending ? "Sending…" : time(m.created_at, tz)}</div>}
                  </div>
                </div>
              )}
              {!m.announcement && canUseTools && toolsOpen && (
                <GroupMessageTools
                  id={toolsId}
                  mine={isMine}
                  canUnsend={isMine && now - Date.parse(m.created_at) < UNSEND_MS}
                  onReact={(emoji) => { closeTools(); void rx.toggle(m.id, emoji); }}
                  onReply={() => { closeTools(); startReply(`g:${chatId}`, { id: m.id, name: nameOf(m), body: m.body.slice(0, 140) }); }}
                  onUnsend={() => { closeTools(); void rx.unsend(m.id); }}
                />
              )}
            </li>
          );
        })}
      </ol>
      {rx.error && <p role="alert" className="mt-2 text-center text-xs text-danger" onClick={rx.clearError}>{rx.error}</p>}
      {emberBusy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted"><Ember size={28} mood="thinking" /> Ember is thinking…</div>
      )}
      {typers.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span className="glass-card inline-flex gap-1 rounded-lg px-3 py-2.5" aria-hidden="true">{[0, 1, 2].map((k) => <span key={k} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${k * 120}ms` }} />)}</span>
          {typers.length === 1 ? `${typers[0]} is typing…` : `${typers.slice(0, 2).join(" and ")}${typers.length > 2 ? " and others" : ""} are typing…`}
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

export function GroupComposer({ chatId, canAnnounce = false, placeholder = "Write a message", ember = false }: { chatId: string; canAnnounce?: boolean; placeholder?: string; ember?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<{ scope: string; target: ReplyTarget }>).detail; if (d.scope === `g:${chatId}`) { setReply(d.target); requestAnimationFrame(() => ref.current?.focus()); } };
    window.addEventListener(REPLY, on);
    return () => window.removeEventListener(REPLY, on);
  }, [chatId]);
  const [pending, start] = useTransition();
  const send = () => {
    const text = body.trim();
    if (!text) return;
    const asAnnouncement = canAnnounce && announce;
    window.dispatchEvent(new CustomEvent(SENT, { detail: { id: chatId, body: text, announcement: asAnnouncement } }));
    setBody("");
    const replyTo = reply?.id ?? null;
    setReply(null);
    setAnnounce(false);
    start(async () => {
      setError("");
      const fail = (message: string) => { setError(message); setBody(text); window.dispatchEvent(new CustomEvent(FAILED, { detail: { id: chatId, body: text } })); };
      try {
        const r = await sendChatMessage(chatId, text, asAnnouncement, replyTo);
        if (!r.ok) return fail(r.message);
      } catch {
        return fail("Couldn't send. Check your connection and try again.");
      }
      // "@Ember …": once the question is in the chat, Ember answers the group.
      if (ember && /^@ember\b/i.test(text)) {
        window.dispatchEvent(new CustomEvent(EMBER, { detail: { id: chatId, on: true } }));
        try {
          const a = await askEmberInChat(chatId, text);
          if (!a.ok) setError(a.message);
        } catch {
          setError("Ember couldn't answer. Try again.");
        } finally {
          window.dispatchEvent(new CustomEvent(EMBER, { detail: { id: chatId, on: false } }));
        }
      }
    });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-line p-3">
      {error && <p role="alert" className="mb-2 px-1 text-xs text-danger">{error}</p>}
      {ember && !body && (
        <button type="button" onClick={() => { setBody("@Ember "); ref.current?.focus(); }} className="mb-2 mr-3 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-text-2 transition hover:bg-hover"><Ember size={16} /> Ask Ember · {emberCreditCost("group_ask")}</button>
      )}
      {ember && /^@ember\b/i.test(body.trim()) && <p className="mb-2 px-1 text-xs text-muted">{emberCreditCost("group_ask")} to ask Ember</p>}
      {canAnnounce && (
        <label className="mb-2 inline-flex cursor-pointer items-center gap-2 px-1 text-xs text-muted">
          <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} className="size-3.5 accent-[var(--text)]" />
          <Megaphone className="size-3.5" /> Post as an announcement <span className="text-faint">(stands out, and you see who&apos;s read it)</span>
        </label>
      )}
      {reply && <ReplyBar target={reply} onCancel={() => setReply(null)} />}
      <div className="glass-card flex items-end gap-2 rounded-3xl p-1.5">
        <label htmlFor="gmsg" className="sr-only">Message</label>
        <textarea
          ref={ref}
          id="gmsg"
          value={body}
          onChange={(e) => { setBody(e.target.value); window.dispatchEvent(new CustomEvent(TYPING, { detail: { id: chatId } })); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          rows={1}
          maxLength={2000}
          placeholder={announce ? "Write the announcement" : placeholder}
          style={{ outline: "none" }}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-text placeholder:text-faint"
        />
        <button type="submit" disabled={!body.trim()} aria-label="Send" className="bg-accent-grad grid size-10 shrink-0 place-items-center rounded-full text-on-accent transition active:scale-90 disabled:opacity-40">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
    </form>
  );
}

// The club's chats in one menu (FIX-248): its main chat, the team chats you're in, and "New team chat".
// Switching opens that chat in this same screen; the list on the left keeps one row per club.
export type ClubChatLink = { id: string; kind: "club" | "team"; name: string };
export function TeamSwitcher({ communityId, current, chats, members, me }: { communityId: string; current: string; chats: ClubChatLink[]; members: { uid: string; first: string; last: string }[]; me: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "menu" | "new">("closed");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode !== "menu") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMode("closed");
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setMode("closed"); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [mode]);
  const main = chats.find((c) => c.kind === "club");
  const teams = chats.filter((c) => c.kind === "team").sort((a, b) => a.name.localeCompare(b.name));
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-hover";
  const go = (id: string) => { setMode("closed"); if (id !== current) router.push(`/messages/g/${id}`); };
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setMode(mode === "menu" ? "closed" : "menu")} aria-haspopup="menu" aria-expanded={mode === "menu"} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-text-2 transition hover:bg-hover">
        <Hash className="size-3.5" /> Teams{teams.length ? <span className="font-mono text-[10px] text-faint">{teams.length}</span> : null} <ChevronDown className="size-3.5" />
      </button>
      {mode === "menu" && (
        <div role="menu" aria-label="Club chats" className="absolute top-full right-0 z-30 mt-2 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
          {main && (
            <button type="button" role="menuitemradio" aria-checked={main.id === current} onClick={() => go(main.id)} className={item}>
              <Users className="size-4 shrink-0 text-muted" /> <span className="flex-1 truncate">Main club chat</span>{main.id === current && <Check className="size-4" />}
            </button>
          )}
          {teams.length > 0 && <div className="mx-2.5 mt-1.5 mb-1 font-mono text-[10px] tracking-wide text-faint uppercase">Team chats</div>}
          {teams.map((t) => (
            <button key={t.id} type="button" role="menuitemradio" aria-checked={t.id === current} onClick={() => go(t.id)} className={item}>
              <Hash className="size-4 shrink-0 text-muted" /> <span className="flex-1 truncate">{t.name}</span>{t.id === current && <Check className="size-4" />}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" onClick={() => setMode("new")} className={cn(item, "font-medium")}><Plus className="size-4 shrink-0" /> New team chat</button>
        </div>
      )}
      {mode === "new" && <NewTeamChat communityId={communityId} members={members} me={me} defaultOpen onClose={() => setMode("closed")} />}
    </div>
  );
}

// Start a team chat inside the club: name it, pick people from the club, go.
export function NewTeamChat({ communityId, members, me, defaultOpen = false, onClose }: { communityId: string; members: { uid: string; first: string; last: string }[]; me: string; defaultOpen?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const [open, setOpenState] = useState(defaultOpen);
  const setOpen = (v: boolean) => { setOpenState(v); if (!v) onClose?.(); };
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const others = members.filter((m) => m.uid !== me && `${m.first} ${m.last}`.toLowerCase().includes(q.trim().toLowerCase()));
  if (!open)
    return <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-text-2 transition hover:bg-hover"><Plus className="size-3.5" /> Team chat</button>;
  return (
    <div className="absolute top-full right-3 z-30 mt-2 w-80 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-float)]">
      <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Hash className="size-4" /> New team chat</span><button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-faint hover:text-text"><X className="size-4" /></button></div>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name, e.g. Avionics" autoFocus className="mt-3 h-10 w-full rounded-xl border border-line bg-surface/70 px-3 text-sm outline-none focus:border-text" />
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people in the club" className="h-9 w-full rounded-xl border border-line bg-surface/70 pr-3 pl-8 text-sm outline-none focus:border-text" />
      </div>
      <ul className="mt-2 max-h-48 overflow-y-auto">
        {others.map((m) => {
          const on = picked.includes(m.uid);
          return (
            <li key={m.uid}>
              <button type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== m.uid) : [...p, m.uid]))} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-hover">
                <Avatar first={m.first} last={m.last} size={24} className="text-[9px]" /> <span className="flex-1 truncate">{m.first} {m.last}</span>
                {on && <Check className="size-4" />}
              </button>
            </li>
          );
        })}
        {!others.length && <li className="px-2 py-3 text-xs text-muted">No one matches.</li>}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      <button type="button" disabled={pending || !name.trim()} onClick={() => start(async () => { const r = await createTeamChat(communityId, name, picked); if (r.ok && r.id) router.push(`/messages/g/${r.id}`); else setError(r.message); })} className="bg-accent-grad mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-sm font-medium text-on-accent disabled:opacity-50">
        {pending && <Loader2 className="size-4 animate-spin" />} Start chat{picked.length ? ` with ${picked.length}` : ""}
      </button>
    </div>
  );
}
