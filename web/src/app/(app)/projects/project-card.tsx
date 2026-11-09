import { BadgeCheck, Beaker, CheckCircle2, CircuitBoard, Code2, Cog, FolderGit2, LineChart, Wrench } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/forge";
import { toolInfo } from "@/lib/stack";

export type ExploreProject = {
  id: string; title: string; summary: string; status: "in_progress" | "completed"; year: number | null; tags: string[]; updated_at: string;
  owner_id: string; owner: { first_name: string; last_name: string; field: string } | null; verified: number; updates: number; tools?: string[];
};

// The card's icon: the kind of work its first catalog tool belongs to (software, CAD, lab…).
export function ProjectIcon({ tools = [], className }: { tools?: string[]; className?: string }) {
  switch (tools.map((t) => toolInfo(t).cat).find((c) => c !== "other")) {
    case "software": return <Code2 className={className} />;
    case "hardware": return <CircuitBoard className={className} />;
    case "cad": return <Cog className={className} />;
    case "lab": return <Beaker className={className} />;
    case "data": return <LineChart className={className} />;
    case "fab": return <Wrench className={className} />;
    default: return <FolderGit2 className={className} />;
  }
}

// A project in Explore: what it is, how far along, what a club has verified, what it's built with
// (the whole stack shows on hover), and who built it.
export function ExploreCard({ p }: { p: ExploreProject }) {
  const name = `${p.owner?.first_name ?? ""} ${p.owner?.last_name ?? ""}`.trim() || "Forge member";
  const tools = p.tools ?? [];
  return (
    <article className="glass-card group relative flex h-full flex-col rounded-3xl p-5 transition duration-300 hover:-translate-y-1">
      <div className="flex items-center gap-2">
        <span className="nav-tile grid size-10 shrink-0 place-items-center rounded-xl text-text-2 transition group-hover:text-text"><ProjectIcon tools={tools} className="size-5" /></span>
        <span className="ml-auto flex flex-wrap justify-end gap-1.5">
          {p.verified > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2 py-0.5 text-[11px] font-medium text-ok"><BadgeCheck className="size-3.5" /> {p.verified} verified</span>}
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
            {p.status === "completed" ? <><CheckCircle2 className="size-3 text-ok" /> Completed{p.year ? ` ${p.year}` : ""}</> : <><span className="size-1.5 rounded-full bg-text" /> Building</>}
          </span>
        </span>
      </div>
      <Link href={`/projects/${p.id}`} className="mt-4 text-lg leading-snug font-semibold tracking-tight after:absolute after:inset-0 after:rounded-3xl after:content-[''] group-hover:underline">{p.title}</Link>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-text-2">{p.summary}</p>
      {tools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1" aria-label={`Built with ${tools.join(", ")}`}>
          {tools.map((t, i) => (
            <span key={t} className={i < 4 ? "rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-2" : "hidden rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-2 group-hover:inline"}>{t}</span>
          ))}
          {tools.length > 4 && <span className="rounded-md px-1.5 py-0.5 font-mono text-[11px] text-faint group-hover:hidden">+{tools.length - 4}</span>}
        </div>
      )}
      {p.tags.length > 0 && <p className="mt-2 truncate text-xs text-faint">{p.tags.map((t) => `#${t}`).join("  ")}</p>}
      <div className="min-h-4 flex-1" aria-hidden="true" />
      <div className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
        <Avatar first={p.owner?.first_name ?? ""} last={p.owner?.last_name ?? ""} size={22} className="text-[9px]" />
        <span className="truncate"><span className="font-medium text-text-2">{name}</span>{p.owner?.field ? ` · ${p.owner.field}` : ""}</span>
        <span className="ml-auto shrink-0 text-faint">{p.updates > 0 ? `${p.updates} update${p.updates === 1 ? "" : "s"} · ` : ""}{timeAgo(p.updated_at)}</span>
      </div>
    </article>
  );
}
