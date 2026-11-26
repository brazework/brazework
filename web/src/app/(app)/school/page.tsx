import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, BookOpen, ClipboardCheck, GraduationCap, Mail, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your school" };

// Your school (the school-first realignment, 2026-11-26, docs/strategy.md): the first step of the
// student portal, under Clubs in the sidebar. Your confirmed school email places you at your school
// (supabase/chapters.sql my_school()); this page shows whether the school is on Brazework, its
// verified clubs (school-links.sql school_clubs()), and what arrives when the school signs up: your
// classes this semester, and class projects your faculty verify. Nothing here is a promise dressed as
// a feature: what's coming says so.
export default function SchoolPage() {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-5xl">
      <Suspense fallback={<><PageHeader title="Your school" /><Skeleton className="mt-6 h-24" /><Skeleton className="mt-4 h-64" /></>}>
        <School />
      </Suspense>
    </div>
  );
}

type Club = { id: string; name: string; member_count: number; verified_at: string | null };

async function School() {
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const mine = (await supabase.rpc("my_school")).data as { domain?: string; school?: string } | null;

  if (!mine?.domain)
    return (
      <>
        <PageHeader title="Your school" subtitle="Your class and club projects, with your school." />
        <div className="mt-6">
          <EmptyState icon={<GraduationCap className="size-6" />} title="Add your school email"
            body="Brazework places you at your school from your university email. Add it in Settings and your school, its clubs and, when it joins, your classes show up here."
            action={<Link href="/settings" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:opacity-90">Open Settings</Link>} />
        </div>
      </>
    );

  const domain = mine.domain;
  const name = mine.school || domain;
  const { schoolLinks } = await dbFeatures();
  const [org, clubsRes] = schoolLinks
    ? await Promise.all([
      supabase.from("organizations").select("id, name, official").eq("type", "school").eq("domain", domain).maybeSingle(),
      supabase.rpc("school_clubs", { p_domain: domain }),
    ])
    : [{ data: null }, { data: [] }];
  const official = (org.data as { official?: boolean } | null)?.official === true;
  const clubs = ((clubsRes.data ?? []) as Club[]);

  return (
    <>
      <PageHeader title={name} subtitle={<span className="inline-flex items-center gap-1.5"><GraduationCap className="size-4" aria-hidden="true" /> {domain}{official ? " · on Brazework" : ""}</span>} />

      {!official && (
        <Panel className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{name} isn&apos;t on Brazework yet</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">You&apos;re already here with your school email, so when your school joins, your record is waiting. Show a professor, your department or your dean what they&apos;d get: it&apos;s free for every student and club.</p>
          </div>
          <Link href="/schools" className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:opacity-90 sm:self-auto">What schools get <ArrowRight className="size-4" aria-hidden="true" /></Link>
        </Panel>
      )}

      <section className="mt-8" aria-labelledby="school-clubs">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="school-clubs"><Kicker>Verified clubs · {clubs.length}</Kicker></h2>
          <Link href="/communities?tab=discover" className="text-sm text-muted hover:text-text">Find a club</Link>
        </div>
        {clubs.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {clubs.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm transition hover:border-line-strong">
                  <span className="inline-flex min-w-0 items-center gap-2"><BadgeCheck className="size-4 shrink-0 text-ok" aria-hidden="true" /><span className="truncate font-medium">{c.name}</span></span>
                  <span className="shrink-0 text-xs text-muted">{c.member_count} {c.member_count === 1 ? "member" : "members"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">No verified clubs yet. A club officer can ask to be verified as one of {name}&apos;s clubs from the club&apos;s Manage page.</p>
        )}
      </section>

      <section className="mt-10" aria-labelledby="school-soon">
        <h2 id="school-soon"><Kicker>{official ? "Coming to your school's portal" : "When your school joins"}</Kicker></h2>
        <ul className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {[
            { icon: BookOpen, title: "Your classes", body: "This semester's classes, each with its projects and groups." },
            { icon: ClipboardCheck, title: "Verified class projects", body: "Your professor verifies the work and each person's part, by class and semester." },
            { icon: Users, title: "Yours after graduation", body: "Move to a personal email when you graduate and keep every project and signature." },
          ].map((x) => (
            <li key={x.title} className="bg-surface p-4">
              <x.icon className="size-4 text-text-2" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">{x.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{x.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-faint"><Mail className="size-3.5" aria-hidden="true" /> Being built with our pilot schools. Class work stays private to the class unless you share it.</p>
      </section>
    </>
  );
}
