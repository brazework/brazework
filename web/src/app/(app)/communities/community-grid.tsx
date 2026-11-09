"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Celebrate } from "@/components/app/celebrate";
import { PRIVACY_LABEL, TYPE_LABEL, membersLabel, type Community, type Role } from "@/lib/communities";
import { cn } from "@/lib/forge";
import { mediaUrl } from "@/lib/media";
import { CommunityBadge, MetaLine, RoleChip } from "./_components/badge";
import { joinCommunity } from "./actions";

type Item = { c: Community; role?: Role };

// Communities as a live grid: search and field filters apply as you type, cards glide into
// place, and Discover cards can be joined right from the grid.
export function CommunityGrid({ items, discover = false, initialQuery = "", empty }: { items: Item[]; discover?: boolean; initialQuery?: string; empty: React.ReactNode }) {
  const [q, setQ] = useState(initialQuery);
  const [field, setField] = useState<string | null>(null);
  // The fields present, most common first, as quick filters.
  const fields = useMemo(() => {
    const n = new Map<string, number>();
    for (const { c } of items) if (c.field) n.set(c.field, (n.get(c.field) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f]) => f);
  }, [items]);
  const needle = q.trim().toLowerCase();
  const shown = items.filter(({ c }) => (!field || c.field === field) && (!needle || `${c.name} ${c.about} ${c.field} ${(c.topics ?? []).join(" ")}`.toLowerCase().includes(needle)));

  if (!items.length) return <>{empty}</>;
  return (
    <div>
      {(discover || items.length > 4) && (
        <div className="mb-5 flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" />
            <label htmlFor="cq" className="sr-only">Search communities</label>
            <input id="cq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, field or topic" className="h-12 w-full rounded-full border border-line bg-surface pr-11 pl-11 text-[15px] shadow-[var(--shadow)] outline-none transition placeholder:text-faint focus:border-line-strong" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>}
          </div>
          {fields.length > 1 && (
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
              {[null, ...fields].map((f) => (
                <button key={f ?? "all"} type="button" aria-pressed={field === f} onClick={() => setField(f)} className={cn("relative shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95", field === f ? "border-transparent text-on-accent" : "border-line bg-surface text-muted hover:text-text")}>
                  {field === f && <motion.span layoutId={`field-${discover ? "d" : "m"}`} className="bg-accent-grad absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{f ?? "All fields"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <motion.div layout className="grid gap-4 sm:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map(({ c, role }, i) => (
            <motion.div key={c.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03 }}>
              <Card c={c} role={role} joinable={discover} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {!shown.length && <p className="rounded-3xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">Nothing matches {needle ? <>&ldquo;{q}&rdquo;</> : "that filter"}. <button type="button" onClick={() => { setQ(""); setField(null); }} className="underline underline-offset-4 hover:text-text">Clear filters</button></p>}
    </div>
  );
}

function Card({ c, role, joinable }: { c: Community; role?: Role; joinable: boolean }) {
  return (
    <article className="grad-edge group relative flex h-full flex-col overflow-hidden rounded-3xl border shadow-[var(--shadow)] transition duration-300 hover:-translate-y-1">
      <div className="relative h-24 overflow-hidden border-b border-line">
        {c.cover_path ? <Image src={mediaUrl(c.cover_path)} alt="" fill sizes="(min-width: 640px) 440px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" /> : <div className="bg-accent-grad absolute inset-0 opacity-80 transition duration-500 group-hover:scale-110 group-hover:opacity-100" />}
      </div>
      <div className="flex flex-1 gap-4 p-5">
        <CommunityBadge id={c.id} name={c.name} className="relative z-10 -mt-11 border-4 border-surface shadow-[var(--shadow)] transition duration-300 group-hover:-rotate-6" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            {/* The title link stretches over the whole card; the Join button sits above it. */}
            <Link href={`/c/${c.id}`} className="truncate font-semibold after:absolute after:inset-0 after:content-[''] group-hover:underline">{c.name}</Link>
            {role && role !== "member" && <RoleChip role={role} />}
          </div>
          <MetaLine parts={[membersLabel(c.member_count), PRIVACY_LABEL[c.privacy], c.field, TYPE_LABEL[c.type]]} />
          <p className="mt-2 line-clamp-2 text-sm text-text-2">{c.about}</p>
          {(c.topics ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {c.topics.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">#{t}</span>)}
            </div>
          )}
          {joinable && <div className="relative z-10 mt-4"><QuickJoin c={c} /></div>}
        </div>
      </div>
    </article>
  );
}

function QuickJoin({ c }: { c: Community }) {
  const [state, setState] = useState<"none" | "joined" | "requested">("none");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (state !== "none")
    return (
      <span className="relative inline-flex h-9 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-4 text-sm font-medium text-ok">
        {state === "joined" && <Celebrate pieces={18} />}
        <Check className="size-4" /> {state === "joined" ? "Joined" : "Requested"}
      </span>
    );
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await joinCommunity(c.id);
          if (r.ok) setState(c.privacy === "public" ? "joined" : "requested");
          else setMsg(r.message);
        })}
        className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-on-accent shadow-[0_8px_20px_-10px_var(--accent)] transition hover:-translate-y-px active:scale-95 disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} {c.privacy === "public" ? "Join" : "Ask to join"}
      </button>
      {msg && <span role="alert" className="text-xs text-danger">{msg}</span>}
    </span>
  );
}
