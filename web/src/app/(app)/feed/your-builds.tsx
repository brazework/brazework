import { BadgeCheck, Lock, Play, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Schematic } from "@/components/landing/schematics";
import { timeAgo } from "@/lib/forge";
import type { Build } from "@/lib/home-builds";
import { mediaUrl } from "@/lib/media";

// "Your builds" on Home: your projects as cards in a row you can swipe (cover photo or the drawing
// for its field, club-verified count, a one-tap reel), ending with a card to start the next one.
export function YourBuilds({ builds }: { builds: Build[] }) {
  return (
    <section aria-label="Your builds" className="mb-4">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Your builds</h2>
        <Link href="/projects" className="text-xs font-medium text-muted transition hover:text-text">All projects →</Link>
      </div>
      {/* A scroller clips both ways, so the padding gives the cards' shadow and hover lift room;
          the negative margin takes the space back. On wider screens the row fades out at the right. */}
      <ul className="no-scrollbar -mx-4 -mt-2 -mb-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pt-2 pb-8 sm:mx-0 sm:scroll-px-0 sm:pr-24 sm:pl-0 sm:[mask-image:linear-gradient(to_right,black_88%,transparent)]">
        {builds.map((b) => (
          <li key={b.id} className="w-[15.5rem] shrink-0 snap-start">
            <div className="group glass-card relative flex h-full flex-col overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-28px_rgb(0_0_0/0.45)]">
              <Link href={`/projects/${b.id}`} className="relative block aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,#0b1020,#1b2440_55%,#0b1020)]" aria-label={b.title}>
                {b.cover ? (
                  <Image src={mediaUrl(b.cover)} alt="" fill sizes="248px" className="object-cover transition duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <>
                    <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:18px_18px]" />
                    <Schematic id={b.field} className="absolute top-1/2 left-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 text-white/55 transition duration-500 group-hover:scale-105" />
                  </>
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                  {b.verified > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-semibold text-white"><BadgeCheck className="size-3" /> {b.verified}</span>}
                  {b.private && <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white backdrop-blur"><Lock className="size-3" /> Private</span>}
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-3.5">
                <Link href={`/projects/${b.id}`} className="line-clamp-1 font-medium hover:underline">{b.title}</Link>
                <span className="mt-0.5 text-xs text-faint">{b.status === "completed" ? "Completed" : "In progress"} · updated {timeAgo(b.updated_at)}</span>
                <div className="mt-3 flex items-center gap-1.5">
                  <Link href={`/projects/${b.id}/reel`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-text px-3 text-xs font-semibold text-surface transition hover:opacity-90 active:scale-95"><Play className="size-3 fill-current" /> Reel</Link>
                  <Link href={`/feed?project=${b.id}#composer`} className="inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-medium transition hover:bg-hover">Post update</Link>
                </div>
              </div>
            </div>
          </li>
        ))}
        <li className="w-[11rem] shrink-0 snap-start">
          <Link href="/projects" className="group flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-strong p-4 text-center transition hover:border-text hover:bg-hover/40">
            <span className="grid size-11 place-items-center rounded-full bg-surface-2 transition group-hover:scale-110"><Plus className="size-5" /></span>
            <span className="text-sm font-medium">Start a new build</span>
            <span className="text-xs text-faint">A robot, a rig, a model, an app</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
