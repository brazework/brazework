"use client";
import { BadgeCheck, MapPin, Sparkles, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { ORG_LABEL, dateParts, isOver, pluralize, whenBadge, whereLabel, type HostedEvent } from "@/lib/events";
import { cn } from "@/lib/forge";
import { Avatar } from "@/components/ui";
import { SendPost } from "@/components/share/send-post";
import { RsvpButton, SaveButton, useEventMarks } from "./event-controls";
import { LocalTime, useTimeZone } from "./local-time";

// One event: date tile (filled once you're going), how soon it is, whether it fits your interests,
// where and who's hosting, with RSVP, save and send-to-friends.
export function EventCard({ event: e, going, saved, now, match = "", friends = [], mine = false }: { event: HostedEvent; going: boolean; saved: boolean; now: number; match?: string; friends?: { id: string; first: string; last: string }[]; mine?: boolean }) {
  const tz = useTimeZone();
  const { marks, rsvp, save, error } = useEventMarks(e.id, { going, saved, count: e.rsvp_count });
  const d = dateParts(e.starts_at, tz);
  const over = isOver(e, now);
  const badge = whenBadge(e, now);
  return (
    <article id={`ev-${e.id}`} className="glass-card grid scroll-mt-24 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-3xl p-4 transition duration-300 hover:-translate-y-0.5 sm:flex sm:p-5">
      <div className={cn("flex w-14 shrink-0 flex-col self-start items-center justify-center rounded-2xl py-2 text-center transition-colors", marks.going ? "bg-accent-grad text-on-accent" : "bg-raised")}>
        <span className={cn("font-mono text-[10px] tracking-widest uppercase", marks.going ? "opacity-80" : "text-muted")}>{d.mon}</span>
        <span className="text-2xl leading-none font-semibold">{d.day}</span>
        <span className={cn("mt-0.5 text-[10px]", marks.going ? "opacity-80" : "text-faint")}>{marks.going ? "Going" : d.dow}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-faint">
          <span className="font-mono tracking-wide uppercase">{e.type}</span> · <span>{e.topic}</span>
          {badge && <span className={cn("ml-1 inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-medium", badge.live ? "bg-emerald-500/12 text-emerald-500" : "bg-surface-2 text-text-2")}>{badge.live && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />}{badge.text}</span>}
          {mine && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-px text-[11px] text-text-2"><UsersRound className="size-3" /> Your club</span>}
          {match && !mine && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-px text-[11px] text-text-2"><Sparkles className="size-3" /> Matches {match}</span>}
        </div>
        <Link href={`/events/${e.id}`} className="mt-0.5 block truncate font-semibold hover:underline">{e.title}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <LocalTime kind="range" value={e} />
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {whereLabel(e)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-faint">
          {e.host && (e.community_id
            ? <Link href={`/c/${e.community_id}`} className="inline-flex items-center gap-1 hover:text-text hover:underline"><UsersRound className="size-3.5" /> {e.host} · Club event</Link>
            : <span className="inline-flex items-center gap-1"><BadgeCheck className="size-3.5" /> {e.host} · {ORG_LABEL[e.host_type as keyof typeof ORG_LABEL] ?? "Verified"}</span>)}
          <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {pluralize(marks.count, "going", "going")}</span>
        </div>
        {friends.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-text-2">
            <span className="flex -space-x-1.5">{friends.slice(0, 3).map((f) => <Avatar key={f.id} first={f.first} last={f.last} size={20} className="ring-2 ring-bg" />)}</span>
            <span className="truncate">{friends.length === 1 ? `${f1(friends)} is going` : `${f1(friends)} and ${pluralize(friends.length - 1, "connection")} going`}</span>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      </div>
      <div className="col-span-2 flex shrink-0 items-center justify-end gap-2 sm:items-center">
        {!over && <RsvpButton going={marks.going} onClick={rsvp} />}
        <SaveButton saved={marks.saved} onClick={save} />
        <SendPost eventId={e.id} />
      </div>
    </article>
  );
}

const f1 = (f: { first: string; last: string }[]) => `${f[0].first} ${f[0].last}`.trim();
