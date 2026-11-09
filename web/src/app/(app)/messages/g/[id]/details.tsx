"use client";
import { Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { WithPresence, useOnlineCount } from "@/components/presence/presence";
import { catchMeUp } from "@/lib/chat-ember";

// "Catch me up": Ember reads the recent chat and tells only you what you missed.
export function CatchMeUp({ chatId }: { chatId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => { setError(""); const r = await catchMeUp(chatId); if (r.ok) setText(r.text ?? ""); else setError(r.message); })} className="bg-accent-grad inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-sm font-medium text-on-accent disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {text ? "Catch me up again" : "Catch me up"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      {text && <p className="mt-3 rounded-2xl bg-surface-2/70 p-3 text-sm leading-relaxed whitespace-pre-wrap text-text-2">{text}</p>}
      <p className="mt-2 text-[11px] text-faint">Only you see this. Type <b className="font-medium text-text-2">@Ember</b> in the chat to ask in front of everyone.</p>
    </div>
  );
}

export function MemberList({ people }: { people: { uid: string; first: string; last: string }[] }) {
  const online = useOnlineCount(people.map((p) => p.uid));
  return (
    <div>
      <div className="flex items-baseline justify-between"><h3 className="text-xs font-medium tracking-wide text-faint uppercase">People</h3><span className="text-[11px] text-emerald-500">{online ? `${online} online` : ""}</span></div>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {people.slice(0, 100).map((p) => (
          <li key={p.uid}>
            <a href={`/u/${p.uid}`} className="flex items-center gap-2 rounded-xl px-1.5 py-1 text-sm transition hover:bg-hover/70">
              <WithPresence id={p.uid} dot="size-2"><Avatar first={p.first} last={p.last} size={26} className="text-[9px]" /></WithPresence>
              <span className="truncate">{p.first} {p.last}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
