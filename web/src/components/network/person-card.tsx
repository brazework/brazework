"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/forge";
import { toggleFollow } from "@/lib/network";
import { WithPresence } from "@/components/presence/presence";

export type PersonCardData = { id: string; first_name: string; last_name: string; headline: string; field: string; avatar?: string | null; shared?: string };

// A swipeable person card with one-tap Follow (and Unfollow).
export function PersonCard({ p }: { p: PersonCardData }) {
  const [following, setFollowing] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <article className="grad-edge group relative flex w-[200px] flex-col items-center rounded-3xl border p-5 text-center shadow-[var(--shadow)] transition duration-300 hover:-translate-y-1">
      <span className="rounded-full bg-accent-grad p-[3px] transition duration-300 group-hover:scale-105"><WithPresence id={p.id} dot="size-3.5"><Avatar first={p.first_name} last={p.last_name} size={64} src={p.avatar} className="border-2 border-surface text-lg" /></WithPresence></span>
      <Link href={`/u/${p.id}`} className="mt-3 line-clamp-1 font-semibold after:absolute after:inset-0 after:content-[''] hover:underline">{p.first_name} {p.last_name}</Link>
      <p className="mt-0.5 line-clamp-2 min-h-[2.5em] text-xs text-muted">{p.headline || p.field || "Brazework member"}</p>
      {p.shared && <span className="mt-2 line-clamp-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] text-text-2">{p.shared}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const next = !following;
          setFollowing(next);
          const r = await toggleFollow(p.id, next);
          if (!r.ok) { setFollowing(!next); setMsg(r.message); }
        })}
        className={cn("relative z-10 mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-sm font-medium transition active:scale-95", following ? "border border-line text-text-2" : "bg-accent-grad text-on-accent shadow-[0_8px_20px_-10px_var(--accent)]")}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={following ? "y" : "n"} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : following ? <Check className="size-4" /> : <UserPlus className="size-4" />}
            {following ? "Following" : "Follow"}
          </motion.span>
        </AnimatePresence>
      </button>
      {msg && <p role="alert" className="mt-2 text-[11px] text-danger">{msg}</p>}
    </article>
  );
}

// A compact row for lists in the feed: photo, name, why they're suggested, one-tap Follow.
export function PersonRow({ p }: { p: PersonCardData }) {
  const [following, setFollowing] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="relative flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-hover">
      <WithPresence id={p.id} dot="size-3"><Avatar first={p.first_name} last={p.last_name} size={40} src={p.avatar} /></WithPresence>
      <span className="min-w-0 flex-1">
        <Link href={`/u/${p.id}`} className="block truncate text-sm font-medium after:absolute after:inset-0 after:content-[''] hover:underline">{p.first_name} {p.last_name}</Link>
        <span className="block truncate text-xs text-muted">{p.headline || p.field || "Brazework member"}{p.shared && <span className="text-faint"> · {p.shared}</span>}</span>
      </span>
      <button
        type="button"
        disabled={pending}
        aria-pressed={following}
        onClick={() => start(async () => {
          const next = !following;
          setFollowing(next);
          const r = await toggleFollow(p.id, next);
          if (!r.ok) setFollowing(!next);
        })}
        className={cn("relative z-10 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-medium transition active:scale-95", following ? "border border-line text-text-2" : "bg-text text-bg")}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : following ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
        {following ? "Following" : "Follow"}
      </button>
    </li>
  );
}
