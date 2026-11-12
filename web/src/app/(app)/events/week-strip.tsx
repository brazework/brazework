"use client";
import { cn } from "@/lib/forge";
import { DAY_MS, dayKey, type ForgeEvent } from "@/lib/events";
import { useTimeZone } from "./local-time";

type Item = Pick<ForgeEvent, "id" | "starts_at"> & { going: boolean };

// The next seven days at a glance, in the viewer's time zone: a dot per event (filled when you're
// going). Tapping a day with events scrolls to its first one.
export function WeekStrip({ events, now }: { events: Item[]; now: number }) {
  const tz = useTimeZone();
  const days = Array.from({ length: 7 }, (_, i) => now + i * DAY_MS).map((t) => {
    const key = dayKey(t, tz);
    const items = events.filter((e) => dayKey(e.starts_at, tz) === key);
    const d = new Date(t);
    return {
      key,
      items,
      dow: d.toLocaleString("en-US", { weekday: "short", timeZone: tz }),
      day: d.toLocaleString("en-US", { day: "numeric", timeZone: tz }),
    };
  });
  const jump = (id: string) => document.getElementById(`ev-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <nav aria-label="This week" className="mt-6 grid grid-cols-7 gap-1.5">
      {days.map((d, i) => {
        const first = d.items[0];
        const label = `${d.dow} ${d.day}: ${d.items.length ? `${d.items.length} event${d.items.length === 1 ? "" : "s"}` : "nothing yet"}`;
        return (
          <button
            key={d.key}
            type="button"
            disabled={!first}
            onClick={() => first && jump(first.id)}
            aria-label={label}
            title={label}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border py-2.5 transition",
              i === 0 ? "border-line-strong bg-raised" : "border-line",
              first ? "hover:border-line-strong hover:bg-hover" : "opacity-60",
            )}
          >
            <span className="text-[10px] font-medium tracking-wide text-faint uppercase">{i === 0 ? "Today" : d.dow}</span>
            <span className="text-lg leading-none font-semibold">{d.day}</span>
            <span className="flex h-1.5 items-center gap-0.5">
              {d.items.slice(0, 3).map((e) => <span key={e.id} className={cn("size-1.5 rounded-full", e.going ? "bg-accent" : "border border-line-strong")} />)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
