import { BadgeCheck, CircleCheck, CircleX, ExternalLink, GitCommitHorizontal, GitMerge, Rocket, Tag, Timer } from "lucide-react";
import Link from "next/link";
import { BuiltWith } from "@/components/projects/built-with";
import { ProjectFiles, type ProjectFileItem } from "@/components/projects/project-files";
import { Kicker } from "@/components/ui";
import { cn, timeAgo, type Post } from "@/lib/forge";
import type { BuildEvent, LogEntry } from "@/lib/build-log";
import { PostCard } from "../../feed/post-card";

// The project page as a live build log (Linear FIX-92): the pieces, kept out of page.tsx.

/** Twelve weeks of building, as bars: a glance at momentum. */
export function ActivityStrip({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  const active = weeks.filter((n) => n > 0).length;
  return (
    <figure className="mt-5">
      <div className="flex h-7 items-end gap-[3px]" role="img" aria-label={`Active ${active} of the last ${weeks.length} weeks`}>
        {weeks.map((n, i) => (
          <span key={i} className={cn("flex-1 rounded-[2px]", n ? "bg-ok/70" : "bg-line")} style={{ height: n ? `${Math.max(35, (n / max) * 100)}%` : "14%" }} title={`${n} ${n === 1 ? "entry" : "entries"}, ${weeks.length - 1 - i === 0 ? "this week" : `${weeks.length - 1 - i} ${weeks.length - 1 - i === 1 ? "week" : "weeks"} ago`}`} />
        ))}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-[11px] text-faint"><span>12 weeks ago</span><span>Active {active} of {weeks.length} weeks</span><span>This week</span></figcaption>
    </figure>
  );
}

/** One timeline, newest first: updates (with what was posted with them), verified milestones, and
 *  what happened on the project's GitHub repo (FIX-92 phase 3). */
export function BuildLogTimeline({ entries, liked, saved, me, projectId, ownerId, filesByPost }: {
  entries: LogEntry<Post>[]; liked: Set<string>; saved: Set<string>; me: string; projectId: string; ownerId: string; filesByPost: Map<string, ProjectFileItem[]>;
}) {
  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-line sm:gap-5">
      {entries.map((e, i) => (
        <li key={e.kind === "post" ? `p-${e.post.id}` : e.kind === "verified" ? `m-${e.milestone.id}` : `g-${e.event.id}`} className="relative pl-9">
          <span aria-hidden="true" className={cn("absolute left-[5px] grid size-[13px] place-items-center rounded-full ring-4 ring-bg", e.kind === "github" ? "top-2 size-[11px] bg-line-strong" : "top-3", e.kind === "verified" ? "bg-ok" : e.kind === "post" && "bg-text/70")} />
          {e.kind === "github" ? (
            <GitHubRow event={e.event} />
          ) : e.kind === "verified" ? (
            <div className="rounded-xl border border-[color-mix(in_oklab,var(--ok)_30%,var(--border))] bg-[color-mix(in_oklab,var(--ok)_6%,var(--surface))] px-4 py-3">
              <p className="flex items-start gap-2 text-sm"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-ok" /><span><span className="font-medium">Verified: {e.milestone.title}</span><span className="block text-xs text-muted">by {e.milestone.reviewer_name || "an officer"}, {e.milestone.community_name} · {timeAgo(new Date(e.at).toISOString())}</span></span></p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <PostCard post={e.post} liked={liked.has(e.post.id)} saved={saved.has(e.post.id)} own={e.post.author_id === me} index={i} />
              {filesByPost.has(e.post.id) && <ProjectFiles projectId={projectId} items={filesByPost.get(e.post.id)!} me={me} ownerId={ownerId} variant="update" />}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** What it is, in one card: the link, the specs, the stack, the write-up. */
export function AboutBuild({ link, specs, tools, uses, details, ember }: { link: string; specs: { label: string; value: string }[]; tools: string[]; uses: Record<string, number>; details: string; ember?: React.ReactNode }) {
  if (!link && !specs.length && !tools.length && !details && !ember) return null;
  const long = details.length > 420;
  return (
    <section aria-label="About this build" className="glass-card rounded-xl p-5">
      <Kicker>About this build</Kicker>
      {link && <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-sm font-medium hover:underline"><ExternalLink className="size-4 shrink-0" /> {new URL(link).host.replace(/^www\./, "")}{new URL(link).pathname.length > 1 ? new URL(link).pathname : ""}</a>}
      {specs.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {specs.map((sp, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface/60 px-3 py-2.5">
              <dt className="truncate text-[11px] text-muted">{sp.label}</dt>
              <dd className="mt-0.5 truncate font-semibold tracking-tight tabular-nums">{sp.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(tools.length > 0 || ember) && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">Built with</p>
          {tools.length > 0 ? <BuiltWith tools={tools} uses={uses} /> : <p className="mt-1 text-sm text-faint">No tools listed yet.</p>}
          {ember}
        </div>
      )}
      {details && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">The write-up</p>
          {long ? (
            <details className="group mt-1">
              <summary className="cursor-pointer list-none text-[15px] leading-relaxed text-text-2 [&::-webkit-details-marker]:hidden"><span className="line-clamp-4 group-open:line-clamp-none whitespace-pre-wrap">{details}</span><span className="mt-1 block text-sm font-medium text-text group-open:hidden">Read it all</span></summary>
            </details>
          ) : <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap text-text-2">{details}</p>}
        </div>
      )}
    </section>
  );
}

/** The 30-second version, for someone hiring. Facts from the page, no AI. */
export function ThirtySeconds({ lines, ownerId }: { lines: string[]; ownerId: string }) {
  return (
    <section aria-label="In 30 seconds" className="glass-card rounded-xl p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.06em] text-faint uppercase"><Timer className="size-3.5" /> In 30 seconds</p>
      <ul className="mt-3 flex flex-col gap-2">
        {lines.map((l) => <li key={l} className="text-sm leading-relaxed text-text-2">{l}</li>)}
      </ul>
      <Link href={`/u/${ownerId}#proof`} className="mt-3 inline-block text-sm font-medium hover:underline">See their verified work →</Link>
    </section>
  );
}

// One line per thing that happened on GitHub: quieter than an update, linked to it on GitHub.
const GITHUB_ICON = { pr_merged: GitMerge, release: Tag, deploy: Rocket, push: GitCommitHorizontal, ci: CircleCheck } as const;
function GitHubRow({ event: g }: { event: BuildEvent }) {
  const Icon = g.kind === "ci" && g.state === "failure" ? CircleX : GITHUB_ICON[g.kind];
  return (
    <a href={g.url} target="_blank" rel="noopener noreferrer nofollow" className="group flex items-start gap-2.5 rounded-lg px-1 py-0.5 text-sm transition hover:bg-hover">
      <Icon className={cn("mt-0.5 size-4 shrink-0", g.kind === "ci" ? (g.state === "failure" ? "text-danger" : "text-ok") : g.kind === "release" ? "text-accent" : "text-muted")} />
      <span className="min-w-0 flex-1">
        <span className="text-text-2 group-hover:text-text">{g.title}</span>
        <span className="block text-xs text-faint">GitHub{g.actor ? ` · ${g.actor}` : ""} · {timeAgo(g.occurred_at)}</span>
      </span>
      <ExternalLink className="mt-1 size-3.5 shrink-0 text-faint opacity-0 transition group-hover:opacity-100" />
    </a>
  );
}
