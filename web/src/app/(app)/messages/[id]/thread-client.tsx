"use client";
import { ArrowUp, Loader2 } from "lucide-react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/forge";
import { acceptConversation, blockAndReport, declineConversation, markConversationRead, sendMessage } from "@/lib/messages";

export type Msg = { id: string; sender_id: string; body: string; created_at: string };

export function MarkRead({ cid }: { cid: string }) {
  useEffect(() => { void markConversationRead(cid); }, [cid]);
  return null;
}

const day = (ts: string) => new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const time = (ts: string) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function ThreadScroll({ msgs, me }: { msgs: Msg[]; me: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
      {!msgs.length && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello.</p>}
      <ol className="flex flex-col gap-1.5">
        {msgs.map((m, i) => {
          const mine = m.sender_id === me;
          const d = day(m.created_at);
          const showDay = i === 0 || d !== day(msgs[i - 1].created_at);
          return (
            <li key={m.id} className="flex flex-col">
              {showDay && <span className="my-3 self-center rounded-full border border-line px-3 py-0.5 font-mono text-[10px] text-faint">{d}</span>}
              <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap", mine ? "self-end rounded-br-md bg-accent text-on-accent" : "self-start rounded-bl-md bg-raised text-text")}>
                {m.body}
                <span className={cn("ml-2 align-bottom text-[10px]", mine ? "text-on-accent/60" : "text-faint")}>{time(m.created_at)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={end} />
    </div>
  );
}

export function Composer({ cid, placeholder }: { cid: string; placeholder: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [sending, setSending] = useOptimistic(false, (_: boolean, v: boolean) => v);
  const send = () => {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      setError("");
      setSending(true);
      setBody("");
      const r = await sendMessage(cid, text);
      if (!r.ok) { setError(r.message); setBody(text); }
    });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-line p-3">
      {error && <p role="alert" className="mb-2 px-1 text-xs text-danger">{error}</p>}
      <div className="flex items-end gap-2">
        <label htmlFor="msg" className="sr-only">Message</label>
        <textarea
          id="msg"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          rows={1}
          maxLength={2000}
          placeholder={placeholder}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-[15px] text-text outline-none placeholder:text-faint focus:border-text"
        />
        <button type="submit" disabled={pending || !body.trim()} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition hover:opacity-90 disabled:opacity-40">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
    </form>
  );
}

export function RequestBar({ cid, firstName }: { cid: string; firstName: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const btn = "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-3">
      <p className="mr-auto text-sm text-text-2">{firstName || "This member"} isn&apos;t connected with you yet.</p>
      <button className={cn(btn, "bg-accent text-on-accent hover:opacity-90")} disabled={pending} onClick={() => start(async () => { const r = await acceptConversation(cid); if (!r.ok) setError(r.message); })}>Accept</button>
      <button className={cn(btn, "border border-line hover:bg-hover")} disabled={pending} onClick={() => start(async () => { await declineConversation(cid); })}>Decline</button>
      <button className={cn(btn, "text-danger hover:bg-hover")} disabled={pending} onClick={() => confirm("Block and report? They won't be able to message you, and we get a copy of these messages.") && start(async () => { const r = await blockAndReport(cid); if (r && !r.ok) setError(r.message); })}>Block &amp; report</button>
      {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
