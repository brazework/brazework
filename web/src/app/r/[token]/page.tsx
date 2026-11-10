import type { Metadata } from "next";
import { BadgeCheck, CalendarDays, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Club report", robots: { index: false, follow: false } };

type Report = {
  club: { id: string; name: string; about: string; field: string; members: number };
  since: string;
  events: { title: string; type: string; starts_at: string; going: number }[];
  verified: { title: string; member: string; project: string | null; verified_by: string; at: string }[];
  builders: number;
  posts: number;
  wins: { member: string; place: number; challenge: string; sponsor: string }[];
};

const day = (ts: string) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// A club's semester at a glance, for people who aren't on Forge (a sponsor, a dean). Opened from a
// private link an officer shares; public information only (supabase/club-reports.sql).
export default function ClubReportPage({ params }: PageProps<"/r/[token]">) {
  return (
    <main className="min-h-dvh bg-bg text-text print:bg-white print:text-black">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Suspense fallback={<p className="text-sm text-muted">Loading the report…</p>}>
          <ReportBody params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function ReportBody({ params }: { params: PageProps<"/r/[token]">["params"] }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9a-f]{32}$/.test(token) ? await supabase.rpc("public_club_report", { p_token: token }) : { data: null };
  const r = data as Report | null;
  if (!r?.club) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">This report link isn&apos;t active</h1>
        <p className="text-sm text-muted">The club may have turned it off. Ask its officers for a new link.</p>
      </div>
    );
  }
  const stats = [
    { icon: Users, n: r.club.members, label: r.club.members === 1 ? "member" : "members" },
    { icon: CalendarDays, n: r.events.length, label: r.events.length === 1 ? "event held" : "events held" },
    { icon: BadgeCheck, n: r.verified.length, label: "milestones verified" },
    { icon: Trophy, n: r.wins.length, label: r.wins.length === 1 ? "challenge win" : "challenge wins" },
  ];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <span className="text-xs text-faint">Club report · {day(r.since)} to {day(new Date().toISOString())}</span>
      </div>
      <h1 className="text-grad mt-10 text-3xl font-semibold tracking-tight sm:text-4xl">{r.club.name}</h1>
      {r.club.field && <p className="mt-1 text-sm text-muted">{r.club.field}</p>}
      {r.club.about && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-2">{r.club.about}</p>}

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="rounded-3xl border border-line bg-surface p-4 print:border-neutral-300">
            <s.icon className="size-4 text-muted" />
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{s.n}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-faint">{r.builders} {r.builders === 1 ? "member has" : "members have"} work verified by the club&apos;s officers this period, and members shared {r.posts} {r.posts === 1 ? "update" : "updates"} with the club.</p>

      {r.verified.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Verified work</h2>
          <p className="mt-1 text-sm text-muted">Each milestone was checked against its evidence by a club officer, who is named.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {r.verified.map((v, i) => (
              <li key={i} className="rounded-2xl border border-line bg-surface px-4 py-3 print:break-inside-avoid print:border-neutral-300">
                <p className="font-medium">{v.title}</p>
                <p className="mt-0.5 text-xs text-muted">{v.member}{v.project ? ` · ${v.project}` : ""} · verified by {v.verified_by || "an officer"}, {day(v.at)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.wins.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Challenge wins</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {r.wins.map((w, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 print:border-neutral-300">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{["1st", "2nd", "3rd"][w.place - 1]}</span>
                <span className="min-w-0"><span className="block font-medium">{w.member}</span><span className="block text-xs text-muted">{w.challenge} · sponsored by {w.sponsor}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.events.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Events</h2>
          <ul className="mt-4 flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface print:border-neutral-300">
            {r.events.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium">{e.title}</span><span className="text-xs text-muted">{e.type} · {day(e.starts_at)}</span></span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{e.going} going</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!r.verified.length && !r.events.length && !r.wins.length && <p className="mt-10 text-sm text-muted">Nothing to report for this period yet.</p>}

      <p className="mt-12 border-t border-line pt-6 text-xs text-faint print:border-neutral-300">
        Made with <Link href="/" className="underline">Forge</Link>, where clubs verify what their members build. Shared by the club&apos;s officers; public information only.
      </p>
    </>
  );
}
