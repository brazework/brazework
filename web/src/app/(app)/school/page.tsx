import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, BookOpen, ClipboardCheck, Download, GraduationCap, Lock, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton } from "@/components/app/page-ui";
import { Kicker } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { cn, requestTime } from "@/lib/forge";
import { termsAround } from "@/lib/school-roster";
import { getViewer } from "@/lib/supabase/server";
import { CreateClassForm, FacultyForm, RemoveFaculty, RosterForm } from "./portal-forms";

export const metadata: Metadata = { title: "Your school" };

// Your school: the student portal (the school-first realignment, 2026-11-26, docs/strategy.md;
// supabase/school-portal.sql). Your confirmed school email places you at your school. One page, three
// views stacked by what you are:
// - everyone: this semester's classes (rosters join you automatically) and the school's verified clubs;
// - faculty (on the school's own list): start a class, set its roster, see what's waiting to verify;
// - the school's admins: the numbers each office is measured on, the evidence export, the faculty list.
// Until the school has an official account, students see that it isn't on Brazework yet and what it
// would get. Nothing here is a promise dressed as a feature: what's coming says so.
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
type Klass = { id: string; name: string; course: string; term: string; role: string; member_count: number; projects: number; waiting: number };
type Overview = { students: number; faculty: number; classes: number; class_projects: number; verified_in_classes: number; verified_in_clubs: number; clubs: number; active_clubs: number; by_class: { id: string; name: string; term: string; members: number; projects: number; verified: number }[] };
type Faculty = { email: string; name: string; title: string };

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
            body="Brazework places you at your school from your university email. Add it in Settings and your school, its clubs and your classes show up here."
            action={<Link href="/settings" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:opacity-90">Open Settings</Link>} />
        </div>
      </>
    );

  const domain = mine.domain;
  const name = mine.school || domain;
  const { schoolLinks, schoolPortal } = await dbFeatures();
  // Join any class whose roster has your email before reading your classes.
  if (schoolPortal) await supabase.rpc("sync_my_classes");
  const [org, clubsRes, classesRes, facultyRes, runsRes] = await Promise.all([
    schoolLinks ? supabase.from("organizations").select("official").eq("type", "school").eq("domain", domain).maybeSingle() : Promise.resolve({ data: null }),
    schoolLinks ? supabase.rpc("school_clubs", { p_domain: domain }) : Promise.resolve({ data: [] }),
    schoolPortal ? supabase.rpc("my_classes") : Promise.resolve({ data: [] }),
    schoolPortal ? supabase.rpc("is_faculty", { p_domain: domain }) : Promise.resolve({ data: false }),
    schoolPortal ? supabase.rpc("runs_school", { p_domain: domain }) : Promise.resolve({ data: false }),
  ]);
  const official = (org.data as { official?: boolean } | null)?.official === true;
  const clubs = (clubsRes.data ?? []) as Club[];
  const classes = (classesRes.data ?? []) as Klass[];
  const isFaculty = facultyRes.data === true;
  const runs = runsRes.data === true;
  const terms = termsAround(new Date(requestTime()));
  const now = classes.filter((c) => c.term === terms[0]);
  const other = classes.filter((c) => c.term !== terms[0]);
  const teaching = classes.filter((c) => ["owner", "admin", "moderator"].includes(c.role));
  // A student's own standing in each class: what's verified, and what waits on the professor.
  const studying = classes.filter((c) => !["owner", "admin", "moderator"].includes(c.role)).map((c) => c.id);
  const { data: myMs } = studying.length ? await supabase.from("milestones").select("community_id, status").eq("owner_id", user.id).in("community_id", studying).limit(500) : { data: [] };
  const standing = new Map<string, { verified: number; waiting: number }>();
  for (const m of (myMs ?? []) as { community_id: string; status: string }[]) {
    const s = standing.get(m.community_id) ?? { verified: 0, waiting: 0 };
    if (m.status === "verified") s.verified++; else if (m.status === "pending" || m.status === "disputed") s.waiting++;
    standing.set(m.community_id, s);
  }

  const [overviewRes, facultyList] = runs
    ? await Promise.all([supabase.rpc("school_overview", { p_domain: domain }), supabase.from("school_faculty").select("email, name, title").eq("domain", domain).order("name").limit(500)])
    : [{ data: null }, { data: [] }];
  const overview = overviewRes.data as Overview | null;
  const faculty = (facultyList.data ?? []) as Faculty[];

  const role = runs ? "School admin" : isFaculty ? "Faculty" : null;

  return (
    <>
      <PageHeader title={name}
        subtitle={<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"><GraduationCap className="size-4" aria-hidden="true" /> {domain}{official && <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="size-3.5" aria-hidden="true" /> On Brazework</span>}{role && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-text-2">{role}</span>}</span>} />

      {!official && !runs && !isFaculty && (
        <Panel className="mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{name} isn&apos;t on Brazework yet</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">You&apos;re already here with your school email, so when your school joins, your record is waiting. Show a professor, your department or your dean what they&apos;d get: it&apos;s free for every student and club.</p>
          </div>
          <Link href="/schools" className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:opacity-90 sm:self-auto">What schools get <ArrowRight className="size-4" aria-hidden="true" /></Link>
        </Panel>
      )}

      {/* The school's admins: the numbers each office is measured on. */}
      {runs && overview && (
        <section className="mt-8" aria-labelledby="school-numbers">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="school-numbers"><Kicker>Your school on Brazework</Kicker></h2>
            <a href="/school/evidence" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm transition hover:border-line-strong hover:bg-hover"><Download className="size-4" aria-hidden="true" /> Export evidence (CSV)</a>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            {[
              ["Students", overview.students], ["Faculty", overview.faculty], ["Classes", overview.classes], ["Class projects", overview.class_projects],
              ["Verified in classes", overview.verified_in_classes], ["Verified in clubs", overview.verified_in_clubs], ["Verified clubs", overview.clubs], ["Clubs active (30 days)", overview.active_clubs],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-surface p-4">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{(v as number).toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
          {overview.by_class.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th className="px-4 py-2.5 font-medium">Class</th><th className="px-4 py-2.5 font-medium">Term</th><th className="px-4 py-2.5 text-right font-medium">Students</th><th className="px-4 py-2.5 text-right font-medium">Projects</th><th className="px-4 py-2.5 text-right font-medium">Verified</th></tr></thead>
                <tbody>
                  {overview.by_class.map((c) => (
                    <tr key={c.id} className="border-t border-line"><td className="px-4 py-2.5"><Link href={`/c/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td><td className="px-4 py-2.5 text-muted">{c.term}</td><td className="px-4 py-2.5 text-right tabular-nums">{Math.max(0, c.members - 1)}</td><td className="px-4 py-2.5 text-right tabular-nums">{c.projects}</td><td className="px-4 py-2.5 text-right tabular-nums">{c.verified}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-faint">The export lists every verified milestone in your classes and verified clubs: the student, the class or club, the term, who verified it and the evidence. For accreditation (ABET) and your reports.</p>
        </section>
      )}

      {/* Classes: yours this term, then the rest. Faculty start them here. (A school admin who teaches
          nothing doesn't need an empty list.) */}
      {(isFaculty || classes.length > 0 || !runs) && <section className="mt-8" aria-labelledby="school-classes">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="school-classes"><Kicker>{isFaculty ? "Your classes" : `This semester · ${terms[0]}`}</Kicker></h2>
        </div>
        {isFaculty && <div className="mt-3 flex flex-col"><CreateClassForm terms={terms} /></div>}
        {classes.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...now, ...other].map((c) => {
              const teaches = ["owner", "admin", "moderator"].includes(c.role);
              return (
                <li key={c.id} className="glass-card rounded-xl p-4">
                  <Link href={`/c/${c.id}`} className="group flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] text-faint">{c.course} · {c.term}</span>
                      <span className="mt-0.5 block truncate font-medium group-hover:underline">{c.name.replace(/^[^·]+·\s*/, "")}</span>
                    </span>
                    {teaches && c.waiting > 0 && <span className="shrink-0 rounded-full border border-dashed border-wait px-2 py-0.5 text-xs text-text-2">{c.waiting} to verify</span>}
                  </Link>
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted"><span>{Math.max(0, c.member_count - 1)} students</span><span>{c.projects} {c.projects === 1 ? "project" : "projects"}</span>{teaches && <span className="inline-flex items-center gap-1"><Lock className="size-3" aria-hidden="true" /> Private to the class</span>}</p>
                  {!teaches && (() => {
                    const st = standing.get(c.id);
                    return (
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-xs">
                        {st && (st.verified || st.waiting) ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="size-3.5" aria-hidden="true" /> {st.verified} verified</span>
                            {st.waiting > 0 && <span className="inline-flex items-center gap-1 text-text-2"><span aria-hidden="true" className="block size-3 rounded-full border-2 border-dashed border-wait" /> {st.waiting} waiting for your professor</span>}
                          </>
                        ) : <span className="text-muted">Nothing logged yet. Open the class to start your project.</span>}
                      </p>
                    );
                  })()}
                  {teaches && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-muted hover:text-text">Roster</summary>
                      <RosterForm cid={c.id} />
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {isFaculty ? "No classes yet. Start one, paste its roster, and your students are in it with their school email." : official || schoolPortal ? "No classes yet. When your professor adds your class with your school email, it shows up here and you're in it." : "When your school joins, your classes show up here, each with its projects and groups."}
          </p>
        )}
        {teaching.length > 0 && <p className="mt-2 text-xs text-faint">Students log milestones on their class projects; you verify the work and each person&apos;s part from the class page. Verified work shows on their record with the class and the term.</p>}
      </section>}

      {/* The school's verified clubs. */}
      <section className="mt-10" aria-labelledby="school-clubs">
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

      {/* The school's admins keep the faculty list: only people on it can start a class. */}
      {runs && (
        <section className="mt-10" aria-labelledby="school-faculty">
          <h2 id="school-faculty"><Kicker>Faculty · {faculty.length}</Kicker></h2>
          <p className="mt-1 text-xs text-faint">Only people on this list, signed in with that school email, can start a class and verify its projects. Anyone else with a school email can&apos;t.</p>
          <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <FacultyForm domain={domain} />
            <ul className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface text-sm">
              {faculty.map((f) => (
                <li key={f.email} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0"><span className="block truncate font-medium">{f.name || f.email}</span><span className="block truncate text-xs text-muted">{f.title ? `${f.title} · ` : ""}{f.email}</span></span>
                  <RemoveFaculty domain={domain} email={f.email} />
                </li>
              ))}
              {!faculty.length && <li className="px-4 py-6 text-center text-muted">No faculty yet. Paste or upload the list.</li>}
            </ul>
          </div>
        </section>
      )}

      {/* What the portal is, for a student whose school hasn't joined: what to expect. */}
      {!official && !runs && !isFaculty && classes.length === 0 && (
        <section className="mt-10" aria-labelledby="school-soon">
          <h2 id="school-soon"><Kicker>When your school joins</Kicker></h2>
          <ul className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            {[
              { icon: BookOpen, title: "Your classes", body: "This semester's classes, each with its projects and groups." },
              { icon: ClipboardCheck, title: "Verified class projects", body: "Your professor verifies the work and each person's part, by class and term." },
              { icon: Users, title: "Yours after graduation", body: "Move to a personal email when you graduate and keep every project and signature." },
            ].map((x) => (
              <li key={x.title} className="bg-surface p-4">
                <x.icon className="size-4 text-text-2" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">{x.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{x.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={cn("mt-10 inline-flex items-center gap-1.5 text-xs text-faint")}><ShieldCheck className="size-3.5" aria-hidden="true" /> Class work stays private to the class unless you share it. Grades never live on Brazework.</p>
    </>
  );
}
