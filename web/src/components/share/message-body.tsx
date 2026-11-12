"use client";
import { CalendarDays, FolderGit2, ImageIcon, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/forge";
import { eventPreview, postPreview, projectPreview } from "@/lib/share";

type PostP = Awaited<ReturnType<typeof postPreview>>;
type EventP = Awaited<ReturnType<typeof eventPreview>>;
type ProjectP = Awaited<ReturnType<typeof projectPreview>>;
type Kind = "post" | "events" | "projects";
const SHARED = /(?:^|\s)\/(post|events|projects)\/([A-Za-z0-9-]{1,64})(?=\s|$)/;
// One lookup per item per page, shared by every bubble that shows it.
const cache = new Map<string, Promise<PostP | EventP | ProjectP>>();
const load = (kind: Kind, id: string) => {
  const key = `${kind}:${id}`;
  if (!cache.has(key)) cache.set(key, (kind === "post" ? postPreview(id) : kind === "events" ? eventPreview(id) : projectPreview(id)).catch(() => null));
  return cache.get(key)!;
};

// A message's text, with a shared post or event (its /post/<id> or /events/<id> link) shown as a card under it.
export function MessageBody({ body, mine = false }: { body: string; mine?: boolean }) {
  const m = body.match(SHARED);
  if (!m) return <>{body}</>;
  const text = body.replace(m[0], "").trim();
  return (
    <>
      {text && <span className="block">{text}</span>}
      <Shared kind={m[1] as Kind} id={m[2]} mine={mine} spaced={!!text} />
    </>
  );
}

function Shared({ kind, id, mine, spaced }: { kind: Kind; id: string; mine: boolean; spaced: boolean }) {
  const [p, setP] = useState<PostP | EventP | ProjectP | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void load(kind, id).then((r) => { if (live) setP(r); });
    return () => { live = false; };
  }, [kind, id]);
  const faint = mine ? "text-on-accent/70" : "text-faint";
  return (
    <Link href={`/${kind}/${id}`} className={cn("block w-64 max-w-full rounded-2xl border p-3 text-left transition", spaced && "mt-2", mine ? "border-on-accent/25 bg-on-accent/10" : "border-line bg-surface/80")}>
      {p === undefined ? (
        <span className={cn("block h-10 animate-pulse rounded-lg", mine ? "bg-on-accent/15" : "bg-raised")} />
      ) : p && kind === "events" && "starts_at" in p ? (
        <>
          <span className={cn("flex items-center gap-1.5 text-[11px]", faint)}><CalendarDays className="size-3.5" /> Event · {new Date(p.starts_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          <span className="mt-1 line-clamp-2 block text-sm font-medium leading-snug">{p.title}</span>
          <span className={cn("mt-1 flex items-center gap-1 text-[11px]", faint)}><Users className="size-3" /> {p.going} going · {p.where}</span>
        </>
      ) : p && kind === "projects" && "summary" in p ? (
        <>
          <span className={cn("flex items-center gap-1.5 text-[11px]", faint)}><FolderGit2 className="size-3.5" /> Project · {p.owner} · {p.status}</span>
          <span className="mt-1 block text-sm font-medium leading-snug">{p.title}</span>
          <span className="mt-0.5 line-clamp-2 block text-xs leading-snug opacity-80">{p.summary}</span>
        </>
      ) : p && "body" in p ? (
        <>
          <span className={cn("flex items-center gap-1.5 text-[11px]", faint)}>
            <span className="font-medium capitalize">{p.kind}</span> · {p.author}{p.hasMedia && <ImageIcon className="ml-auto size-3.5" />}
          </span>
          <span className="mt-1 line-clamp-3 block text-sm leading-snug">{p.body}</span>
        </>
      ) : (
        <span className={cn("text-xs", mine ? "text-on-accent/70" : "text-muted")}>{kind === "events" ? "This event isn't available." : kind === "projects" ? "This project isn't available." : "This post isn't available."}</span>
      )}
    </Link>
  );
}
