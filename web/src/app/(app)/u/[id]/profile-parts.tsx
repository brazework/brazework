import { ArrowRight, BadgeCheck, Check, Users } from "lucide-react";
import Link from "next/link";
import { ProStamp, Seal, VerifiedStamp, VouchStamp } from "@/components/app/verified-seal";
import { CommunityBadge } from "../../communities/_components/badge";
import { DismissButton } from "@/components/app/dismiss";
import { cn } from "@/lib/forge";

// Pieces of the profile page that need no state: profile strength (your own profile), the proof
// timeline, what you share with this person, and the small titled cards in the sidebar.

export function SideCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card rounded-3xl p-5", className)}>
      <h2 className="text-xs font-medium tracking-wide text-faint uppercase">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export type Step = { done: boolean; label: string; href: string };

// How complete your profile is, and the next things to do (only you see this).
export function ProfileStrength({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);
  const next = steps.filter((s) => !s.done).slice(0, 3);
  return (
    <section aria-label="Profile strength" className="glass-card rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Profile strength</h2>
          <p className="text-sm text-muted">{pct < 50 ? "A few steps and clubs and recruiters will see what you can do." : "Almost there. Proof is what gets you noticed."}</p>
        </div>
        <span className="flex items-center gap-1"><span className="text-2xl font-semibold tabular-nums">{pct}%</span><DismissButton id="profile-strength" label="Hide profile strength" className="-mr-2" /></span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile strength">
        <div className="bg-accent-grad h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {next.map((s) => (
          <li key={s.label}>
            <a href={s.href} className="group flex h-full items-center justify-between gap-2 rounded-2xl border border-line bg-surface/70 px-3 py-2.5 text-sm transition hover:border-line-strong">
              {s.label} <ArrowRight className="size-3.5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-text" />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><Check className="size-3.5" /> {done} of {steps.length} done</p>
    </section>
  );
}

export type ProofItem = { id: string; title: string; detail: string; achieved_on: string; community_id: string | null; community_name: string; reviewer_name: string; vouched_by?: string; project: { id: string; title: string }; pro?: { name: string; title: string; employer: string; note: string; at: string }[] };

// Club-verified milestones, newest first: the strongest thing on a profile.
export function ProofTimeline({ items, own }: { items: ProofItem[]; own: boolean }) {
  if (!items.length)
    return own ? (
      <section className="rounded-3xl border border-dashed border-line-strong p-5">
        <h2 className="flex items-center gap-2 font-semibold"><BadgeCheck className="size-4" /> Proof</h2>
        <p className="mt-1 text-sm text-muted">Hit a milestone on a project? Ask your club to verify it, and it shows here with their name on it.</p>
        <a href="#projects" className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">Open your projects <ArrowRight className="size-3.5" /></a>
      </section>
    ) : null;
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return (
    <section aria-label="Club-verified work" className="glass-card rounded-3xl p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Seal size={20} /> Proof <span className="text-sm font-normal text-muted">· signed by people who saw it</span></h2>
      <ol className="relative mt-4 space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
        {items.slice(0, 6).map((m) => (
          <li key={m.id} className="relative flex gap-3">
            {m.community_id ? <CommunityBadge id={m.community_id} name={m.community_name} size={32} className="relative shrink-0 rounded-full ring-4 ring-surface" /> : <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 ring-4 ring-surface"><Seal size={18} /></span>}
            <div className="min-w-0">
              <p className="font-medium leading-snug">{m.title}</p>
              {m.pro?.map((r) => <ProStamp key={r.name + r.at} name={r.name} title={r.title} employer={r.employer} note={r.note} className="mt-1.5" />)}
              <p className="mt-1">{m.vouched_by ? <VouchStamp by={m.vouched_by} when={day(m.achieved_on)} /> : <VerifiedStamp club={m.community_name} clubId={m.community_id ?? undefined} by={m.reviewer_name} when={day(m.achieved_on)} size="sm" />}</p>
              <p className="mt-1 text-xs text-muted">On <Link href={`/projects/${m.project.id}`} className="hover:text-text hover:underline">{m.project.title}</Link></p>
              {m.detail && <p className="mt-1 line-clamp-2 text-sm text-text-2">{m.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      {items.length > 6 && <a href="#projects" className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline">All {items.length} on their projects <ArrowRight className="size-3.5" /></a>}
    </section>
  );
}

// For visitors: what you have in common (clubs you're both in, people you follow who follow them).
export function SharedContext({ clubs, mutual, mutualCount }: { clubs: { id: string; name: string }[]; mutual: string[]; mutualCount: number }) {
  if (!clubs.length && !mutualCount) return null;
  return (
    <p className="glass-card flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl px-4 py-3 text-sm text-text-2">
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
