"use client";
import { useSyncExternalStore } from "react";
import { clock, fullDate, timeRange, type ForgeEvent } from "@/lib/events";

const noop = () => () => {};

// The viewer's time zone. The server doesn't know it, so the server render and the hydration
// render both format in UTC (identical HTML, no mismatch), then React re-renders in local time.
// Client-side navigations skip straight to local time.
export function useTimeZone(): string | undefined {
  return useSyncExternalStore(noop, () => undefined, () => "UTC");
}

export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

type Props =
  | { kind: "full" | "clock" | "full-clock"; value: string | number; className?: string }
  | { kind: "range"; value: Pick<ForgeEvent, "starts_at" | "ends_at">; className?: string };

// A date or time in the viewer's own time zone, for server-rendered pages.
export function LocalTime(props: Props) {
  const tz = useTimeZone();
  let text: string;
  let iso: string | undefined;
  if (props.kind === "range") {
    text = timeRange(props.value, tz);
    iso = props.value.starts_at;
  } else {
    const v = props.value;
    text = props.kind === "full" ? fullDate(v, tz) : props.kind === "clock" ? clock(v, tz) : `${fullDate(v, tz)}, ${clock(v, tz)}`;
    iso = new Date(v).toISOString();
  }
  return <time dateTime={iso} className={props.className}>{text}</time>;
}

// A calendar-style tile (month over day) in the viewer's time zone.
export function DateTile({ value, className }: { value: string; className?: string }) {
  const tz = useTimeZone();
  const d = new Date(value);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: tz }).toUpperCase();
  const day = d.toLocaleString("en-US", { day: "numeric", timeZone: tz });
  const dow = d.toLocaleString("en-US", { weekday: "short", timeZone: tz });
  return (
    <div className={className} aria-hidden="true">
      <span className="block bg-accent-grad py-1 text-[10px] font-semibold tracking-[0.14em] text-on-accent">{month}</span>
      <span className="block pt-1 text-3xl leading-none font-semibold tracking-tight">{day}</span>
      <span className="block pb-1.5 text-[11px] text-muted">{dow}</span>
    </div>
  );
}
