import { ArrowRight, BadgeCheck, ChevronDown, Users } from "lucide-react";
import Link from "next/link";
import { ProStamp, Seal, VerifiedStamp, VouchStamp } from "@/components/app/verified-seal";
import { CommunityBadge } from "../../communities/_components/badge";
import { DismissButton } from "@/components/app/dismiss";
import { cn } from "@/lib/forge";
import { confirmedBy, ledTitle, type StudyProof } from "@/lib/study";

// Pieces of the profile page that need no state: profile strength (your own profile), the proof
// timeline, what you share with this person, and the small titled cards in the sidebar.

export function SideCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border border-line bg-surface rounded-2xl p-5", className)}>
      <h2 className="text-xs font-medium text-muted">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export type Step = { done: boolean; label: string; href: string };

// How complete your profile is, and the one next thing to do (only you see this). One slim line
// (profile redesign, Nov 19): the record and the timeline lead the page; this only nudges.
export function ProfileStrength({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);
  const todo = steps.filter((s) => !s.done);
  return (
    <section aria-label="Profile strength" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3">
      <span className="flex items-center gap-2.5">
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile strength">
          <span className="block h-full rounded-full bg-text" style={{ width: `${pct}%` }} />
        </span>
      </span>
      <p className="min-w-0 flex-1 text-sm text-muted">
        Next: <a href={todo[0].href} className="group inline-flex items-center gap-1 font-medium text-text hover:underline">{todo[0].label} <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></a>
        {todo.length > 1 && <span className="text-faint"> · {todo.length - 1} more</span>}
      </p>
      <DismissButton id="profile-strength" label="Hide profile strength" className="-mr-2" />
    </section>
  );
}

export type ProofItem = { id: string; title: string; detail: string; achieved_on: string; community_id: string | null; community_name: string; reviewer_name: string; vouched_by?: string; project: { id: string; title: string }; pro?: { name: string; title: string; employer: string; note: string; at: string }[] };

// Club-verified milestones, newest first: the strongest thing on a profile.
// `led`: study groups they led, as their members confirmed (supabase/study-groups.sql), after the work.
export function ProofTimeline({ items, own, led = [] }: { items: ProofItem[]; own: boolean; led?: StudyProof[] }) {
  if (!items.length && !led.length)
    return own ? (
      <section className="rounded-2xl border border-dashed border-line-strong p-5">
        <h2 className="flex items-center gap-2 font-semibold"><BadgeCheck className="size-4" /> Proof</h2>
        <p className="mt-1 text-sm text-muted">Hit a milestone on a project? Ask someone who saw it to sign it (your club, a professor, a manager), and it shows here with their name on it.</p>
        <a href="#projects" className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">Open your projects <ArrowRight className="size-3.5" /></a>
      </section>
    ) : null;
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <section aria-label="Club-verified work" className="border border-line bg-surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Seal size={20} /> Proof <span className="text-sm font-normal text-muted">· signed by people who saw it</span></h2>
      <ol className="relative mt-4 space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
        {items.slice(0, SHOWN).map((m) => <ProofRow key={m.id} m={m} day={day} />)}
        {led.slice(0, 4).map((s) => (
          <li key={`study-${s.community_id}`} className="relative flex gap-3">
            <CommunityBadge id={s.community_id} name={s.name} size={32} className="relative shrink-0 rounded-full ring-4 ring-surface" />
            <div className="min-w-0">
              <p className="font-medium leading-snug">{ledTitle(s)}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-ok"><BadgeCheck className="size-3.5" /> {confirmedBy(s.n)}{s.term ? ` · ${s.term}` : ""}</p>
              <p className="mt-1 text-xs text-muted">In <Link href={`/c/${s.community_id}`} className="hover:text-text hover:underline">{s.name}</Link></p>
            </div>
          </li>
        ))}
      </ol>
      {/* The rest fold away, so the projects below stay near the top of the page. A plain <details>: it
          opens without the page's script, and the browser's find-in-page opens it too. */}
      {items.length > SHOWN && (
        <details className="group mt-4">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-text-2 transition hover:border-line-strong hover:text-text [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show {items.length - SHOWN} more</span><span className="hidden group-open:inline">Show fewer</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ol className="relative mt-5 space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
            {items.slice(SHOWN).map((m) => <ProofRow key={m.id} m={m} day={day} />)}
          </ol>
        </details>
      )}
    </section>
  );
}

// Signed work shown before "Show more"; the rest fold away (ProofTimeline).
const SHOWN = 3;

// One signed result in the proof list: who signed it, when, and on which project.
function ProofRow({ m, day }: { m: ProofItem; day: (d: string) => string }) {
  return (
    <li className="relative flex gap-3">
      {m.community_id ? <CommunityBadge id={m.community_id} name={m.community_name} size={32} className="relative shrink-0 rounded-full ring-4 ring-surface" /> : <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 ring-4 ring-surface"><Seal size={18} /></span>}
      <div className="min-w-0">
        <p className="font-medium leading-snug">{m.title}</p>
        {m.pro?.map((r) => <ProStamp key={r.name + r.at} name={r.name} title={r.title} employer={r.employer} note={r.note} className="mt-1.5" />)}
        <p className="mt-1">{m.vouched_by ? <VouchStamp by={m.vouched_by} when={day(m.achieved_on)} /> : <VerifiedStamp club={m.community_name} clubId={m.community_id ?? undefined} by={m.reviewer_name} when={day(m.achieved_on)} size="sm" />}</p>
        <p className="mt-1 text-xs text-muted">On <Link href={`/projects/${m.project.id}`} className="hover:text-text hover:underline">{m.project.title}</Link></p>
        {m.detail && <p className="mt-1 line-clamp-2 text-sm text-text-2">{m.detail}</p>}
      </div>
    </li>
  );
}

// For visitors: what you have in common (clubs you're both in, people you follow who follow them).
export function SharedContext({ clubs, mutual, mutualCount }: { clubs: { id: string; name: string }[]; mutual: string[]; mutualCount: number }) {
  if (!clubs.length && !mutualCount) return null;
  return (
    <p className="border border-line bg-surface flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl px-4 py-3 text-sm text-text-2">
      <Users className="size-4 shrink-0 text-faint" />
      {clubs.length > 0 && <span>You&apos;re both in {clubs.slice(0, 2).map((c, i) => <span key={c.id}>{i > 0 && " and "}<Link href={`/c/${c.id}`} className="font-medium text-text hover:underline">{c.name}</Link></span>)}{clubs.length > 2 && ` and ${clubs.length - 2} more`}.</span>}
      {mutualCount > 0 && <span>{followedBy(mutual.filter(Boolean).slice(0, 2), mutualCount)}</span>}
    </p>
  );
}

// "Followed by Maya and Ben, who you follow." / "Followed by Maya, Ben and 3 others you follow."
export function followedBy(names: string[], total: number) {
  if (!names.length) return `Followed by ${total} ${total === 1 ? "person" : "people"} you follow.`;
  const rest = total - names.length;
  if (rest <= 0) return `Followed by ${names.join(" and ")}, who you follow.`;
  return `Followed by ${names.join(", ")} and ${rest} ${rest === 1 ? "other" : "others"} you follow.`;
}
