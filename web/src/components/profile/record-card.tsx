"use client";

import { useState } from "react";
import { cn } from "@/lib/forge";
import type { RecordTimeline } from "@/lib/record-timeline";
import type { RecordYears } from "@/lib/record-years";
import { RecordTimelineChart } from "./record-timeline";
import { RecordYearsChart } from "./record-years";

// The record on a profile as one card (less clutter, Nov 21): the last twelve months or the whole
// record by year, with a small switch between them in the card's header. Either can be missing (a
// record with one recent year has no year chart; one with only old work has no twelve months), and
// then the card is simply that one chart, with no switch.
export function RecordCard({ timeline, years, own, goal, ember }: { timeline: RecordTimeline | null; years: RecordYears | null; own: boolean; goal?: string | null; ember: boolean }) {
  const [view, setView] = useState<"months" | "years">(timeline ? "months" : "years");
  const both = Boolean(timeline && years);
  const toggle = both ? (
    <span role="group" aria-label="Show the record" className="inline-flex rounded-lg border border-line p-0.5 text-xs">
      {([["months", "12 months"], ["years", "By year"]] as const).map(([v, label]) => (
        <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
          className={cn("min-h-7 rounded-md px-2.5 font-medium transition", view === v ? "bg-text text-surface" : "text-muted hover:text-text")}>
          {label}
        </button>
      ))}
    </span>
  ) : null;
  if (timeline && (view === "months" || !years)) return <RecordTimelineChart data={timeline} own={own} goal={goal} toggle={toggle} />;
  if (years) return <RecordYearsChart data={years} own={own} ember={ember} toggle={toggle} />;
  return null;
}
