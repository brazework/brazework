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
