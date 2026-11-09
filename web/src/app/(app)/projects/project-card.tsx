import { BadgeCheck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/forge";

export type ExploreProject = {
  id: string; title: string; summary: string; status: "in_progress" | "completed"; year: number | null; tags: string[]; updated_at: string;
  owner_id: string; owner: { first_name: string; last_name: string; field: string } | null; verified: number; updates: number;
};

// Each project gets a stable colour strip from its first topic (or title), so a grid reads at a glance.
const STRIPES = ["linear-gradient(90deg,#6366f1,#38bdf8)", "linear-gradient(90deg,#8b5cf6,#ec4899)", "linear-gradient(90deg,#06b6d4,#10b981)", "linear-gradient(90deg,#f59e0b,#ef4444)", "linear-gradient(90deg,#ec4899,#f97316)", "linear-gradient(90deg,#eab308,#22c55e)"];
export function stripe(p: { tags: string[]; title: string }) {
  let h = 0;
  for (const ch of p.tags[0] ?? p.title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STRIPES[h % STRIPES.length];
}

// A project in Explore: who built it, where it stands, how much of it a club has verified.
export function ExploreCard({ p }: { p: ExploreProject }) {
  const name = `${p.owner?.first_name ?? ""} ${p.owner?.last_name ?? ""}`.trim() || "Forge member";
  return (
    <article className="glass-card group relative flex h-full flex-col overflow-hidden rounded-3xl p-5 pt-6 transition duration-300 hover:-translate-y-1">
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: stripe(p) }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${p.id}`} className="text-lg font-semibold tracking-tight after:absolute after:inset-0 after:content-[''] group-hover:underline">{p.title}</Link>
        {p.verified > 0 && <span className="relative inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 text-[11px] font-medium text-ok"><BadgeCheck className="size-3.5" /> {p.verified} verified</span>}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
        {p.status === "completed" ? <><CheckCircle2 className="size-3.5 text-ok" /> Completed{p.year ? ` ${p.year}` : ""}</> : <><span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-50" /><span className="relative size-2 rounded-full bg-accent" /></span> In progress · updated {timeAgo(p.updated_at)}</>}
      </p>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-2">{p.summary}</p>
      {p.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{p.tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-text-2">#{t}</span>)}</div>}
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted">
        <Avatar first={p.owner?.first_name ?? ""} last={p.owner?.last_name ?? ""} size={24} className="text-[9px]" />
        <span className="truncate"><span className="font-medium text-text-2">{name}</span>{p.owner?.field ? ` · ${p.owner.field}` : ""}</span>
        {p.updates > 0 && <span className="ml-auto shrink-0">{p.updates} update{p.updates === 1 ? "" : "s"}</span>}
      </div>
    </article>
  );
}
