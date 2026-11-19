import type { Metadata } from "next";
import { SeatsLine } from "./seats-line";
import { BadgeCheck, Building2, GitMerge, Search, Send, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, PageHeader, Panel, Skeleton, chipCls } from "@/components/app/page-ui";
import { Avatar, Button } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { OPEN_TO, classOf, openToLabel } from "@/lib/profile-meta";
import { getViewer } from "@/lib/supabase/server";
import { buildBuilders, classYears, rankBuilders, type Person, type VerifiedRow } from "@/lib/talent";
import { GOAL_KINDS, goalTitle, isGoalKind, type GoalKind } from "@/lib/goals";

export const metadata: Metadata = { title: "Find builders" };

export default function TalentPage({ searchParams }: PageProps<"/talent">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-5xl">
      <Suspense fallback={<><PageHeader title="Find builders" /><Skeleton className="mt-6 h-96" /></>}>
        <Talent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const MINS = [1, 3, 5] as const;

async function Talent({ searchParams }: { searchParams: PageProps<"/talent">["searchParams"] }) {
  const sp = await searchParams;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  const f = await dbFeatures();

  // Search is for verified companies and schools; everyone else is shown how to get there.
  const { data: admin } = await supabase.from("organization_admins").select("organizations(name, verification_status)").eq("uid", user.id).limit(1);
  const org = (admin?.[0] as unknown as { organizations: { name: string; verification_status: string } | null } | undefined)?.organizations;
  if (!org || org.verification_status !== "verified") {
    return (
      <>
        <PageHeader title="Find builders" subtitle="Search people by work their clubs verified, not by keywords they wrote about themselves." />
        <Panel className="mt-6 flex flex-col items-start gap-4 p-6">
          <span className="bg-text grid size-12 place-items-center rounded-2xl text-surface"><Building2 className="size-5" /></span>
          <div>
            <h2 className="text-lg font-semibold">For verified companies and schools</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">Register your organization with a work email on its domain. Then search members by verified projects, the clubs that vouched for them and what they&apos;re open to. Messages you send land in their Requests, so they choose whether to reply.</p>
          </div>
          <Button href="/org">Register your organization</Button>
        </Panel>
      </>
    );
  }

  const q = typeof sp.q === "string" ? sp.q.slice(0, 120) : "";
  const club = typeof sp.club === "string" ? sp.club : "";
  const openTo = typeof sp.open === "string" && OPEN_TO.some((o) => o.id === sp.open) ? sp.open : "";
  const min = MINS.find((m) => String(m) === sp.min) ?? 1;
  const year = f.gradYear && typeof sp.year === "string" && /^\d{4}$/.test(sp.year) ? Number(sp.year) : 0;
  // "Signed or backed" (FIX-121): also logged work GitHub backs, labelled as such. Signed only by default.
  const backedOn = f.backed && sp.level === "backed";

  // Only verified work the member made public (the database enforces this for everyone).
  let mq = supabase.from("milestones")
    .select(`id, owner_id, community_id, community_name, title, reviewer_name, reviewed_at${f.verification ? ", reviewer_role" : ""}, projects(title, tags, tools)`)
    .eq("status", "verified").order("reviewed_at", { ascending: false }).limit(1000);
  if (f.verification) mq = mq.eq("private", false);
  const { data: rowsData } = await mq;
  let rows = (rowsData ?? []) as unknown as VerifiedRow[];
  if (backedOn) {
    // Readable only while the member shows it and the project can be seen (supabase/backed.sql).
    const { data: backedData } = await supabase.from("milestones")
      .select("id, owner_id, community_id, community_name, title, reviewer_name, reviewed_at, projects(title, tags, tools), milestone_backings!inner(kind, repo_full_name, ref)")
      .eq("status", "logged").eq("private", false).limit(1000);
    const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
    rows = [...rows, ...((backedData ?? []) as unknown as (VerifiedRow & { milestone_backings: VerifiedRow["backing"] | VerifiedRow["backing"][] })[]).map((r) => ({ ...r, backed: true, backing: one(r.milestone_backings) }))];
  }
  const ids = [...new Set(rows.map((r) => r.owner_id))];
  const { data: peopleData } = ids.length
    ? await supabase.from("profiles").select(`id, first_name, last_name, headline, field${f.profileExtras ? ", open_to" : ""}${f.gradYear ? ", grad_year" : ""}`).in("id", ids)
    : { data: [] };
  const all = buildBuilders(rows, (peopleData ?? []) as unknown as Person[]);
  // Goals (supabase/goals.sql): what each person is working toward, when they've made it visible, and
  // a filter by it ("Working toward grad school").
  const goalKind = isGoalKind(sp.goal) ? sp.goal : "";
  const { data: goalRows } = f.goals && ids.length ? await supabase.from("member_goals").select("uid, kind, target").in("uid", ids).eq("status", "active") : { data: [] };
  const goals = new Map(((goalRows ?? []) as { uid: string; kind: GoalKind; target: string }[]).filter((g) => isGoalKind(g.kind)).map((g) => [g.uid, g]));
  const list = rankBuilders(all, { q, club, openTo, min, year, backed: backedOn }).filter((b) => !goalKind || goals.get(b.person.id)?.kind === goalKind);
  // Class-year chips: the years present among everyone else's filters, so a chip never leads nowhere.
  const years = classYears(rankBuilders(all, { q, club, openTo, min, backed: backedOn }));
  // Challenge wins (public once announced) next to the verified work.
  const shownIds = list.slice(0, 60).map((b) => b.person.id);
  const { data: winRows } = f.challenges && shownIds.length
    ? await supabase.from("challenge_entries").select("uid, placement, challenges(status, organizations(name))").in("uid", shownIds).not("placement", "is", null).limit(300)
    : { data: [] };
  const wins = new Map<string, string[]>();
  for (const w of (winRows ?? []) as unknown as { uid: string; placement: number; challenges: { status: string; organizations: { name: string } | null } | null }[]) {
    if (w.challenges?.status !== "closed") continue;
    wins.set(w.uid, [...(wins.get(w.uid) ?? []), `${["1st", "2nd", "3rd"][w.placement - 1]} · ${w.challenges.organizations?.name ?? "Sponsor"}`]);
  }
  const clubs = [...new Map(all.flatMap((b) => b.clubs).map((c) => [c.id, c])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const href = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(club && { club }), ...(openTo && { open: openTo }), ...(min > 1 && { min: String(min) }), ...(year && { year: String(year) }), ...(goalKind && { goal: goalKind }), ...(backedOn && { level: "backed" }), ...o });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/talent${p.size ? `?${p}` : ""}`;
  };
  // The two pieces of work on each card: what matches the search first, then the rest (signed before
  // backed). Without this, a match further down someone's record would be found but not shown.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (r: VerifiedRow) => words.length > 0 && words.some((w) => `${r.title} ${r.projects?.title ?? ""}`.toLowerCase().includes(w));
  const cardWork = (b: (typeof list)[number]) => [...b.latest.filter((r) => backedOn || !r.backed)].sort((x, y) => Number(hit(y)) - Number(hit(x)));
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition ${on ? "border-text text-text" : "border-line text-muted hover:text-text"}`;

  return (
    <>
      <PageHeader
        title="Find builders"
        subtitle={<>Searching as {org.name}. Every result has work a club officer verified, with who vouched and when.</>}
      />
      <form action="/talent" className="mt-6 flex items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-line-strong">
        <Search className="size-4 shrink-0 text-faint" />
        <input name="q" defaultValue={q} placeholder="Skills or work: STM32, CAD, thermal model, PCB…" aria-label="Search verified work" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
        {club && <input type="hidden" name="club" value={club} />}
        {openTo && <input type="hidden" name="open" value={openTo} />}
        {min > 1 && <input type="hidden" name="min" value={min} />}
        {!!year && <input type="hidden" name="year" value={year} />}
        {backedOn && <input type="hidden" name="level" value="backed" />}
        <button className="h-8 rounded-lg bg-accent px-3 text-xs font-medium text-on-accent">Search</button>
      </form>
      {f.money && <SeatsLine paid={sp.seats === "1"} />}
      {/* Filter rows: on a phone each scrolls sideways and fades at the edge (it clipped mid-word with no cue);
          wider screens wrap. */}
      {f.backed && (
        <div className="mt-3 no-scrollbar flex gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(90deg,#000_85%,transparent)] sm:flex-wrap sm:overflow-visible sm:pr-0 sm:[mask-image:none]" aria-label="Proof">
          <Link href={href({ level: "" })} className={chip(!backedOn)}>Signed only</Link>
          <Link href={href({ level: "backed" })} className={chip(backedOn)}>Signed or backed by GitHub</Link>
        </div>
      )}
      <div className="mt-2 no-scrollbar flex gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(90deg,#000_85%,transparent)] sm:flex-wrap sm:overflow-visible sm:pr-0 sm:[mask-image:none]" aria-label="Open to">
        <Link href={href({ open: "" })} className={chip(!openTo)}>Anyone</Link>
        {OPEN_TO.map((o) => <Link key={o.id} href={href({ open: o.id })} className={chip(openTo === o.id)}>Open to {o.label.toLowerCase()}</Link>)}
      </div>
      {f.goals && (
        <div className="mt-2 no-scrollbar flex gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(90deg,#000_85%,transparent)] sm:flex-wrap sm:overflow-visible sm:pr-0 sm:[mask-image:none]" aria-label="Working toward">
          <Link href={href({ goal: "" })} className={chip(!goalKind)}>Any goal</Link>
          {(Object.keys(GOAL_KINDS) as GoalKind[]).map((k) => <Link key={k} href={href({ goal: k })} className={chip(goalKind === k)}>Working toward {GOAL_KINDS[k].label.toLowerCase()}</Link>)}
        </div>
      )}
      <div className="mt-2 no-scrollbar flex gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(90deg,#000_85%,transparent)] sm:flex-wrap sm:overflow-visible sm:pr-0 sm:[mask-image:none]" aria-label="Clubs and verified count">
        {MINS.map((m) => <Link key={m} href={href({ min: m > 1 ? String(m) : "" })} className={chip(min === m)}>{m}+ verified</Link>)}
        {clubs.length > 1 && <span className="mx-1 w-px shrink-0 bg-line" />}
        {clubs.length > 1 && clubs.map((c) => <Link key={c.id} href={href({ club: club === c.id ? "" : c.id })} className={chip(club === c.id)}>{c.name}</Link>)}
      </div>

      {(years.length > 0 || !!year) && (
        <div className="mt-2 no-scrollbar flex gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(90deg,#000_85%,transparent)] sm:flex-wrap sm:overflow-visible sm:pr-0 sm:[mask-image:none]" aria-label="Class year">
          <Link href={href({ year: "" })} className={chip(!year)}>Any year</Link>
          {years.map((y) => <Link key={y} href={href({ year: year === y ? "" : String(y) })} className={chip(year === y)}>{classOf(y)}</Link>)}
        </div>
      )}

      <p className="mt-6 text-xs text-faint">{list.length} {list.length === 1 ? "person" : "people"} with {backedOn ? "verified or backed" : "verified"} work{q ? ` matching "${q}"` : ""}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        {list.slice(0, 60).map((b) => {
          const name = `${b.person.first_name} ${b.person.last_name}`.trim() || "Brazework member";
          return (
            <article key={b.person.id} className="border border-line bg-surface flex min-w-0 flex-col gap-3 rounded-2xl p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Avatar first={b.person.first_name} last={b.person.last_name} size={44} />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${b.person.id}`} className="block truncate font-semibold hover:underline">{name}</Link>
                  <p className="truncate text-sm text-muted">{b.person.headline || b.person.field || "Builder"}{b.person.grad_year ? ` · ${classOf(b.person.grad_year)}` : ""}</p>
                  {goals.get(b.person.id) ? <p className="mt-0.5 truncate text-xs text-text-2">Working toward {goalTitle(goals.get(b.person.id)!)}</p>
                    : !!b.person.open_to?.length && <p className="mt-0.5 truncate text-xs text-text-2">Open to {b.person.open_to.map(openToLabel).join(", ").toLowerCase()}</p>}
                </div>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {b.verified > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-ok/12 px-2.5 py-1 text-xs font-medium text-ok"><BadgeCheck className="size-3.5" /> {b.verified}<span className="hidden sm:inline"> verified</span></span>}
                  {backedOn && b.backed > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-info/12 px-2.5 py-1 text-xs font-medium text-info"><GitMerge className="size-3.5" /> {b.backed}<span className="hidden sm:inline"> backed</span></span>}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {cardWork(b).slice(0, 2).map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line bg-surface px-3 py-2 text-sm">
                    <span className="block truncate font-medium">{r.title}</span>
                    {r.backed
                      ? <span className="block truncate text-xs text-info">Backed by GitHub{r.backing ? ` · ${r.backing.kind === "commit" ? `commit ${r.backing.ref.slice(0, 7)}` : r.backing.kind === "pull_request" ? `PR #${r.backing.ref}` : `release ${r.backing.ref}`} in ${r.backing.repo_full_name}` : ""} · not signed</span>
                      : <span className="block truncate text-xs text-faint">Verified by {r.reviewer_name || "an officer"}{r.reviewer_role ? ` (${r.reviewer_role})` : ""}, {r.community_name}{r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""}</span>}
                  </li>
                ))}
              </ul>
              {wins.has(b.person.id) && <div className="flex flex-wrap gap-1">{wins.get(b.person.id)!.slice(0, 2).map((w) => <span key={w} className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-medium"><Trophy className="size-3" /> {w} challenge</span>)}</div>}
              {b.skills.length > 0 && <div className="flex flex-wrap gap-1">{b.skills.slice(0, 6).map((s) => <span key={s} className={chipCls}>{s}</span>)}</div>}
              <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-faint">
                <span className="inline-flex min-w-0 flex-1 items-center gap-1 truncate"><UsersRound className="size-3.5 shrink-0" /> <span className="truncate">{b.clubs.map((c) => c.name).join(", ")}</span></span>
                <Link href={`/messages/new?to=${b.person.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-sm text-text transition hover:border-line-strong hover:bg-hover"><Send className="size-3.5" /> Message</Link>
              </div>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <EmptyState
          icon={<Search className="size-5" />}
          title={all.length ? "No one matches that yet" : "No public verified work yet"}
          body={all.length ? "Try fewer words, or clear a filter." : "As clubs verify their members' milestones and members make them public, they show up here."}
          action={all.length ? <Button href="/talent" variant="outline">Clear search</Button> : undefined}
        />
      )}
    </>
  );
}
