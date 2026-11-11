import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Flame, Landmark, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";
import { VerifiedStamp } from "@/components/app/verified-seal";
import { cn, timeAgo } from "@/lib/forge";
import { createClient } from "@/lib/supabase/server";

// /n/<slug> (Linear FIX-71): a national network's page, signed out too. Its chapters ranked by how
// many members were active this month (then verified milestones, then posts), and recent verified
// work across chapters. Totals only, from network_page() in supabase/chapters.sql.
type Chapter = { id: string; name: string; school: string | null; members: number; active: number; posts: number; verified: number };
type Page = { id: string; name: string; short: string; slug: string; about: string; days: number; chapters: Chapter[]; recent: { title: string; by: string; owner: string; chapter: string; chapter_id: string; at: string }[] };

async function load(slug: string): Promise<Page | null> {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_page", { p_slug: slug, p_days: 30 });
  return error ? null : ((data as Page | null) ?? null);
}

export async function generateMetadata({ params }: PageProps<"/n/[slug]">): Promise<Metadata> {
  const n = await load((await params).slug);
  return n ? { title: `${n.name} on Brazework`, description: `${n.chapters.length} ${n.short} chapters building in public on Brazework.` } : { title: "Not found" };
}

export default function NetworkPage({ params }: PageProps<"/n/[slug]">) {
  return (
    <main className="relative isolate min-h-dvh px-4 py-8 sm:px-6 sm:py-12">
      <div className="app-backdrop absolute inset-0 -z-10" />
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="Brazework home"><Logo /></Link>
          <ThemeToggle />
        </div>
        <Suspense fallback={<div className="h-96 shimmer rounded-3xl" />}><Network params={params} /></Suspense>
      </div>
    </main>
  );
}

async function Network({ params }: { params: PageProps<"/n/[slug]">["params"] }) {
  const n = await load((await params).slug);
  if (!n) notFound();
  const total = n.chapters.reduce((a, c) => ({ members: a.members + c.members, active: a.active + c.active, verified: a.verified + c.verified }), { members: 0, active: 0, verified: 0 });
  const top = Math.max(1, ...n.chapters.map((c) => c.active));

  return (
    <>
      <section aria-label={n.name} className="glass-card relative overflow-hidden rounded-[28px] p-6 sm:p-8">
        <div aria-hidden className="cover-empty pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative">
          <span className="grid size-14 place-items-center rounded-2xl bg-text text-base font-bold text-surface">{n.short.slice(0, 4)}</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{n.name}</h1>
          {n.about && <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">{n.about}</p>}
          <ul className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {[[Landmark, n.chapters.length, n.chapters.length === 1 ? "chapter" : "chapters"], [Users, total.active, `active in ${n.days} days`], [BadgeCheck, total.verified, "verified milestones"]].map(([Icon, v, label]) => {
              const I = Icon as typeof Landmark;
              return (
                <li key={String(label)} className="rounded-2xl bg-surface/80 p-3 ring-1 ring-line sm:p-4">
                  <I className="size-4 text-muted" />
                  <div className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">{String(v)}</div>
                  <div className="text-[11px] leading-tight text-faint sm:text-xs">{String(label)}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-label="Most active chapters" className="mt-6">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight">Most active chapters this month</h2>
          <span className="text-xs text-faint">members who posted or got verified</span>
        </div>
        {n.chapters.length ? (
          <ol className="flex flex-col gap-2">
            {n.chapters.map((c, i) => (
              <li key={c.id} className="glass-card flex items-center gap-3 rounded-2xl p-3.5 sm:gap-4 sm:p-4">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums", i === 0 && c.active ? "bg-text text-surface" : "bg-surface-2 text-muted")}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-text transition-[width]" style={{ width: `${(c.active / top) * 100}%` }} /></span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">{c.active}/{c.members} active</span>
                  </div>
                </div>
                <span className="hidden shrink-0 items-center gap-1 text-xs text-muted sm:inline-flex"><BadgeCheck className="size-3.5 text-ok" /> {c.verified}</span>
                <span className="hidden shrink-0 items-center gap-1 text-xs text-muted sm:inline-flex"><Flame className="size-3.5" /> {c.posts}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-3xl border border-dashed border-line p-6 text-sm text-muted">No chapters yet. Start the first one.</p>
        )}
      </section>

      {n.recent.length > 0 && (
        <section aria-label="Recently verified" className="mt-8">
          <h2 className="mb-3 px-1 text-lg font-semibold tracking-tight">Recently verified across chapters</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {n.recent.map((r, i) => (
              <li key={i} className="glass-card rounded-2xl p-4">
                <VerifiedStamp club={r.chapter} clubId={r.chapter_id} size="sm" />
                <p className="mt-1.5 line-clamp-2 font-medium">{r.title}</p>
                <p className="mt-1 text-xs text-faint">{r.by} · {timeAgo(r.at)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 flex flex-col items-start gap-3 rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Is your school&apos;s chapter here?</p>
          <p className="mt-0.5 text-sm text-muted">Start it with your school email. Members join with one link and land in your chapter&apos;s feed.</p>
        </div>
        <Link href="/chapters/new" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-text px-5 text-sm font-semibold text-surface transition hover:opacity-90">Start a chapter <ArrowRight className="size-4" /></Link>
      </section>
      <p className="mt-6 text-center text-xs text-faint">Each chapter is run by its own members. This page isn&apos;t run by {n.short} National; it shows what chapters build on Brazework.</p>
    </>
  );
}
