import { BadgeCheck, CheckCircle2, Clock, Lock } from "lucide-react";
import Image from "next/image";
import { Schematic } from "@/components/landing/schematics";
import { TitleBlock } from "@/components/app/title-block";
import { timeAgo } from "@/lib/forge";

// The top of a project page, drawn as an engineering drawing sheet (the flow redesign): a faint grid,
// the work itself (its newest photo, or a line drawing for its field), the title set in ink, and in the
// corner a title block, the box where a drawing says who drew it and who checked it. Here it says which
// club, how much is signed and what's still waiting. It replaces the dark photo banner and the four
// number tiles: one place to read where the project stands.

export type CoverFacts = { club: string | null; signed: number; waiting: number; builders: number; started: string };

export function ProjectCover({ title, isPrivate, live, year, last, cover, schematic, facts }: {
  title: string; isPrivate: boolean; live: "shipped" | "building" | "quiet"; year: number | null; last: number | null;
  cover: { src: string; alt: string } | null; schematic: string; facts: CoverFacts;
}) {
  const ago = last ? timeAgo(new Date(last).toISOString()) : "";
  return (
    <div className="sheet-grid relative grid gap-5 border-b border-line p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,38%)] sm:gap-7 sm:p-7">
      {/* The work: its newest photo, framed like a figure on the sheet, or the line drawing for its field. */}
      <figure className="relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-surface sm:col-start-2 sm:row-start-1 sm:aspect-[4/3] sm:self-center">
        {cover ? <Image src={cover.src} alt={cover.alt} fill priority sizes="(min-width: 1280px) 340px, (min-width: 640px) 38vw, 100vw" className="object-cover" />
          : <Schematic id={schematic} className="absolute top-1/2 left-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 text-text/55" />}
      </figure>
      <div className="flex min-w-0 flex-col justify-center sm:col-start-1 sm:row-start-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {live === "shipped" ? <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-ok" /> Shipped{year ? ` ${year}` : ""}</span>
            : live === "building" ? <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-ok motion-safe:animate-pulse" aria-hidden="true" /> Building, last activity {ago}</span>
            : <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-faint" aria-hidden="true" /> Quiet{ago ? `, last activity ${ago}` : ""}</span>}
          {isPrivate && <span className="inline-flex items-center gap-1"><Lock className="size-3.5" /> Private</span>}
        </p>
        <h1 className="mt-2 text-[1.9rem] leading-[1.1] font-semibold tracking-[-0.02em] text-balance break-words text-text sm:text-[2.75rem]">{title}</h1>
      </div>
      {/* The title block: which club (if it's in one), how much is signed, what's waiting (components/app/title-block.tsx). */}
      <TitleBlock label="Where it stands" className="sm:col-span-2 sm:row-start-2" cells={[
        ...(facts.club ? [{ label: "Club", value: facts.club, wide: true }] : []),
        { label: "Signed", value: facts.signed ? <span className="inline-flex items-center gap-1"><BadgeCheck className="size-4" /> {facts.signed}</span> : "0", tone: facts.signed ? "ok" : undefined },
        { label: "Waiting", value: facts.waiting ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5 text-faint" /> {facts.waiting}</span> : "0" },
        { label: facts.builders === 1 ? "Builder" : "Builders", value: facts.builders },
        { label: "Started", value: facts.started },
      ]} />
    </div>
  );
}
