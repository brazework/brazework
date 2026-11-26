"use client";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, Flame, GraduationCap, Loader2, Search, Settings2, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Celebrate } from "@/components/app/celebrate";
import { PRIVACY_LABEL, TYPE_LABEL, membersLabel, type Community, type Role } from "@/lib/communities";
import { cn } from "@/lib/forge";
import { mediaUrl } from "@/lib/media";
import { CommunityBadge, MetaLine, RoleChip } from "./_components/badge";
import { joinCommunity } from "./actions";
import { accentTint } from "@/lib/club-look";
import { MemberFaces, type Face } from "@/components/network/member-faces";

// A club's pulse: a few faces, member ids for the live online count, and posts this week.
// For your own clubs: what's next on the calendar, and (officers) how many results wait for a signature.
// `school`: the university that verified it as one of its clubs (school-links.sql), for the badge.
export type Pulse = { faces: Face[]; ids: string[]; week: number; next?: { id: string; title: string; when: string } | null; verify?: number; school?: string };
type Item = { c: Community; role?: Role; pulse?: Pulse };

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
            <input id="cq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, field or topic" className="border border-line bg-surface h-12 w-full rounded-lg pr-11 pl-11 text-[15px] outline-none transition placeholder:text-faint" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>}
          </div>
          {fields.length > 1 && (
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
              {[null, ...fields].map((f) => (
                <button key={f ?? "all"} type="button" aria-pressed={field === f} onClick={() => setField(f)} className={cn("relative shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95", field === f ? "border-transparent text-on-accent" : "border-line bg-surface text-muted hover:text-text")}>
                  {field === f && <motion.span layoutId={`field-${discover ? "d" : "m"}`} className="bg-text absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="relative">{f ?? "All fields"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <motion.div layout className={cn("grid grid-cols-1 gap-4", discover ? "sm:grid-cols-2 2xl:grid-cols-3" : "sm:gap-5")}>
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map(({ c, role, pulse }, i) => (
            <motion.div key={c.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03 }}>
              {role ? <ClubRow c={c} role={role} pulse={pulse} /> : <CommunityCard c={c} joinable={discover} pulse={pulse} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {!shown.length && <p className="rounded-3xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">Nothing matches {needle ? <>&ldquo;{q}&rdquo;</> : "that filter"}. <button type="button" onClick={() => { setQ(""); setField(null); }} className="underline underline-offset-4 hover:text-text">Clear filters</button></p>}
    </div>
  );
}

// One of your clubs (redesign 2026-11): a wide row you can scan. Who it is, then a strip of what's
// happening there (this week, what's next, what waits on you), then the one or two things you do.
export function ClubRow({ c, role, pulse }: { c: Community; role: Role; pulse?: Pulse }) {
  const verify = pulse?.verify ?? 0;
  const cell = "min-w-0 px-4 py-3 first:pl-0 sm:px-5";
  return (
    <article className="group relative rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-line-strong sm:p-6">
      <div className="flex items-start gap-4">
        <CommunityBadge id={c.id} name={c.name} logo={c.logo_path} accent={c.accent} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* The name's link covers the whole row; the buttons below sit above it. */}
            <Link href={`/c/${c.id}`} className="truncate text-[17px] font-semibold tracking-tight after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:underline">{c.name}</Link>
            {role !== "member" && <RoleChip role={role} />}
          </div>
          <MetaLine parts={[membersLabel(c.member_count), c.field, TYPE_LABEL[c.type]]} />
          {pulse?.school && <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-2 py-0.5 text-[11px] font-medium text-ok"><GraduationCap className="size-3 shrink-0" /> <span className="truncate">Verified club of {pulse.school}</span></p>}
        </div>
        {pulse && <MemberFaces faces={pulse.faces} ids={pulse.ids} total={c.member_count} size={28} className="hidden shrink-0 sm:flex" />}
      </div>
      {(c.tagline || c.about) && <p className="mt-3 line-clamp-2 text-sm text-text-2 sm:line-clamp-1">{c.tagline || c.about}</p>}

      {/* What's happening there, as a drawing's title block: a few labelled cells. */}
      <dl className="mt-5 grid grid-cols-2 divide-x divide-line border-t border-line sm:grid-cols-3">
        <div className={cell}><dt className="text-[11px] text-faint">This week</dt><dd className="mt-0.5 text-sm font-medium tabular-nums">{pulse?.week ? `${pulse.week} ${pulse.week === 1 ? "post" : "posts"}` : "Quiet so far"}</dd></div>
        <div className={cn(cell, "max-sm:pr-0")}><dt className="text-[11px] text-faint">Next up</dt><dd className="mt-0.5 truncate text-sm font-medium">{pulse?.next ? <Link href={`/events/${pulse.next.id}`} className="relative z-10 hover:underline">{pulse.next.title} <span className="font-normal text-faint">· {pulse.next.when}</span></Link> : <span className="font-normal text-muted">Nothing scheduled</span>}</dd></div>
        <div className={cn(cell, "hidden sm:block")}><dt className="text-[11px] text-faint">{role !== "member" ? "To verify" : "Your role"}</dt><dd className="mt-0.5 text-sm font-medium tabular-nums">{role !== "member" ? (verify ? `${verify} waiting` : "All caught up") : "Member"}</dd></div>
      </dl>

      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
        {verify > 0 && <Link href={`/c/${c.id}/manage?tab=verify`} className="bg-text inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-surface"><ShieldCheck className="size-4" /> {verify} to verify</Link>}
        <Link href={`/c/${c.id}?tab=events`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-sm font-medium transition hover:bg-hover"><CalendarDays className="size-4" /> Events</Link>
        {role !== "member" && <Link href={`/c/${c.id}/manage`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-sm font-medium transition hover:bg-hover"><Settings2 className="size-4" /> Manage</Link>}
      </div>
    </article>
  );
}

// A club you could join: its cover, who it is in two lines, and Join right on the card.
export function CommunityCard({ c, role, joinable, pulse }: { c: Community; role?: Role; joinable: boolean; pulse?: Pulse }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="relative h-16 overflow-hidden border-b border-line">
        {c.cover_path ? <Image src={mediaUrl(c.cover_path)} alt="" fill sizes="(min-width: 640px) 440px, 100vw" className="object-cover" /> : <div className="cover-empty absolute inset-0" style={{ backgroundImage: accentTint(c.accent) }} />}
        {pulse && pulse.week > 0 && <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-[11px] font-medium text-text backdrop-blur"><Flame className="size-3" /> {pulse.week} this week</span>}
      </div>
      <div className="flex flex-1 flex-col p-5 pt-0">
        <CommunityBadge id={c.id} name={c.name} logo={c.logo_path} accent={c.accent} size={44} className="relative z-10 -mt-6 border-4 border-surface" />
        <div className="mt-2 flex items-center gap-2">
          <Link href={`/c/${c.id}`} className="truncate font-semibold after:absolute after:inset-0 after:content-[''] group-hover:underline">{c.name}</Link>
          {role && role !== "member" && <RoleChip role={role} />}
        </div>
        <MetaLine parts={[membersLabel(c.member_count), PRIVACY_LABEL[c.privacy], c.field]} />
        {pulse?.school && <p className="mt-1.5 inline-flex max-w-full items-center gap-1 self-start rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] px-2 py-0.5 text-[11px] font-medium text-ok"><GraduationCap className="size-3 shrink-0" /> <span className="truncate">Verified club of {pulse.school}</span></p>}
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-text-2">{c.tagline || c.about}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          {pulse ? <MemberFaces faces={pulse.faces} ids={pulse.ids} total={c.member_count} size={26} /> : <span />}
          {joinable && <div className="relative z-10"><QuickJoin c={c} /></div>}
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
      <span className="relative inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-4 text-sm font-medium text-ok">
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
        className="bg-text inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-surface transition active:scale-95 disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} {c.privacy === "public" ? "Join" : "Ask to join"}
      </button>
      {msg && <span role="alert" className="text-xs text-danger">{msg}</span>}
    </span>
  );
}
