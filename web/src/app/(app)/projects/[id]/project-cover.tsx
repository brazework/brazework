import { BadgeCheck, CheckCircle2, Clock, Lock, Users } from "lucide-react";
import Image from "next/image";
import { cn, timeAgo } from "@/lib/forge";

// The top of a project page (redesigned 2026-11-26, the founders' call: no line design on any banner).
// A smooth dark surface lit in copper, with the title set large and where the project stands as a few
// quiet facts under it: which club, how much is signed, what's waiting, who builds it, when it started.
// The work itself (its newest photo) sits beside it when there is one; there is no drawing or grid.

export type CoverFacts = { club: string | null; signed: number; waiting: number; builders: number; started: string };

export function ProjectCover({ title, isPrivate, live, year, last, cover, facts }: {
  title: string; isPrivate: boolean; live: "shipped" | "building" | "quiet"; year: number | null; last: number | null;
  cover: { src: string; alt: string } | null; facts: CoverFacts;
}) {
  const ago = last ? timeAgo(new Date(last).toISOString()) : "";
  const fact = "inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] backdrop-blur-sm";
  return (
    // theme-dark gives everything on it the dark tokens, in both themes (globals.css cover-blueprint).
    <div className={cn("theme-dark cover-blueprint relative grid gap-6 p-6 text-text sm:p-8", cover && "sm:grid-cols-[minmax(0,1fr)_minmax(0,36%)]")}>
      {cover && (
        <figure className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-white/[0.04] shadow-[0_24px_48px_-24px_rgb(0_0_0/0.8)] sm:col-start-2 sm:row-span-2 sm:aspect-[4/3] sm:self-center">
          <Image src={cover.src} alt={cover.alt} fill priority sizes="(min-width: 1280px) 320px, (min-width: 640px) 36vw, 100vw" className="object-cover" />
        </figure>
      )}
      <div className="flex min-w-0 flex-col justify-center sm:col-start-1 sm:row-start-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {live === "shipped" ? <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-ok" /> Shipped{year ? ` ${year}` : ""}</span>
            : live === "building" ? <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-ok motion-safe:animate-pulse" aria-hidden="true" /> Building, last activity {ago}</span>
            : <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-faint" aria-hidden="true" /> Quiet{ago ? `, last activity ${ago}` : ""}</span>}
          {isPrivate && <span className="inline-flex items-center gap-1"><Lock className="size-3.5" /> Private</span>}
        </p>
        <h1 className="mt-2 text-[clamp(2.1rem,6vw,3rem)] leading-[1.04] font-semibold tracking-[-0.04em] text-balance break-words text-text">{title}</h1>
      </div>
      {/* Where it stands, as quiet facts (no boxes or dividers). */}
      <dl aria-label="Where it stands" className="flex flex-wrap gap-2 sm:col-start-1 sm:row-start-2">
        {facts.club && <div className={fact}><dt className="text-muted">Club</dt><dd className="font-medium">{facts.club}</dd></div>}
        <div className={cn(fact, facts.signed && "text-ok")}><dt className="sr-only">Signed</dt><dd className="inline-flex items-center gap-1.5 font-medium"><BadgeCheck className="size-4" /> {facts.signed} signed</dd></div>
        <div className={fact}><dt className="text-muted">Waiting</dt><dd className="inline-flex items-center gap-1 font-medium tabular-nums"><Clock className="size-3.5 text-faint" aria-hidden="true" />{facts.waiting}</dd></div>
        <div className={fact}><dt className="sr-only">{facts.builders === 1 ? "Builder" : "Builders"}</dt><dd className="inline-flex items-center gap-1.5 font-medium"><Users className="size-3.5 text-muted" aria-hidden="true" /> {facts.builders} {facts.builders === 1 ? "builder" : "builders"}</dd></div>
        <div className={fact}><dt className="text-muted">Started</dt><dd className="font-medium">{facts.started}</dd></div>
      </dl>
    </div>
  );
}
