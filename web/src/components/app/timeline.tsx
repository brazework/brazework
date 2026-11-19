import { BadgeCheck, Clock, GitMerge, PencilLine, X } from "lucide-react";
import { cn } from "@/lib/forge";

// Anything that happened in order (docs/design/app.md): milestones, a build log, a club's term. One
// line down the left, a marker per row. A row's `state` sets its marker: signed (the verified green
// seal), waiting (dashed, and the row says who for), logged (backed by data, not a person), draft
// (not sent yet), declined. Server-safe: the rows are plain markup; put buttons in `children`.

export type TimelineState = "signed" | "waiting" | "logged" | "draft" | "declined";

const MARK: Record<TimelineState, { icon: typeof Clock; cls: string }> = {
  signed: { icon: BadgeCheck, cls: "bg-ok text-white" },
  waiting: { icon: Clock, cls: "border border-dashed border-line-strong bg-surface text-muted" },
  logged: { icon: GitMerge, cls: "bg-surface-2 text-text-2" },
  draft: { icon: PencilLine, cls: "border border-dashed border-line-strong bg-surface text-faint" },
  declined: { icon: X, cls: "bg-surface-2 text-faint" },
};

export function Timeline({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <ol aria-label={label} className={cn("relative flex flex-col gap-3 border-l border-line pl-5", className)}>{children}</ol>;
}

export function TimelineRow({ state, title, meta, seal, id, children }: { state: TimelineState; title: React.ReactNode; meta?: React.ReactNode; seal?: React.ReactNode; id?: string; children?: React.ReactNode }) {
  const m = MARK[state];
  return (
    <li id={id} className={cn("relative scroll-mt-24 rounded-xl px-3 py-2.5", state === "waiting" || state === "draft" ? "border border-dashed border-line-strong" : "border border-transparent")}>
      <span className={cn("absolute top-3 -left-[31px] grid size-5 place-items-center rounded-full ring-4 ring-bg", m.cls)} aria-hidden="true"><m.icon className="size-3" /></span>
      <div className={cn("text-sm font-medium", state === "declined" ? "text-muted line-through decoration-faint" : "text-text")}>{title}</div>
      {meta && <div className="mt-0.5 text-xs text-muted">{meta}</div>}
      {seal && <div className="mt-1.5">{seal}</div>}
      {children}
    </li>
  );
}
