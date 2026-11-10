import { BadgeCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/forge";

// A club-verified milestone in the feed: the thing Brazework exists for. Someone did the work, their
// club checked it, and anyone can open the project to see the evidence.
export type Proof = {
  id: string; title: string; detail: string; reviewed_at: string; community_id: string; community_name: string; reviewer_name: string;
  project: { id: string; title: string }; owner: { id: string; first: string; last: string; avatar: string | null };
};

export function ProofCard({ p, reason = "" }: { p: Proof; reason?: string }) {
  return (
    <article className="glass-card rounded-3xl p-5">
      {reason && <p className="mb-3 flex items-center gap-1.5 text-xs text-faint"><Sparkles className="size-3.5 shrink-0" /> {reason}</p>}
      <div className="flex items-center gap-2 text-xs font-medium text-text">
        <span className="grid size-6 place-items-center rounded-full bg-accent-grad text-on-accent"><BadgeCheck className="size-3.5" /></span>
        Verified by <Link href={`/c/${p.community_id}`} className="hover:underline">{p.community_name}</Link>
        <span className="font-normal text-faint">· {timeAgo(p.reviewed_at)}</span>
      </div>

      <div className="mt-4 flex items-start gap-3">
        <Link href={`/u/${p.owner.id}`} tabIndex={-1} aria-hidden="true" className="shrink-0"><Avatar first={p.owner.first} last={p.owner.last} size={40} src={p.owner.avatar} /></Link>
        <div className="min-w-0">
          <p className="text-[15px] leading-snug text-text-2">
            <Link href={`/u/${p.owner.id}`} className="font-medium text-text hover:underline">{`${p.owner.first} ${p.owner.last}`.trim()}</Link> hit a milestone on{" "}
            <Link href={`/projects/${p.project.id}`} className="font-medium text-text hover:underline">{p.project.title}</Link>
          </p>
          <p className="mt-2 text-lg font-semibold tracking-tight">{p.title}</p>
          {p.detail && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">{p.detail}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-faint">
        <span>{p.reviewer_name ? `Checked by ${p.reviewer_name}` : "Checked by the club"}</span>
        <Link href={`/projects/${p.project.id}`} className="font-medium text-text hover:underline">See the project →</Link>
      </div>
    </article>
  );
}
