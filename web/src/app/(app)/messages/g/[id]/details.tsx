"use client";
import { emberCreditCost } from "@/lib/ember-credits";
import { Ellipsis, Loader2, LogOut, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { WithPresence, useOnlineCount } from "@/components/presence/presence";
import { useRouter } from "next/navigation";
import { deleteGroupChat, leaveGroupChat } from "@/lib/chats";
import { catchMeUp } from "@/lib/chat-ember";

// "Catch me up": Ember reads the recent chat and tells only you what you missed.
export function CatchMeUp({ chatId }: { chatId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => start(async () => { setError(""); const r = await catchMeUp(chatId); if (r.ok) setText(r.text ?? ""); else setError(r.message); })} className="bg-accent-grad inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-sm font-medium text-on-accent disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {text ? "Catch me up again" : "Catch me up"} · {emberCreditCost("chat_summary")}
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

export function GroupChatActions({ chatId, kind, canDelete }: { chatId: string; kind: "club" | "event" | "team"; canDelete: boolean }) {
  const router = useRouter();
  const menu = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) {
        menu.current.open = false;
      }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  function change(action: "leave" | "delete") {
    const leaveMessage = kind === "team"
      ? "Leave this team chat? You’ll lose access to its messages."
      : kind === "club"
        ? "Leave this chat? You can rejoin from the club page. Your club membership stays active."
        : "Leave this chat? You can rejoin from the event page. Your RSVP stays active.";
    const ownership = canDelete ? " If other members remain, ownership passes to one of them." : "";
    if (!confirm(action === "delete" ? "Delete this team chat and all of its messages for everyone? This can’t be undone." : leaveMessage + ownership)) return;
    setError("");
    start(async () => {
      try {
        const result = await (action === "delete" ? deleteGroupChat(chatId) : leaveGroupChat(chatId));
        if (result.ok) router.replace("/messages?tab=groups");
        else setError(result.message);
      } catch {
        setError(action === "delete" ? "Couldn’t delete this chat. Try again." : "Couldn’t leave this chat. Try again.");
      }
    });
  }

  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-hover disabled:opacity-50";
  return (
    <details ref={menu} className="relative shrink-0" onKeyDown={(event) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label="Chat options" title="Chat options" className="grid size-9 cursor-pointer list-none place-items-center rounded-full text-muted hover:bg-hover hover:text-text [&::-webkit-details-marker]:hidden">
        <Ellipsis className="size-5" />
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
        <button type="button" disabled={pending} onClick={() => change("leave")} className={item}><LogOut className="size-4" /> Leave chat</button>
        {canDelete && <button type="button" disabled={pending} onClick={() => change("delete")} className={`${item} text-danger`}><Trash2 className="size-4" /> Delete group chat</button>}
        {error && <p role="alert" className="px-2.5 py-1 text-xs text-danger">{error}</p>}
      </div>
    </details>
  );
}
