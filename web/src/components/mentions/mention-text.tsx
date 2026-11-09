import Link from "next/link";
import { mentionParts, type Mention } from "@/lib/mention-text";

// Post text with each @mention linked to that person's profile.
export function MentionText({ body, mentions }: { body: string; mentions?: Mention[] | null }) {
  return (
    <>
      {mentionParts(body, mentions).map((p, i) =>
        typeof p === "string" ? p : <Link key={i} href={`/u/${p.id}`} className="font-medium text-text hover:underline">@{p.name}</Link>)}
    </>
  );
}
