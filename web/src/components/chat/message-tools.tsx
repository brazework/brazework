// No "use client": imported only by client components (the chat threads), bundled with them.
import { CornerUpLeft, SmilePlus, Undo2, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";
import { toggleReaction, unsendMessage } from "@/lib/messages";

// Reactions, replies and unsend (supabase/chat-extras.sql), shared by direct messages and group
// chats. Hover a message (or tap it on a phone) for its toolbar; reactions show as chips under it.

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "🚀", "💡"];
export const UNSEND_MS = 15 * 60_000;
export type Reaction = { message_id: string; user_id: string; emoji: string };
export type ReplyTarget = { id: string; name: string; body: string };

// The composer and the thread talk through a window event (as for sends), so replies don't need
// shared state across server-rendered parts.
export const REPLY = "forge-reply";
export const startReply = (scope: string, target: ReplyTarget) => window.dispatchEvent(new CustomEvent(REPLY, { detail: { scope, target } }));

// Reactions for one thread: the server's list, plus your changes until the page refreshes.
export function useReactions(kind: "dm" | "group", me: string, initial: Reaction[]) {
  const [seen, setSeen] = useState(initial);
  const [list, setList] = useState(initial);
  if (initial !== seen) { setSeen(initial); setList(initial); }
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const toggle = async (messageId: string, emoji: string) => {
    const on = !list.some((r) => r.message_id === messageId && r.user_id === me && r.emoji === emoji);
    setList((l) => (on ? [...l, { message_id: messageId, user_id: me, emoji }] : l.filter((r) => !(r.message_id === messageId && r.user_id === me && r.emoji === emoji))));
    const r = await toggleReaction(kind, messageId, emoji, on).catch(() => ({ ok: false, message: "Couldn't save that." }));
    if (!r.ok) { setError(r.message); setList((l) => (on ? l.filter((x) => !(x.message_id === messageId && x.user_id === me && x.emoji === emoji)) : [...l, { message_id: messageId, user_id: me, emoji }])); }
  };
  const unsend = async (messageId: string) => {
    if (!confirm("Unsend this message? It's removed for everyone.")) return;
    setRemoved((s) => new Set(s).add(messageId));
    const r = await unsendMessage(kind, messageId).catch(() => ({ ok: false, message: "Couldn't unsend that." }));
    if (!r.ok) { setError(r.message); setRemoved((s) => { const n = new Set(s); n.delete(messageId); return n; }); }
  };
  return { reactions: list, toggle, unsend, removed, error, clearError: () => setError("") };
}

// The toolbar above a message.
export function MessageTools({ mine, canUnsend, open, onReact, onReply, onUnsend }: { mine: boolean; canUnsend: boolean; open: boolean; onReact: (e: string) => void; onReply: () => void; onUnsend: () => void }) {
  const [all, setAll] = useState(false);
  const btn = "grid size-8 place-items-center rounded-full text-base transition hover:bg-hover active:scale-90";
  return (
    <div role="toolbar" aria-label="Message actions" className={cn("absolute -top-9 z-20 flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow-[var(--shadow)] transition", mine ? "right-0" : "left-0", open ? "visible opacity-100" : "invisible opacity-0 group-hover/msg:visible group-hover/msg:opacity-100")}>
      {(all ? REACTIONS : REACTIONS.slice(0, 4)).map((e) => <button key={e} type="button" onClick={() => onReact(e)} aria-label={`React ${e}`} className={btn}>{e}</button>)}
      {!all && <button type="button" onClick={() => setAll(true)} aria-label="More reactions" className={cn(btn, "text-faint")}><SmilePlus className="size-4" /></button>}
      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
      <button type="button" onClick={onReply} aria-label="Reply" title="Reply" className={cn(btn, "text-muted")}><CornerUpLeft className="size-4" /></button>
      {canUnsend && <button type="button" onClick={onUnsend} aria-label="Unsend" title="Unsend" className={cn(btn, "text-muted hover:text-danger")}><Undo2 className="size-4" /></button>}
    </div>
  );
}

// Reaction chips under a message: one per emoji with a count; yours is highlighted, tap to toggle.
export function ReactionChips({ list, me, mine, onToggle }: { list: Reaction[]; me: string; mine: boolean; onToggle: (e: string) => void }) {
  if (!list.length) return null;
  const by = REACTIONS.map((e) => ({ e, n: list.filter((r) => r.emoji === e).length, me: list.some((r) => r.emoji === e && r.user_id === me) })).filter((x) => x.n);
  return (
    <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
      {by.map((x) => (
        <button key={x.e} type="button" onClick={() => onToggle(x.e)} aria-pressed={x.me} aria-label={`${x.e} ${x.n}${x.me ? ", including you" : ""}`} className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition active:scale-95", x.me ? "border-accent bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]" : "border-line bg-surface")}>
          {x.e} <span className="tabular-nums text-text-2">{x.n}</span>
        </button>
      ))}
    </div>
  );
}

// The quoted message inside a reply.
export function ReplyQuote({ target, mine }: { target: ReplyTarget | null; mine: boolean }) {
  if (!target) return <div className={cn("mb-1 border-l-2 pl-2 text-xs italic", mine ? "border-on-accent/40 text-on-accent/70" : "border-line-strong text-faint")}>Original message was removed</div>;
  return (
    <div className={cn("mb-1.5 border-l-2 pl-2 text-xs", mine ? "border-on-accent/50 text-on-accent/80" : "border-line-strong text-muted")}>
      <span className="font-medium">{target.name}</span>
      <span className="line-clamp-2 block">{target.body}</span>
    </div>
  );
}

// "Replying to …" above the composer.
export function ReplyBar({ target, onCancel }: { target: ReplyTarget; onCancel: () => void }) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-2xl border border-line bg-surface-2/70 px-3 py-2 text-xs">
      <CornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-faint" />
      <span className="min-w-0 flex-1"><span className="font-medium text-text">Replying to {target.name}</span><span className="block truncate text-muted">{target.body}</span></span>
      <button type="button" onClick={onCancel} aria-label="Cancel reply" className="grid size-6 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-3.5" /></button>
    </div>
  );
}
