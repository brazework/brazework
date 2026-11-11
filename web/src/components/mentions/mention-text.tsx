import Link from "next/link";
import { hashtagParts } from "@/lib/hashtags";
import { mentionParts, type Mention } from "@/lib/mention-text";

// Post text with each @mention linked to that person's profile and each #tag, in the tag colour,
// linked to the feed for that tag. Given the post's tags, only those count (a 4th #tag stays text).
export function MentionText({ body, mentions, tags }: { body: string; mentions?: Mention[] | null; tags?: string[] }) {
  return (
    <>
      {mentionParts(body, mentions).map((p, i) =>
        typeof p === "string"
          ? hashtagParts(p).map((h, j) => typeof h === "string" ? h : tags && !tags.includes(h.tag) ? h.written : <Link key={`${i}-${j}`} href={`/feed?tag=${encodeURIComponent(h.tag)}`} className="font-medium text-[var(--tag)] hover:underline">{h.written}</Link>)
          : <Link key={i} href={`/u/${p.id}`} className="font-medium text-text hover:underline">@{p.name}</Link>)}
    </>
  );
}
