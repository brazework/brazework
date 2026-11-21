"use client";

import { ArrowRight, Flag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Seal } from "@/components/app/verified-seal";
import { cn } from "@/lib/forge";
import type { RecordTimeline, TimelineMark } from "@/lib/record-timeline";

// The record over time, at the top of a profile: one lane per project, each signed result a seal on
// the day it happened, results still waiting as dashed rings (the owner only), updates as small
// ticks. The server lays it out (lib/record-timeline.ts); this draws it and answers the pointer.
//
// The detail line under the chart shows one result at a time: the latest one to start, then whichever
// mark is hovered, focused or tapped. It sits below the lanes rather than in a floating tooltip, so it
// reads the same with a finger. On phones each project's name sits above its lane (no sideways scroll).
// Every mark is a 24×24 tap target (e2e/m-layout.cjs); an update's dot stays small inside its own.

export function RecordTimelineChart({ data, own, goal }: { data: RecordTimeline; own: boolean; goal?: string | null }) {
  const lanes = data.lanes;
  const latest = lanes.flatMap((l) => l.marks.map((m) => ({ m, lane: l }))).filter((x) => x.m.kind !== "post").sort((a, b) => b.m.at - a.m.at)[0];
  const [active, setActive] = useState<string>(latest ? `${latest.lane.id}:${latest.m.id}` : "");

  const found = lanes.flatMap((l) => l.marks.map((m) => ({ m, lane: l }))).find((x) => `${x.lane.id}:${x.m.id}` === active) ?? latest;
  const summary = [
    data.signed ? `${data.signed} signed` : null,
    data.backed ? `${data.backed} backed` : null,
    own && data.waiting ? `${data.waiting} waiting` : null,
    `across ${lanes.length} project${lanes.length === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="record-tl-h" className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="record-tl-h" className="text-[15px] font-semibold tracking-tight">Record over time</h2>
        <p className="text-sm text-muted">{summary}{data.since ? ` since ${data.since}` : ""}</p>
      </div>
      {goal && <p className="mt-1 flex items-center gap-1.5 text-xs text-text-2"><Flag className="size-3.5 text-muted" /> Heading toward {goal}</p>}

      <div className="mt-4">
        <div className="relative">
          {/* Today: a hairline down through every lane, so "now" reads at a glance. */}
          <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 bottom-6 left-0 sm:left-[9.5rem]">
            <span className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${data.today * 100}%` }} />
          </div>
          <ol aria-label="Projects over time" className="relative flex flex-col">
            {lanes.map((lane, li) => (
              <li key={lane.id} className="grid grid-cols-1 items-center sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                <Link href={lane.href} className="truncate pt-2 text-[13px] text-text-2 sm:pt-0 sm:pr-3 transition hover:text-text hover:underline" title={lane.title}>{lane.title}</Link>
                <div className="relative h-12">
                  <span aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
                  <span
                    aria-hidden="true"
                    className={cn("absolute top-1/2 h-[3px] -translate-y-1/2 origin-left rounded-full motion-safe:animate-[tl-draw_.7s_cubic-bezier(.2,.7,.2,1)_both]", lane.ongoing ? "bg-gradient-to-r from-text/25 to-text/80" : "bg-text/45")}
                    style={{ left: `${lane.from * 100}%`, width: `${Math.max(0.4, (lane.to - lane.from) * 100)}%`, animationDelay: `${li * 90}ms` }}
                  />
                  {lane.ongoing && <span aria-hidden="true" className="absolute top-1/2 size-2 -translate-1/2 rounded-full bg-text motion-safe:animate-pulse" style={{ left: `${lane.to * 100}%` }} />}
                  {lane.marks.map((m) => {
                    const key = `${lane.id}:${m.id}`;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onMouseEnter={() => setActive(key)}
                        onFocus={() => setActive(key)}
                        onClick={() => setActive(key)}
                        aria-label={`${label(m)}: ${m.title}, ${m.when}`}
                        aria-pressed={key === active}
                        className={cn("absolute top-1/2 grid -translate-1/2 place-items-center rounded-full outline-offset-2 transition-transform hover:scale-125 focus-visible:scale-125", m.kind === "post" ? "z-0 size-6" : "z-10 size-6", key === active && m.kind !== "post" && "scale-125")}
                        style={{ left: `${m.x * 100}%` }}
                      >
                        <Mark kind={m.kind} />
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
          <div aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
            <span className="hidden sm:block" />
            <div className="relative h-6 text-[11px] text-faint">
              {/* Labels too close to an edge would be cut in half: they're left out. */}
              {data.ticks.filter((t) => t.x > 0.07 && t.x < 0.93).map((t) => <span key={t.label} className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: `${t.x * 100}%` }}>{t.label}</span>)}
            </div>
          </div>
        </div>
      </div>

      {found && (
        <div aria-live="polite" className="mt-3 flex items-center gap-x-3 rounded-xl bg-surface-2/70 px-3.5 py-2.5 text-sm">
          <span className="grid size-5 shrink-0 place-items-center"><Mark kind={found.m.kind} /></span>
          <span className="min-w-0 flex-1">
            <span className="font-medium text-text">{found.m.title}</span>
            <span className="block text-xs text-muted">{found.m.kind === "signed" ? `Signed by ${found.m.by ?? "a reviewer"} · ${found.m.signed ?? found.m.when}` : `${found.m.kind === "backed" ? "Backed by GitHub" : found.m.kind === "waiting" ? "Waiting to be signed" : "Update"} · ${found.m.when}`}</span>
          </span>
          <Link href={found.lane.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-text underline-offset-4 hover:underline">Open project <ArrowRight className="size-3.5" /></Link>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1.5"><Mark kind="signed" small /> Signed</span>
        {data.backed > 0 && <span className="inline-flex items-center gap-1.5"><Mark kind="backed" small /> Backed by GitHub</span>}
        {own && <span className="inline-flex items-center gap-1.5"><Mark kind="waiting" small /> Waiting</span>}
        <span className="inline-flex items-center gap-1.5"><Mark kind="post" /> Update</span>
        {data.more > 0 && <a href="#projects" className="ml-auto hover:text-text hover:underline">{data.more} more project{data.more === 1 ? "" : "s"} below</a>}
      </div>
    </section>
  );
}

const label = (m: TimelineMark) => (m.kind === "signed" ? "Signed" : m.kind === "backed" ? "Backed by GitHub" : m.kind === "waiting" ? "Waiting" : "Update");

// Shared with the year chart (record-years.tsx), so a kind of proof looks the same on both.
export function Mark({ kind, small }: { kind: TimelineMark["kind"]; small?: boolean }) {
  if (kind === "signed") return <Seal size={small ? 12 : 20} />;
  // One colour per kind of proof, everywhere (docs/design/app.md): green signed, blue backed, amber waiting.
  if (kind === "backed") return <span className={cn("block rotate-45 rounded-[3px] bg-info", small ? "size-2" : "size-3")} />;
  if (kind === "waiting") return <span className={cn("block rounded-full border-2 border-dashed border-wait bg-surface", small ? "size-2.5" : "size-3.5")} />;
  return <span className="block size-1.5 rounded-full bg-text-2" />;
}
