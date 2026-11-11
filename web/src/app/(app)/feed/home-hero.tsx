import { ArrowRight, BadgeCheck, Check, Eye, Flame, Hammer, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/forge";
import type { LoopStep } from "@/lib/week";

// The top of Home (Linear FIX-67): where you are, in one glance. A greeting and one sentence about
// your week, three numbers that matter (build streak, club-verified milestones, profile views),
// Brazework's path (Build → Verify → Get found) as chips, and the one thing to do next.
const STEP_ICON = { build: Hammer, verify: BadgeCheck, found: Eye } as const;

export function HomeHero({ first, steps, streak, recent, verified, viewers, verifyQueue }: {
  first: string;
  steps: LoopStep[];
  streak: { weeks: number; thisWeek: boolean };
  recent: boolean[];
  verified: number;
  viewers: { total: number; companies: string[] } | undefined;
  verifyQueue: { href: string; n: number } | null;
}) {
  const now = steps.find((s) => s.state === "now");
  const views = viewers?.total ?? 0;
  const company = viewers?.companies[0];
  // One sentence that's about you, from real numbers only.
  const sentence = [
    streak.weeks ? `You're on a ${streak.weeks}-week build streak${streak.thisWeek ? "" : " (post this week to keep it)"}.` : "Share what you're building this week to start a streak.",
    company ? `${company} looked at your profile.` : views ? `${views} ${views === 1 ? "person" : "people"} looked at your profile this week.` : verified ? `${verified} of your milestones ${verified === 1 ? "is" : "are"} club-verified.` : "",
  ].filter(Boolean).join(" ");

  return (
    <section aria-label="Your progress" className="glass-card relative mb-4 overflow-hidden rounded-[28px]">
      {/* Depth in the theme's own colours (any skin): the engineering grid and soft light used for empty covers. */}
      <div aria-hidden className="cover-empty pointer-events-none absolute inset-0 opacity-80 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="relative p-5 sm:p-7">
        {verifyQueue && (
          <Link href={verifyQueue.href} className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-xs font-medium text-text ring-1 ring-line transition hover:bg-hover">
            <ShieldCheck className="size-3.5 shrink-0 text-amber-500" />
            <span className="truncate">{verifyQueue.n} {verifyQueue.n === 1 ? "milestone is" : "milestones are"} waiting for you to verify</span>
            <ArrowRight className="size-3.5 shrink-0" />
          </Link>
        )}
        <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">Welcome back, {first}</h1>
        <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-muted">{sentence}</p>

        {/* The three numbers. */}
        <ul className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <li className="rounded-2xl bg-surface/80 p-3 ring-1 ring-line sm:p-4">
            <div className="flex items-center justify-between"><Flame className={cn("size-4", streak.weeks ? "fill-orange-500/25 text-orange-500" : "text-faint")} /></div>
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{streak.weeks}</div>
            <div className="text-[11px] leading-tight text-faint sm:text-xs">week streak</div>
            <div className="mt-2 flex gap-[3px]" aria-hidden="true">
              {recent.map((on, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", on ? "bg-text" : "bg-line")} />)}
            </div>
          </li>
          <li className="rounded-2xl bg-surface/80 p-3 ring-1 ring-line sm:p-4">
            <BadgeCheck className="size-4 text-ok" />
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{verified}</div>
            <div className="text-[11px] leading-tight text-faint sm:text-xs">club-verified</div>
          </li>
          <li className="rounded-2xl bg-surface/80 p-3 ring-1 ring-line sm:p-4">
            <Eye className="size-4 text-muted" />
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{views}</div>
            <div className="text-[11px] leading-tight text-faint sm:text-xs">profile views this week</div>
          </li>
        </ul>

        {/* The path, and the one thing to do next. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Build, verify, get found">
            {steps.map((s, i) => {
              const Icon = STEP_ICON[s.id];
              return (
                <li key={s.id} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden className={cn("h-px w-3 sm:w-5", s.state === "done" ? "bg-ok/50" : "bg-line-strong")} />}
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    s.state === "done" ? "bg-ok/10 text-ok" : s.state === "now" ? "bg-text text-surface" : "bg-surface-2 text-faint")}
                    title={s.line}>
                    {s.state === "done" ? <Check className="size-3.5" /> : <Icon className="size-3.5" />} {s.title}
                    <span className="sr-only">: {s.state === "done" ? "done" : s.state === "now" ? "next" : "later"}. {s.line}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {now?.cta ? (
            <Link href={now.cta.href} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-text px-5 text-sm font-semibold text-surface shadow-[var(--shadow)] transition hover:-translate-y-px hover:opacity-90 active:scale-[0.98] sm:h-10 sm:w-auto">
              {now.cta.label} <ArrowRight className="size-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ok"><Check className="size-4" /> All three this week</span>
          )}
        </div>
      </div>
    </section>
  );
}
