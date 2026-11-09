"use client";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/forge";
import { postPreview } from "@/lib/share";

type Preview = Awaited<ReturnType<typeof postPreview>>;
const POST_LINK = /(?:^|\s)\/post\/([A-Za-z0-9-]{1,64})(?=\s|$)/;
// One lookup per post per page, shared by every bubble that shows it.
const cache = new Map<string, Promise<Preview>>();

// A message's text, with a shared post (its /post/<id> link) shown as a preview card under it.
export function MessageBody({ body, mine = false }: { body: string; mine?: boolean }) {
  const m = body.match(POST_LINK);
  if (!m) return <>{body}</>;
  const text = body.replace(m[0], "").trim();
  return (
    <>
      {text && <span className="block">{text}</span>}
      <SharedPost id={m[1]} mine={mine} spaced={!!text} />
    </>
  );
}

function SharedPost({ id, mine, spaced }: { id: string; mine: boolean; spaced: boolean }) {
  const [p, setP] = useState<Preview | undefined>(undefined);
  useEffect(() => {
    let live = true;
    if (!cache.has(id)) cache.set(id, postPreview(id).catch(() => null));
    void cache.get(id)!.then((r) => { if (live) setP(r); });
    return () => { live = false; };
  }, [id]);
  return (
    <Link href={`/post/${id}`} className={cn("block w-64 max-w-full rounded-2xl border p-3 text-left transition hover:-translate-y-px", spaced && "mt-2", mine ? "border-on-accent/25 bg-on-accent/10" : "border-line bg-surface/80")}>
      {p === undefined ? (
        <span className={cn("block h-10 animate-pulse rounded-lg", mine ? "bg-on-accent/15" : "bg-raised")} />
      ) : p ? (
        <>
          <span className={cn("flex items-center gap-1.5 text-[11px]", mine ? "text-on-accent/70" : "text-faint")}>
            <span className="font-medium capitalize">{p.kind}</span> · {p.author}{p.hasMedia && <ImageIcon className="ml-auto size-3.5" />}
          </span>
          <span className="mt-1 line-clamp-3 block text-sm leading-snug">{p.body}</span>
        </>
      ) : (
        <span className={cn("text-xs", mine ? "text-on-accent/70" : "text-muted")}>This post isn&apos;t available.</span>
      )}
    </Link>
  );
}
