"use client";
import { BadgeCheck, MapPin, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { ORG_LABEL, dateParts, isOver, pluralize, whereLabel, type HostedEvent } from "@/lib/events";
import { RsvpButton, SaveButton, useEventMarks } from "./event-controls";
import { LocalTime, useTimeZone } from "./local-time";

export function EventCard({ event: e, going, saved, now }: { event: HostedEvent; going: boolean; saved: boolean; now: number }) {
  const tz = useTimeZone();
  const { marks, rsvp, save, error } = useEventMarks(e.id, { going, saved, count: e.rsvp_count });
  const d = dateParts(e.starts_at, tz);
  const over = isOver(e, now);
  return (
    <article className="flex gap-4 rounded-3xl border border-line bg-surface/70 p-4 transition hover:border-line-strong sm:p-5">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-raised py-2 text-center">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">{d.mon}</span>
        <span className="text-2xl leading-none font-semibold">{d.day}</span>
        <span className="mt-0.5 text-[10px] text-faint">{d.dow}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-faint">
          <span className="font-mono tracking-wide uppercase">{e.type}</span> · <span>{e.topic}</span>
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
        {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        {!over && <RsvpButton going={marks.going} onClick={rsvp} />}
        <SaveButton saved={marks.saved} onClick={save} />
      </div>
    </article>
  );
}
