"use client";
import { CalendarDays, Check, Hash, Loader2, Search, Send, Users, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/forge";
import { shareItem, shareTargets, type ShareTarget } from "@/lib/share";

const GROUP_ICON = { "Club chat": Users, "Event chat": CalendarDays } as Record<string, typeof Users>;

// "Send" on a post: pick people you've talked with and group chats you're in, add a note, send.
// Each one gets a message with the post, which shows as a preview card in the chat.
export function SendPost({ postId, eventId, projectId, compact = true }: { postId?: string; eventId?: string; projectId?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<ShareTarget[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, startLoad] = useTransition();
  const [sending, startSend] = useTransition();
  const key = (t: ShareTarget) => `${t.kind}:${t.id}`;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    setMsg(null);
    if (next && !targets) startLoad(async () => setTargets(await shareTargets()));
  };
  const shown = (targets ?? []).filter((t) => `${t.title} ${t.subtitle}`.toLowerCase().includes(q.trim().toLowerCase()));
  const send = () => startSend(async () => {
    const chosen = (targets ?? []).filter((t) => picked.includes(key(t))).map((t) => ({ kind: t.kind, id: t.id }));
    const r = await shareItem(eventId ? "events" : projectId ? "projects" : "post", (eventId ?? projectId ?? postId)!, chosen, note);
    if (r.ok) { setMsg({ ok: true, text: r.message || `Sent to ${r.sent}` }); setPicked([]); setNote(""); setTimeout(() => setOpen(false), 1200); }
    else setMsg({ ok: false, text: r.message });
  });

  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} aria-label={eventId ? "Send event to people" : projectId ? "Send project to people" : "Send post to people"} className={compact ? "inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition hover:bg-hover hover:text-text" : "inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium transition hover:bg-hover"}>
        <Send className={compact ? "size-[18px]" : "size-4"} />{!compact && " Send to friends"}
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-30 mb-2 w-80 -translate-x-1/2 rounded-2xl border border-line bg-surface p-3 text-left shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold">Send to</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-faint hover:text-text"><X className="size-4" /></button>
          </div>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="People and group chats" autoFocus className="h-9 w-full rounded-xl border border-line bg-surface/70 pr-3 pl-8 text-sm outline-none focus:border-text" />
          </div>
          <ul className="mt-2 max-h-56 overflow-y-auto">
            {loading && <li className="flex items-center gap-2 px-2 py-3 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Loading your chats…</li>}
            {shown.map((t) => {
              const on = picked.includes(key(t));
              const Icon = t.kind === "group" ? GROUP_ICON[t.subtitle] ?? Hash : null;
              return (
                <li key={key(t)}>
                  <button type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== key(t)) : [...p, key(t)]))} className={cn("flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-hover", on && "bg-hover")}>
                    {Icon ? <span className="nav-tile grid size-8 shrink-0 place-items-center rounded-lg"><Icon className="size-4" /></span> : <Avatar first={t.first ?? ""} last={t.last ?? ""} size={32} className="text-[11px]" />}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{t.title}</span>{t.subtitle && <span className="block truncate text-[11px] text-faint">{t.subtitle}</span>}</span>
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", on ? "border-transparent bg-accent-grad text-on-accent" : "border-line-strong")}>{on && <Check className="size-3" />}</span>
                  </button>
                </li>
              );
            })}
            {targets && !shown.length && <li className="px-2 py-3 text-xs text-muted">{q ? "No one matches." : "Message someone or join a club first; your chats show up here."}</li>}
          </ul>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Add a note (optional)" className="mt-2 h-9 w-full rounded-xl border border-line bg-surface/70 px-3 text-sm outline-none focus:border-text" />
          {msg && <p role={msg.ok ? "status" : "alert"} className={cn("mt-2 px-1 text-xs", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}
          <button type="button" onClick={send} disabled={sending || !picked.length} className="bg-accent-grad mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-sm font-medium text-on-accent disabled:opacity-50">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send{picked.length > 1 ? ` to ${picked.length}` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
