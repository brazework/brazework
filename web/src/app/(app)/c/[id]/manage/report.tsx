import { ArrowDown, ArrowUp, BadgeCheck, CalendarDays, Heart, MessageSquare, Minus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { CountUp } from "@/components/app/count-up";
import type { ClubReport } from "@/lib/club-report";
import { ClubUpdate } from "./report-client";

// Manage → Report: this week in the club at a glance, and a weekly update to post.
export function ReportView({ r, clubId, copilot }: { r: ClubReport; clubId: string; copilot: boolean }) {
  const delta = r.posts.thisWeek - r.posts.lastWeek;
  const Trend = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const card = "rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)]";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={card}>
          <div className="flex items-center gap-1.5 text-xs text-muted"><Users className="size-3.5" /> Members</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight"><CountUp to={r.members} /></div>
          <div className="mt-1 text-xs text-ok">{r.newMembers ? `+${r.newMembers} this week` : <span className="text-faint">No new members this week</span>}</div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-1.5 text-xs text-muted"><MessageSquare className="size-3.5" /> Posts this week</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight"><CountUp to={r.posts.thisWeek} /></div>
          <div className={`mt-1 inline-flex items-center gap-1 text-xs ${delta > 0 ? "text-ok" : delta < 0 ? "text-danger" : "text-faint"}`}><Trend className="size-3.5" /> {delta === 0 ? "Same as" : `${Math.abs(delta)} ${delta > 0 ? "more than" : "fewer than"}`} last week</div>
        </div>
        {r.milestones && (
          <div className={card}>
            <div className="flex items-center gap-1.5 text-xs text-muted"><BadgeCheck className="size-3.5" /> Verified this week</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight"><CountUp to={r.milestones.verifiedThisWeek} /></div>
            <Link href={`/c/${clubId}/manage?tab=verify`} className="mt-1 block text-xs text-muted hover:text-text">{r.milestones.waiting ? `${r.milestones.waiting} waiting${r.milestones.oldestWaitingDays ? `, oldest ${r.milestones.oldestWaitingDays}d` : ""} →` : "Queue is clear"}</Link>
          </div>
        )}
        <div className={card}>
          <div className="flex items-center gap-1.5 text-xs text-muted"><UserPlus className="size-3.5" /> Join requests</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight"><CountUp to={r.joinRequests} /></div>
          <Link href={`/c/${clubId}/manage?tab=requests`} className="mt-1 block text-xs text-muted hover:text-text">{r.joinRequests ? "Review them →" : "None waiting"}</Link>
        </div>
      </div>

      <ClubUpdate report={r} clubId={clubId} copilot={copilot} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h3 className="text-sm font-semibold">Top post this week</h3>
          {r.topPost ? (
            <Link href={`/post/${r.topPost.id}`} className="mt-3 block rounded-2xl bg-surface-2/60 p-3 transition hover:bg-hover">
              <p className="line-clamp-3 text-sm text-text-2">{r.topPost.body}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted"><span>{r.topPost.author}</span><span className="inline-flex items-center gap-1"><Heart className="size-3" /> {r.topPost.likes}</span><span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {r.topPost.comments}</span></div>
            </Link>
          ) : <p className="mt-2 text-sm text-muted">No posts this week yet. A weekly update is a good first one.</p>}
          {r.topPosters.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">Most active</h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">{r.topPosters.map((p) => <li key={p.name} className="flex justify-between"><span>{p.name}</span><span className="text-muted">{p.posts} post{p.posts === 1 ? "" : "s"}</span></li>)}</ul>
            </>
          )}
        </section>
        <section className={card}>
          <h3 className="text-sm font-semibold">Coming up (next 2 weeks)</h3>
          {r.upcoming.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {r.upcoming.map((e) => (
                <li key={e.id}><Link href={`/events/${e.id}`} className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-hover"><CalendarDays className="size-4 shrink-0 text-muted" /><span className="min-w-0 flex-1 truncate text-sm">{e.title}</span><span className="shrink-0 text-xs text-muted">{e.going} going</span></Link></li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">Nothing scheduled. Build nights bring members back.</p>}
          {r.newMemberNames.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">New this week</h3>
              <p className="mt-2 text-sm text-text-2">{r.newMemberNames.join(", ")}{r.newMembers > r.newMemberNames.length ? ` and ${r.newMembers - r.newMemberNames.length} more` : ""}</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
