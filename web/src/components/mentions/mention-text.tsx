import Link from "next/link";
import { hashtagParts } from "@/lib/hashtags";
import { mentionParts, type Mention } from "@/lib/mention-text";

// Post text with each @mention linked to that person's profile, "@Project title" (the post's own
// project) linked to the project, and each #tag, in the tag colour, linked to the feed for that tag.
// Given the post's tags, only those count (a 4th #tag stays text).
export function MentionText({ body, mentions, tags, project }: { body: string; mentions?: Mention[] | null; tags?: string[]; project?: { id: string; title: string } | null }) {
  const projectRef = project ? { id: `project:${project.id}`, name: project.title } : null;
  const list = [...(Array.isArray(mentions) ? mentions : []), ...(projectRef ? [projectRef] : [])];
  return (
    <>
      {mentionParts(body, list).map((p, i) =>
        typeof p === "string"
          ? hashtagParts(p).map((h, j) => typeof h === "string" ? h : tags && !tags.includes(h.tag) ? h.written : <Link prefetch={false} key={`${i}-${j}`} href={`/feed?tag=${encodeURIComponent(h.tag)}`} className="font-medium text-[var(--tag)] hover:underline">{h.written}</Link>)
          : <Link prefetch={false} key={i} href={p === projectRef ? `/projects/${project!.id}` : `/u/${p.id}`} className="font-medium text-text hover:underline">@{p.name}</Link>)}
    </>
  );
}
