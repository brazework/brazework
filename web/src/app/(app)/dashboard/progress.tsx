import { ArrowRight, Flag, Flame, Hammer, Lock, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { EmptyState, Panel } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { cn } from "@/lib/forge";
import { days, type Progress } from "@/lib/progress";
import { Bars, Sparkline, type Unit } from "./charts";

// The dashboard's first view, Progress (lib/progress.ts): what you built, how much of it someone who
// saw it has verified and who, the tools behind it, your streak and your goal. Sentences first, then
// one number, one small chart and one line per section, in the dashboard's chart rules (charts.tsx:
// one series in ink). The same for a student (classes and clubs) and a builder who isn't one
// (vouches from managers and mentors). Only you see it; grades never appear here.
export function ProgressView({ p, unit, period }: { p: Progress; unit: Unit; period: string }) {
  if (!p.everLogged)
    return (
      <div className="mt-6">
        <EmptyState
          icon={<Hammer className="size-5" />}
          title="Your progress starts with one milestone"
          body="Log something you finished, with the file that shows it, and ask whoever saw it to verify: your professor, your club, a manager or a mentor. This page fills in as you go."
          action={<Link href="/projects" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent">Go to your projects <ArrowRight className="size-4" /></Link>}
        />
      </div>
    );
  const tiles = [
    { name: `Logged, last ${period}`, value: p.logged.toLocaleString("en-US"), trend: p.loggedSeries.map((x) => x.value) },
    { name: `Verified, last ${period}`, value: p.verified.toLocaleString("en-US"), trend: p.verifiedSeries.map((x) => x.value) },
    { name: "Of what you logged, verified", value: p.share === null ? "–" : `${p.share}%`, trend: [] },
    { name: "Typical wait to verify", value: p.medianDays === null ? "–" : days(p.medianDays).replace("less than a day", "< 1 day"), trend: [] },
  ];
  const most = Math.max(1, ...p.byKind.map((k) => k.n));
  const topTool = Math.max(1, ...p.tools.map((t) => t.n));
  return (
    <div data-testid="progress">
      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="sr-only">Summary</h2>
        <ul aria-label="Summary" className="space-y-1.5">
          {p.summary.map((s, i) => <li key={i} className={cn(i === 0 ? "text-lg font-semibold tracking-tight text-text sm:text-xl" : "text-[15px] text-text-2")}>{s}</li>)}
        </ul>
      </Panel>

      <ul className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.name}>
            <Panel className="h-full p-4">
              <div className="text-xs text-muted">{t.name}</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{t.value}</div>
              {t.trend.length > 1 ? <Sparkline values={t.trend} label={t.name} /> : <div className="mt-2 h-8" aria-hidden="true" />}
            </Panel>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <Kicker className="flex items-center gap-1.5"><Hammer className="size-3.5" /> Built</Kicker>
          <Bars series={p.loggedSeries} unit={unit} label="Milestones logged" height="h-32" />
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Flame className={cn("size-4 shrink-0", p.streak.weeks ? "text-brand" : "text-faint")} aria-hidden="true" />
            {p.streak.weeks ? <span><span className="font-medium text-text">{p.streak.weeks} {p.streak.weeks === 1 ? "week" : "weeks"}</span> in a row with work shown{p.streak.thisWeek ? "" : ". Post this week to keep it going"}.</span> : <span>Show work this week to start a streak.</span>}
          </p>
        </Panel>
        <Panel>
          <Kicker className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Proven</Kicker>
          <Bars series={p.verifiedSeries} unit={unit} label="Milestones verified" height="h-32" />
          <p className="mt-3 text-sm text-muted">{p.everVerified ? <>Who verified your work, all time ({p.everVerified}):</> : <>Nothing verified yet{p.waiting ? `: ${p.waiting} waiting for whoever saw it` : ""}.</>}</p>
          {p.byKind.length > 0 && (
            <ul aria-label="Who verified" className="mt-2 space-y-1.5 text-sm">
              {p.byKind.map((k) => (
                <li key={k.kind} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2rem] items-center gap-2">
                  <span className="truncate text-text-2">{k.label}</span>
                  <span className="h-1.5 rounded-full bg-raised"><span className="block h-full rounded-full bg-text/80" style={{ width: `${(k.n / most) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{k.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <Kicker className="flex items-center gap-1.5"><Wrench className="size-3.5" /> Skills</Kicker>
          {p.tools.length ? (
            <>
              <p className="mt-3 text-sm text-muted">What your milestones were built with, from your projects&apos; &ldquo;Built with&rdquo;.</p>
              <ul aria-label="Tools" className="mt-3 space-y-1.5 text-sm">
                {p.tools.map((t) => (
                  <li key={t.tool} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2rem] items-center gap-2">
                    <span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-text-2">{t.tool}</span>{t.fresh && <span className="shrink-0 rounded-full border border-line px-1.5 font-mono text-[10px] text-brand">new</span>}</span>
                    <span className="h-1.5 rounded-full bg-raised"><span className="block h-full rounded-full bg-text/80" style={{ width: `${(t.n / topTool) * 100}%` }} /></span>
                    <span className="text-right tabular-nums">{t.n}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Add what a project is built with (its languages, tools and machines) and each one shows here as you log work on it.</p>
          )}
        </Panel>
        <Panel>
          <Kicker className="flex items-center gap-1.5"><Flag className="size-3.5" /> Goal</Kicker>
          {p.goal ? (
            <>
              <p className="mt-3 text-lg font-semibold tracking-tight first-letter:uppercase">{p.goal.title}</p>
              <p className="mt-1 text-sm text-muted"><span className="font-medium text-text tabular-nums">{p.goal.verified}</span> verified {p.goal.verified === 1 ? "milestone" : "milestones"} since you set it. Verified work is what a recruiter or a program can trust.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Set a goal (an internship, a job, grad school, a competition) and this shows how your verified work adds up toward it.</p>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-faint"><Lock className="size-3 shrink-0" /> Only you see this page. Grades from your courses never appear here.</p>
        </Panel>
      </div>
    </div>
  );
}
