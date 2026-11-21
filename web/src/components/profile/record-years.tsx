"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/forge";
import type { RecordYear, RecordYears } from "@/lib/record-years";
import { Mark } from "./record-timeline";

// The record by year, under the 12-month chart on a profile: one node per year with proven work,
// joined in order, and under them the chosen year's story (a sentence, then its results). The server
// lays it out (lib/record-years.ts); this draws it and answers the pointer. Linear FIX-217.
//
// A node says two things without a legend of its own: its size is how much was proven that year, and
// its ring is how (green for signed by a person, blue for backed by GitHub, in the same proportion;
// dashed amber, on your own chart, for a year where everything is still waiting). A dashed line into a
// node means the year before it has nothing drawn.
//
// The story sits below the nodes, not in a floating tooltip, so it reads the same with a finger. The
// latest year is open to start. A year is chosen by tap, click or keyboard focus, never by hover: the
// story's height changes with the year, and a page that moves under a passing mouse is hard to read.

const TELL = "Tell the story of my record so far, year by year.";

export function RecordYearsChart({ data, own, ember, toggle }: { data: RecordYears; own: boolean; ember: boolean; toggle?: React.ReactNode }) {
  const years = data.years;
  const [picked, setPicked] = useState(years[years.length - 1].year);
  const y = years.find((x) => x.year === picked) ?? years[years.length - 1];
  // Up to five years have room for bigger nodes, even on a phone; more than that and they shrink to fit.
  const roomy = years.length <= 5;
  const summary = [
    `${data.proven} proven`,
    data.people ? `signed by ${data.people} ${data.people === 1 ? "person" : "people"}` : null,
    data.from === data.to ? `${data.from}` : `${data.from} to ${data.to}`,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="record-years-h" className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-3"><h2 id="record-years-h" className="text-[15px] font-semibold tracking-tight">Record by year</h2>{toggle}</span>
        <p className="text-sm text-muted">{summary}</p>
      </div>

      {/* A short record stays compact on the left instead of stretching two nodes across the card. */}
      <ol aria-label="Years on this record" className="mt-4 -mx-2 grid" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))`, maxWidth: `${years.length * (roomy ? 8.5 : 7)}rem` }}>
        {years.map((x, i) => {
          const proven = x.signed + x.backed;
          const on = x.year === y.year;
          return (
            <li key={x.year} className="relative">
              {i > 0 && <span aria-hidden="true" className={cn("absolute right-1/2 w-full border-t border-line-strong", roomy ? "top-7" : "top-6", x.gap && "border-dashed")} />}
              <button
                type="button"
                onClick={() => setPicked(x.year)}
                onFocus={() => setPicked(x.year)}
                aria-pressed={on}
                aria-label={`${x.year}: ${proven ? `${proven} proven` : `${x.waiting} waiting to be signed`}`}
                className="group relative flex w-full flex-col items-center rounded-lg outline-offset-2"
              >
                <span className={cn("grid place-items-center", roomy ? "h-14" : "h-12")}>
                  <span className="relative grid place-items-center">
                    <Node year={x} roomy={roomy} />
                    {proven > 0 && <span className={cn("absolute font-semibold tabular-nums text-text", roomy ? "text-sm" : "text-xs")}>{proven}</span>}
                    {/* The chosen year: an ink ring just outside the node. */}
                    <span aria-hidden="true" className={cn("absolute -inset-[3px] rounded-full border-[1.5px] border-text", on ? "opacity-100" : "opacity-0 group-hover:opacity-40")} />
                  </span>
                </span>
                <span className={cn("pb-1 text-xs tabular-nums", on ? "font-semibold text-text" : "text-muted")}>{x.year}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div aria-live="polite" className="mt-3 rounded-xl bg-surface-2/70 px-4 py-3.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-lg font-semibold tracking-tight tabular-nums">{y.year}</h3>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {y.signed > 0 && <span className="inline-flex items-center gap-1.5"><Mark kind="signed" small /> {y.signed} signed</span>}
            {y.backed > 0 && <span className="inline-flex items-center gap-1.5"><Mark kind="backed" small /> {y.backed} backed by GitHub</span>}
            {own && y.waiting > 0 && <span className="inline-flex items-center gap-1.5"><Mark kind="waiting" small /> {y.waiting} waiting</span>}
          </p>
        </div>
        <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-pretty text-text-2">{y.line}</p>
        {y.results.length > 0 && (
          <ul className="mt-2.5 flex flex-col divide-y divide-line border-t border-line">
            {y.results.map((r) => (
              <li key={r.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center"><Mark kind={r.kind} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text">{r.title}</span>
                  <span className="block text-xs text-muted">
                    {r.kind === "signed" ? `Signed by ${r.by ?? "a reviewer"}` : "Backed by GitHub"} · {r.when} · <Link href={r.href} className="text-text-2 underline-offset-4 hover:text-text hover:underline">{r.project}</Link>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {y.more > 0 && <p className="border-t border-line pt-2.5 text-xs text-muted"><a href="#projects" className="hover:text-text hover:underline">{y.more} more from {y.year} on the projects below</a></p>}
      </div>

      {(data.earlier || (own && ember)) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          {data.earlier ? <a href="#projects" className="hover:text-text hover:underline">{data.earlier.results} earlier result{data.earlier.results === 1 ? "" : "s"} from before {data.earlier.before} on the projects below</a> : <span />}
          {own && ember && <Link href={`/copilot?q=${encodeURIComponent(TELL)}`} className="inline-flex items-center gap-1 font-medium text-text underline-offset-4 hover:underline">Have Ember tell this story <ArrowRight className="size-3.5" /></Link>}
        </div>
      )}
    </section>
  );
}

// 26 to 40px across when the row is full: the smallest still holds a two-digit count at 12px, the
// largest still fits eight to a row on a phone. 32 to 52px when there are five years or fewer.
function Node({ year, roomy }: { year: RecordYear; roomy: boolean }) {
  const proven = year.signed + year.backed;
  const d = roomy ? 32 + Math.round(year.size * 20) : 26 + Math.round(year.size * 14);
  const r = 43;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={d} height={d} aria-hidden="true" className="block">
      {/* The fill hides the joining line where it passes behind the node. */}
      <circle cx="50" cy="50" r="50" fill="var(--surface)" />
      {proven === 0 ? (
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--wait)" strokeWidth="9" strokeDasharray="13 9" />
      ) : (
        <>
          <circle cx="50" cy="50" r={r} fill="none" stroke={year.backed ? "var(--info)" : "var(--ok)"} strokeWidth="13" />
          {year.backed > 0 && year.signed > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="var(--ok)" strokeWidth="13" strokeDasharray={`${(year.signed / proven) * c} ${c}`} transform="rotate(-90 50 50)" />}
        </>
      )}
    </svg>
  );
}
