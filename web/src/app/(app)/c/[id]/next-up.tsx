"use client";
import Link from "next/link";
import { dateParts, isOver, pluralize, type HostedEvent } from "@/lib/events";
import { cn } from "@/lib/forge";
import { RsvpButton, useEventMarks } from "../../events/event-controls";
import { LocalTime, useTimeZone } from "../../events/local-time";

// The club's next event, for its members, right under the header: when, where, who's going, and
// RSVP in one tap (optimistic, like every RSVP: events/event-controls.tsx).
export function NextUp({ event: e, going, now }: { event: HostedEvent; going: boolean; now: number }) {
  const tz = useTimeZone();
  const { marks, rsvp, error } = useEventMarks(e.id, { going, saved: false, count: e.rsvp_count });
  const d = dateParts(e.starts_at, tz);
  return (
    <section aria-label="Next up" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-3.5">
      <div className={cn("flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5 text-center transition-colors", marks.going ? "bg-text text-bg" : "bg-surface-2")}>
        <span className={cn("text-[10px] font-medium", marks.going ? "opacity-80" : "text-muted")}>{d.mon}</span>
        <span className="text-lg leading-none font-semibold">{d.day}</span>
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-xs text-muted">Next up</p>
        <Link href={`/events/${e.id}`} className="block truncate text-[15px] font-semibold hover:underline">{e.title}</Link>
        <p className="truncate text-xs text-muted"><LocalTime kind="range" value={e} /> <span aria-hidden="true">·</span> {pluralize(marks.count, "going", "going")}</p>
        {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      {!isOver(e, now) && <RsvpButton going={marks.going} onClick={rsvp} className="h-9" />}
    </section>
  );
}
