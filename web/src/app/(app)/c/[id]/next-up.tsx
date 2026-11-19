"use client";
import Link from "next/link";
import { dateParts, isOver, pluralize, type HostedEvent } from "@/lib/events";
import { cn } from "@/lib/forge";
import { NextStrip } from "@/components/app/next-strip";
import { RsvpButton, useEventMarks } from "../../events/event-controls";
import { LocalTime, useTimeZone } from "../../events/local-time";

// The club's next event, for its members, right under the header: when, where, who's going, and
// RSVP in one tap (optimistic, like every RSVP: events/event-controls.tsx).
export function NextUp({ event: e, going, now }: { event: HostedEvent; going: boolean; now: number }) {
  const tz = useTimeZone();
  const { marks, rsvp, error } = useEventMarks(e.id, { going, saved: false, count: e.rsvp_count });
  const d = dateParts(e.starts_at, tz);
  return (
    <NextStrip label="Next up" className="mt-4" icon={<span className={cn("text-center text-[10px] leading-none font-semibold", marks.going && "text-ok")}>{d.mon}<br /><span className="text-sm">{d.day}</span></span>}
      action={!isOver(e, now) ? <RsvpButton going={marks.going} onClick={rsvp} className="h-8 px-3 text-xs" /> : undefined}>
      <Link href={`/events/${e.id}`} className="font-medium text-text hover:underline">{e.title}</Link>{" "}
      <span className="text-sm text-muted"><LocalTime kind="range" value={e} />, {pluralize(marks.count, "going", "going")}</span>
      {error && <span role="alert" className="block text-xs text-danger">{error}</span>}
    </NextStrip>
  );
}
