"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown, Flame, Newspaper } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { foldMotion, useFold } from "@/components/app/rail-card";
import { cn, timeAgo } from "@/lib/forge";
import type { NewsPick } from "@/lib/news";

type Tab = "trending" | "news";
const KEY = "forge.rail.tab";

// One box, two views: what's trending on Forge, and STEM news from around the web picked for your
// interests. Flip between them with the tabs; Forge remembers which one you looked at last.
export function TrendingNews({ trending, news, hasInterests }: { trending: [string, number][]; news: NewsPick[]; hasInterests: boolean }) {
  const [tab, setTab] = useState<Tab>(trending.length ? "trending" : "news");
  const [folded, setFolded] = useFold("news");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference after hydration
      if (saved === "news" || saved === "trending") setTab(saved);
    } catch {}
  }, []);
  const pick = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem(KEY, t); } catch {}
  };

  return (
    <section data-tour="news" aria-label="Trending and news" className="glass-card rounded-3xl p-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setFolded(!folded)} aria-expanded={!folded} aria-controls="rail-news-body" className="group -m-1 flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 text-left">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-grad text-on-accent">
            {tab === "trending" ? <Flame className="size-3.5" /> : <Newspaper className="size-3.5" />}
          </span>
          <span className="min-w-0"><h2 className="text-sm font-semibold">Trending &amp; news</h2>{folded && trending[0] && <span className="block truncate text-xs text-muted">Top: #{trending[0][0]}</span>}</span>
          <ChevronDown className={cn("ml-auto size-4 shrink-0 text-faint transition group-hover:text-text", !folded && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
      {!folded && (
      <motion.div id="rail-news-body" {...foldMotion} className="overflow-hidden">
      <div role="tablist" aria-label="Show" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {([["trending", "Trending"], ["news", "News"]] as const).map(([t, label]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={`rail-${t}`}
              onClick={() => pick(t)}
              className={cn("rounded-lg px-3 py-1 text-xs font-medium transition", tab === t ? "bg-surface text-text shadow-[var(--shadow)]" : "text-muted hover:text-text")}
            >
              {label}
            </button>
          ))}
        </div>
      {tab === "trending" ? (
        <div id="rail-trending" role="tabpanel" aria-label="Trending on Forge">
          <h2 className="mt-3 text-sm font-semibold">Trending on Forge</h2>
          {trending.length ? (
            <ol className="mt-1 flex flex-col">
              {trending.map(([t, n], i) => (
                <li key={t}>
                  <Link href={`/feed?tab=latest&tag=${encodeURIComponent(t)}`} className="group flex items-center gap-3 rounded-xl px-1.5 py-2 transition hover:bg-hover">
                    <span className="w-4 text-xs font-semibold text-faint tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-text">#{t}</span>
                    <span className="text-xs text-faint tabular-nums">{n} {n === 1 ? "post" : "posts"}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">Tag your posts with topics and the most popular ones show up here.</p>
          )}
        </div>
      ) : (
        <div id="rail-news" role="tabpanel" aria-label="STEM news for you">
          <h2 className="mt-3 text-sm font-semibold">STEM news for you</h2>
          {news.length ? (
            <ul className="mt-1 flex flex-col">
              {news.map((n) => (
                <li key={n.link}>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-0.5 rounded-xl px-1.5 py-2 transition hover:bg-hover">
                    <span className="line-clamp-2 text-sm leading-snug font-medium group-hover:text-text">
                      {n.title}
                      <ArrowUpRight className="ml-0.5 inline size-3 text-faint" aria-hidden="true" />
                      <span className="sr-only"> (opens {n.source} in a new tab)</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-faint">
                      <span>{n.source}</span>
                      <span aria-hidden="true">·</span>
                      <span>{timeAgo(n.published)}</span>
                      {n.reason !== "Top STEM news" && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] text-accent">{n.reason}</span>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Couldn&apos;t load the news right now. Check back in a bit.</p>
          )}
          <p className="mt-2 text-[11px] text-faint">
            {hasInterests ? "Picked for your interests from" : "Latest from"} IEEE Spectrum, ScienceDaily, Nature, NASA and more.{" "}
            {!hasInterests && <Link href="/settings#profile" className="underline underline-offset-2 hover:text-text">Add interests</Link>}
          </p>
        </div>
      )}
      </motion.div>
      )}
      </AnimatePresence>
    </section>
  );
}
