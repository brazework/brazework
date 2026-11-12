import { BadgeCheck, Lock, Play, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Schematic } from "@/components/landing/schematics";
import { cn, timeAgo } from "@/lib/forge";
import type { Build } from "@/lib/home-builds";
import { mediaUrl } from "@/lib/media";

// "Your builds" on Home (FIX-92): your latest projects as roomy cards, two across, so each has space to
// breathe: a wide cover (photo, or the drawing for its field), where it stands, and one clear next step
// (Post update; the reel is a small icon beside it). Two on a phone, four on wider screens; the rest
// are one tap away in All projects. Starting the next build is a quiet row underneath.
// Rows stay full: four when there are four or more, otherwise two (one card alone on a row looks lost).

export function YourBuilds({ builds }: { builds: Build[] }) {
  const SHOWN = builds.length >= 4 ? 4 : 2;
  const more = builds.length - SHOWN;
  return (
    <section aria-label="Your builds" className="mb-2">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Your builds</h2>
        <Link href="/projects" className="text-xs font-medium text-muted transition hover:text-text">{more > 0 ? `All ${builds.length} projects` : "All projects"} →</Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {builds.slice(0, SHOWN).map((b, i) => (
          <li key={b.id} className={cn(i >= 2 && "hidden sm:block")}>
            <article className="group glass-card flex h-full flex-col overflow-hidden rounded-2xl transition hover:border-line-strong">
              <Link href={`/projects/${b.id}`} className="cover-empty relative block aspect-[16/7] overflow-hidden" aria-label={`Open ${b.title}`}>
                {b.cover ? (
                  <Image src={mediaUrl(b.cover)} alt="" fill sizes="(min-width: 640px) 360px, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" />
                ) : (
                  <Schematic id={b.field} className="absolute top-1/2 left-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 text-text/40" />
                )}
                {b.private && <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-md bg-surface/90 px-2 py-0.5 text-[11px] text-text ring-1 ring-line"><Lock className="size-3" /> Private</span>}
              </Link>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/projects/${b.id}`} className="line-clamp-1 font-medium tracking-tight hover:underline">{b.title}</Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", b.status === "completed" ? "bg-ok" : "bg-orange-500")} aria-hidden="true" />{b.status === "completed" ? "Completed" : "In progress"}</span>
                    <span className="text-faint">·</span>
                    <span>updated {timeAgo(b.updated_at)}</span>
                    {b.verified > 0 && <><span className="text-faint">·</span><span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="size-3.5" />{b.verified} verified</span></>}
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <Link href={`/feed?project=${b.id}#composer`} className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium transition hover:bg-hover">Post update</Link>
                  <Link href={`/projects/${b.id}/reel`} aria-label="Reel" title={`Play the reel for ${b.title}`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-text-2 transition hover:bg-hover hover:text-text"><Play className="size-3.5 fill-current" /></Link>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <Link href="/projects" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-sm text-muted transition hover:border-text hover:bg-hover/40 hover:text-text">
        <Plus className="size-4" /> Start a new build
      </Link>
    </section>
  );
}
