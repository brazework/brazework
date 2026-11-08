import { cn } from "@/lib/forge";
import { ROLE_LABEL, cInitials, rank, type Role } from "@/lib/communities";

// Monochrome stand-in for the vanilla app's tinted badges: the same community always gets the same tone.
const TONES = [
  "bg-accent text-on-accent",
  "bg-raised text-text border border-line-strong",
  "bg-surface-2 text-text-2 border border-line",
];

function tone(id: string) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function CommunityBadge({ id, name, size = 48, className }: { id: string; name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-grid shrink-0 place-items-center font-semibold tracking-tight", tone(id), className)}
      style={{ width: size, height: size, fontSize: Math.round(size / 2.8), borderRadius: Math.round(size * 0.3) }}
    >
      {cInitials(name)}
    </span>
  );
}

export function RoleChip({ role, className }: { role: Role; className?: string }) {
  const r = rank(role);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-wide uppercase",
        r >= 4 ? "bg-accent text-on-accent" : r >= 2 ? "border border-line-strong text-text" : "border border-line text-muted",
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

// "12 members · Public · Physics · Study group"
export function MetaLine({ parts, className }: { parts: (string | false | null | undefined)[]; className?: string }) {
  return <span className={cn("text-xs text-faint", className)}>{parts.filter(Boolean).join(" · ")}</span>;
}
