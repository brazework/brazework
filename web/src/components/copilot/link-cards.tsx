"use client";
import { Lock, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui";
import { CommunityBadge } from "@/app/(app)/communities/_components/badge";
import { MessageBody } from "@/components/share/message-body";
import { clubPreview, personPreview } from "@/lib/share";

type ClubP = Awaited<ReturnType<typeof clubPreview>>;
type PersonP = Awaited<ReturnType<typeof personPreview>>;
const cache = new Map<string, Promise<ClubP | PersonP>>();
const load = (kind: "c" | "u", id: string) => {
  const key = `${kind}:${id}`;
  if (!cache.has(key)) cache.set(key, (kind === "c" ? clubPreview(id) : personPreview(id)).catch(() => null));
  return cache.get(key)!;
};

// The clubs, events, people, projects and posts an answer points to, as real cards under it.
export function LinkCards({ paths }: { paths: string[] }) {
  if (!paths.length) return null;
  return (
    <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
      {paths.map((p) => {
        const [, kind, id] = p.split("/");
        return <div key={p} className="shrink-0">{kind === "c" || kind === "u" ? <Entity kind={kind} id={id} /> : <MessageBody body={p} />}</div>;
      })}
    </div>
  );
}

function Entity({ kind, id }: { kind: "c" | "u"; id: string }) {
  const [p, setP] = useState<ClubP | PersonP | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void load(kind, id).then((r) => { if (live) setP(r); });
    return () => { live = false; };
  }, [kind, id]);
  return (
    <Link href={`/${kind}/${id}`} className="flex w-64 max-w-full items-center gap-3 rounded-2xl border border-line bg-surface/80 p-3 text-left transition hover:border-line-strong">
      {p === undefined ? (
        <span className="block h-10 w-full animate-pulse rounded-lg bg-raised" />
      ) : p && "name" in p ? (
        <>
          <CommunityBadge id={p.id} name={p.name} size={40} logo={p.logo} accent={p.accent} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{p.name}</span>
            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-faint"><Users className="size-3" /> {p.members} {p.members === 1 ? "member" : "members"}{p.privacy === "approval" && <><Lock className="ml-1 size-3" /> Approval</>}</span>
            {p.about && <span className="mt-0.5 line-clamp-1 block text-xs text-muted">{p.about}</span>}
          </span>
        </>
      ) : p && "first" in p ? (
        <>
          <Avatar first={p.first} last={p.last} size={40} src={p.avatar} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{p.first} {p.last}</span>
            {p.headline && <span className="line-clamp-2 block text-xs leading-snug text-muted">{p.headline}</span>}
          </span>
        </>
      ) : (
        <span className="text-xs text-muted">{kind === "c" ? "This club isn't available." : "This profile isn't available."}</span>
      )}
    </Link>
  );
}
