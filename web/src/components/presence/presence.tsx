"use client";
import { useEffect, useSyncExternalStore } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/forge";

// Who's on Brazework right now, through Supabase Realtime Presence (no table, nothing stored): every
// open tab of a signed-in member joins one channel keyed by their user id, and leaves when the tab
// closes. "Appear offline" (kept per browser) stops this tab announcing you; you still see others.

const HIDE_KEY = "forge-appear-offline";
let online = new Set<string>();
let hidden = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

function readHidden() {
  try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; }
}

// Mounted once in the signed-in shell (app layout).
export function PresenceMount({ userId }: { userId: string }) {
  useEffect(() => {
    hidden = readHidden();
    emit();
    const sb = getBrowserClient();
    const ch = sb.channel("forge-online", { config: { presence: { key: userId } } });
    const announce = () => (hidden ? ch.untrack() : ch.track({ at: Date.now() }));
    ch.on("presence", { event: "sync" }, () => {
      online = new Set(Object.keys(ch.presenceState()));
      emit();
    });
    ch.subscribe((status: string) => { if (status === "SUBSCRIBED") void announce(); });
    // The "Appear offline" switch, from any component in this tab.
    const onToggle = () => void announce();
    window.addEventListener(HIDE_KEY, onToggle);
    return () => {
      window.removeEventListener(HIDE_KEY, onToggle);
      online = new Set();
      emit();
      sb.removeChannel(ch);
    };
  }, [userId]);
  return null;
}

export function useOnline(id: string | null | undefined) {
  return useSyncExternalStore(subscribe, () => !!id && online.has(id), () => false);
}

// How many of these people are on Brazework right now (club cards, club pages, group chats).
export function useOnlineCount(ids: string[]) {
  return useSyncExternalStore(subscribe, () => ids.reduce((n, id) => n + (online.has(id) ? 1 : 0), 0), () => 0);
}

export function useAppearOffline() {
  const value = useSyncExternalStore(subscribe, () => hidden, () => false);
  const set = (v: boolean) => {
    hidden = v;
    try { if (v) localStorage.setItem(HIDE_KEY, "1"); else localStorage.removeItem(HIDE_KEY); } catch {}
    emit();
    window.dispatchEvent(new Event(HIDE_KEY));
  };
  return [value, set] as const;
}

// The green dot on an avatar. Wrap the avatar: <WithPresence id={…}><Avatar …/></WithPresence>.
export function WithPresence({ id, children, className, dot = "size-3" }: { id: string | null | undefined; children: React.ReactNode; className?: string; dot?: string }) {
  const on = useOnline(id);
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {children}
      {on && <span role="img" aria-label="Online" title="Online now" className={cn("absolute right-[4%] bottom-[4%] rounded-full bg-emerald-500 ring-2 ring-surface", dot)} />}
    </span>
  );
}

// "Online now" next to a name (profile header).
export function OnlineLabel({ id }: { id: string }) {
  const on = useOnline(id);
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-0.5 align-middle text-xs font-medium text-emerald-500">
      <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" /><span className="relative size-2 rounded-full bg-emerald-500" /></span>
      Online now
    </span>
  );
}

// Your own status in the sidebar: tap to switch between Online and Appear offline.
export function MyStatus() {
  const [off, setOff] = useAppearOffline();
  return (
    <button type="button" onClick={() => setOff(!off)} aria-pressed={off} title={off ? "Others see you as offline. Tap to show you're online." : "Others can see you're on Brazework. Tap to appear offline."} className="inline-flex items-center gap-1.5 truncate text-xs text-faint transition hover:text-text">
      <span className={cn("size-2 shrink-0 rounded-full", off ? "border border-faint" : "bg-emerald-500")} />
      {off ? "Appearing offline" : "Online"}
    </button>
  );
}
