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
    <section aria-label="Your progress" className="relative mb-4 overflow-hidden rounded-[28px] bg-[#0a0f1e] text-white shadow-[0_30px_80px_-36px_rgb(10_15_30/0.75)]">
      {/* Depth: two soft glows and a faint engineering grid. */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 size-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(99_102_241/0.35),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -bottom-40 size-[24rem] rounded-full bg-[radial-gradient(closest-side,rgb(249_115_22/0.22),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <div className="relative p-5 sm:p-7">
        {verifyQueue && (
          <Link href={verifyQueue.href} className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full bg-amber-400/15 px-3.5 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-300/25 transition hover:bg-amber-400/25">
            <ShieldCheck className="size-3.5 shrink-0" />
            <span className="truncate">{verifyQueue.n} {verifyQueue.n === 1 ? "milestone is" : "milestones are"} waiting for you to verify</span>
            <ArrowRight className="size-3.5 shrink-0" />
          </Link>
        )}
        <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">Welcome back, {first}</h1>
        <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-white/70">{sentence}</p>

        {/* The three numbers. */}
        <ul className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <li className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur-sm sm:p-4">
            <div className="flex items-center justify-between"><Flame className={cn("size-4", streak.weeks ? "fill-orange-400/30 text-orange-400" : "text-white/40")} /></div>
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{streak.weeks}</div>
            <div className="text-[11px] leading-tight text-white/60 sm:text-xs">week streak</div>
            <div className="mt-2 flex gap-[3px]" aria-hidden="true">
              {recent.map((on, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", on ? "bg-gradient-to-r from-orange-400 to-amber-300" : "bg-white/12")} />)}
            </div>
          </li>
          <li className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur-sm sm:p-4">
            <BadgeCheck className="size-4 text-emerald-400" />
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{verified}</div>
            <div className="text-[11px] leading-tight text-white/60 sm:text-xs">club-verified</div>
          </li>
          <li className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur-sm sm:p-4">
            <Eye className="size-4 text-sky-400" />
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{views}</div>
            <div className="text-[11px] leading-tight text-white/60 sm:text-xs">profile views this week</div>
          </li>
        </ul>

        {/* The path, and the one thing to do next. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Build, verify, get found">
            {steps.map((s, i) => {
              const Icon = STEP_ICON[s.id];
              return (
                <li key={s.id} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden className={cn("h-px w-3 sm:w-5", s.state === "done" ? "bg-emerald-400/60" : "bg-white/20")} />}
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    s.state === "done" ? "bg-emerald-400/15 text-emerald-200" : s.state === "now" ? "bg-white text-[#0a0f1e]" : "bg-white/[0.07] text-white/60")}
                    title={s.line}>
                    {s.state === "done" ? <Check className="size-3.5" /> : <Icon className="size-3.5" />} {s.title}
                    <span className="sr-only">: {s.state === "done" ? "done" : s.state === "now" ? "next" : "later"}. {s.line}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {now?.cta ? (
            <Link href={now.cta.href} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#0a0f1e] shadow-[0_10px_30px_-12px_rgb(255_255_255/0.5)] transition hover:-translate-y-px hover:bg-white/90 active:scale-95">
              {now.cta.label} <ArrowRight className="size-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300"><Check className="size-4" /> All three this week</span>
          )}
        </div>
      </div>
    </section>
  );
}
