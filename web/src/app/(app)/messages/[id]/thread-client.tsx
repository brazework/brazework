"use client";
import { ArrowUp, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/forge";
import { getBrowserClient } from "@/lib/supabase/client";
import { acceptConversation, blockAndReport, declineConversation, markConversationRead, sendMessage } from "@/lib/messages";

export type Msg = { id: string; sender_id: string; body: string; created_at: string };

export function MarkRead({ cid }: { cid: string }) {
  useEffect(() => { void markConversationRead(cid); }, [cid]);
  return null;
}

const day = (ts: string) => new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const time = (ts: string) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Messages you just sent show at once (pending) until the real row arrives; the composer and the
// thread talk through window events so the thread owns the one realtime channel per conversation.
const SENT = "forge-msg-sent";
const TYPING = "forge-typing";
const FAILED = "forge-msg-failed";
const GROUP_MS = 5 * 60_000;

export function ThreadScroll({ msgs, me, cid, otherName = "" }: { msgs: Msg[]; me: string; cid: string; otherName?: string }) {
  const end = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  // Drop a pending message once the server's copy (same body, from me) is in the list.
  const mineBodies = new Set(msgs.filter((m) => m.sender_id === me).slice(-20).map((m) => m.body));
  const waiting = pending.filter((p) => !mineBodies.has(p.body));
  const all = [...msgs, ...waiting];

  useEffect(() => {
    const onSent = (e: Event) => { const d = (e as CustomEvent<{ cid: string; body: string }>).detail; if (d.cid === cid) setPending((p) => [...p, { id: `pending-${Date.now()}`, sender_id: me, body: d.body, created_at: new Date().toISOString() }]); };
    const onFailed = (e: Event) => { const d = (e as CustomEvent<{ cid: string; body: string }>).detail; if (d.cid === cid) setPending((p) => p.filter((m) => m.body !== d.body)); };
    window.addEventListener(SENT, onSent);
    window.addEventListener(FAILED, onFailed);
    // "Typing…": a broadcast on this conversation's channel (nothing stored), cleared after 3.5s of quiet.
    const sb = getBrowserClient();
    const ch = sb.channel(`typing:${cid}`);
    let clear: ReturnType<typeof setTimeout> | undefined;
    ch.on("broadcast", { event: "typing" }, ({ payload }: { payload?: { uid?: string } }) => {
      if (payload?.uid === me) return;
      setTyping(true);
      clearTimeout(clear);
      clear = setTimeout(() => setTyping(false), 3500);
    });
    ch.subscribe();
    let last = 0;
    const onTyping = (e: Event) => {
      if ((e as CustomEvent<{ cid: string }>).detail.cid !== cid || Date.now() - last < 2000) return;
      last = Date.now();
      void ch.send({ type: "broadcast", event: "typing", payload: { uid: me } });
    };
    window.addEventListener(TYPING, onTyping);
    return () => { window.removeEventListener(SENT, onSent); window.removeEventListener(FAILED, onFailed); window.removeEventListener(TYPING, onTyping); clearTimeout(clear); sb.removeChannel(ch); };
  }, [cid, me]);
  // A new message from them ends their "typing…".
  const lastOther = msgs.findLast((m) => m.sender_id !== me)?.id;
  const [seenOther, setSeenOther] = useState(lastOther);
  if (lastOther !== seenOther) { setSeenOther(lastOther); setTyping(false); }

  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [all.length, typing]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
      {!all.length && (
        <div className="flex flex-col items-center py-12 text-center">
          <span className="nav-tile grid size-12 place-items-center rounded-2xl text-xl">👋</span>
          <p className="mt-3 text-sm text-muted">No messages yet. Say hello{otherName ? ` to ${otherName}` : ""}.</p>
        </div>
      )}
      <ol className="flex flex-col">
        {all.map((m, i) => {
          const mine = m.sender_id === me;
          const prev = all[i - 1];
          const next = all[i + 1];
          const d = day(m.created_at);
          const showDay = !prev || d !== day(prev.created_at);
          // Consecutive messages from the same person within a few minutes hug together.
          const joinsPrev = !showDay && prev && prev.sender_id === m.sender_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < GROUP_MS;
          const joinsNext = next && next.sender_id === m.sender_id && day(next.created_at) === d && Date.parse(next.created_at) - Date.parse(m.created_at) < GROUP_MS;
          const isPending = m.id.startsWith("pending-");
          return (
            <li key={m.id} className={cn("flex flex-col", joinsPrev ? "mt-0.5" : "mt-3")}>
              {showDay && <span className="glass-card mb-3 self-center rounded-full px-3 py-0.5 text-[11px] text-faint">{d}</span>}
              <div className={cn(
                "max-w-[78%] px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap transition-opacity",
                mine ? "bg-accent-grad self-end text-on-accent" : "glass-card self-start text-text",
                mine ? cn("rounded-3xl", joinsPrev && "rounded-tr-md", joinsNext && "rounded-br-md") : cn("rounded-3xl", joinsPrev && "rounded-tl-md", joinsNext && "rounded-bl-md"),
                isPending && "opacity-60",
              )}>
                {m.body}
              </div>
              {!joinsNext && <span className={cn("mt-1 px-2 text-[10px] text-faint", mine ? "self-end" : "self-start")}>{isPending ? "Sending…" : time(m.created_at)}</span>}
            </li>
          );
        })}
      </ol>
      {typing && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span className="glass-card inline-flex gap-1 rounded-full px-3 py-2.5" aria-hidden="true">{[0, 1, 2].map((k) => <span key={k} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${k * 120}ms` }} />)}</span>
          {otherName || "They"} is typing…
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

export function Composer({ cid, placeholder }: { cid: string; placeholder: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const send = () => {
    const text = body.trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent(SENT, { detail: { cid, body: text } }));
    setBody("");
    start(async () => {
      setError("");
      // A dropped connection throws rather than returning; either way the draft comes back.
      const fail = (message: string) => { setError(message); setBody(text); window.dispatchEvent(new CustomEvent(FAILED, { detail: { cid, body: text } })); };
      try {
        const r = await sendMessage(cid, text);
        if (!r.ok) fail(r.message);
      } catch {
        fail("Couldn't send. Check your connection and try again.");
      }
    });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-line p-3">
      {error && <p role="alert" className="mb-2 px-1 text-xs text-danger">{error}</p>}
      <div className="glass-card flex items-end gap-2 rounded-3xl p-1.5">
        <label htmlFor="msg" className="sr-only">Message</label>
        <textarea
          id="msg"
          value={body}
          onChange={(e) => { setBody(e.target.value); window.dispatchEvent(new CustomEvent(TYPING, { detail: { cid } })); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          rows={1}
          maxLength={2000}
          placeholder={placeholder}
          style={{ outline: "none" }}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-text placeholder:text-faint"
        />
        <button type="submit" disabled={!body.trim()} aria-label="Send" className="bg-accent-grad grid size-10 shrink-0 place-items-center rounded-full text-on-accent transition hover:-translate-y-px active:scale-90 disabled:opacity-40">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
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
