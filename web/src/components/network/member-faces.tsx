"use client";
import { Avatar } from "@/components/ui";
import { useOnlineCount } from "@/components/presence/presence";
import { cn } from "@/lib/forge";

export type Face = { uid: string; first: string; last: string };

// A club's people at a glance: a few overlapping faces, how many more, and who's on Forge right now
// (live, from presence). `ids` can be longer than `faces` so the online count covers more members.
export function MemberFaces({ faces, total, ids, size = 28, className }: { faces: Face[]; total: number; ids?: string[]; size?: number; className?: string }) {
  const online = useOnlineCount(ids ?? faces.map((f) => f.uid));
  const shown = faces.slice(0, 5);
  const more = Math.max(0, total - shown.length);
  if (!shown.length && !online) return null;
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {shown.length > 0 && (
        <span className="flex -space-x-1.5">
          {shown.map((f) => <Avatar key={f.uid} first={f.first} last={f.last} size={size} className="border-2 border-surface text-[10px]" />)}
          {more > 0 && <span className="grid shrink-0 place-items-center rounded-full border-2 border-surface bg-surface-2 px-1.5 text-[10px] font-medium text-muted" style={{ height: size, minWidth: size }}>+{more > 999 ? "999" : more}</span>}
        </span>
      )}
      {online > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
          <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" /><span className="relative size-2 rounded-full bg-emerald-500" /></span>
          {online} online
        </span>
      )}
    </div>
  );
}
