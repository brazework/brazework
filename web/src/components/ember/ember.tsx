import { cn } from "@/lib/forge";

// Torch's mark (redrawn 2026-11-26, the founders' call: sleek, black, smooth, not flat). A polished
// graphite disc, lit from the upper left, with a bright edge along the top and a soft shadow under it,
// and a four-point spark at its centre in a soft gradient with a faint glow. Black on light pages and
// white on dark ones, like the primary buttons (globals.css --mark-*). No plasma or bobbing: the
// spark breathes when idle and turns while Torch thinks. Pure SVG + CSS, so it renders on the server.
// The component keeps its old name (Ember) in code; what people call it is set in copy.

export type EmberMood = "idle" | "thinking" | "happy" | "sleepy" | "surprised";

const SPARK = "M32 13 C33.4 24.8 39.2 30.6 51 32 C39.2 33.4 33.4 39.2 32 51 C30.6 39.2 24.8 33.4 13 32 C24.8 30.6 30.6 24.8 32 13 Z";
const SMALL = "M45.4 15.6 C45.8 18.8 46.9 19.9 50.1 20.3 C46.9 20.7 45.8 21.8 45.4 25 C45 21.8 43.9 20.7 40.7 20.3 C43.9 19.9 45 18.8 45.4 15.6 Z";

export function Ember({ mood = "idle", size = 48, className, label }: { mood?: EmberMood; size?: number; className?: string; label?: string }) {
  const id = `mark-${mood}-${size}`;
  const small = size < 28;
  return (
    <span className={cn("ember inline-block shrink-0", `ember-${mood}`, className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 64 64" className="block size-full overflow-visible">
        <defs>
          {/* The disc: lit from the upper left, deepest at the lower right. */}
          <radialGradient id={`${id}-disc`} cx="0.32" cy="0.26" r="0.92">
            <stop offset="0" stopColor="var(--mark-hi)" />
            <stop offset="0.55" stopColor="var(--mark)" />
            <stop offset="1" stopColor="var(--mark-lo)" />
          </radialGradient>
          {/* A bright edge along the top of the rim, fading down the sides. */}
          <linearGradient id={`${id}-rim`} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0" stopColor="var(--mark-on)" stopOpacity="0.45" />
            <stop offset="0.45" stopColor="var(--mark-on)" stopOpacity="0.06" />
            <stop offset="1" stopColor="var(--mark-on)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-spark`} x1="0.3" y1="0.1" x2="0.7" y2="0.95">
            <stop offset="0" stopColor="var(--mark-on)" />
            <stop offset="1" stopColor="var(--mark-on)" stopOpacity="0.78" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" /></filter>
          <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.8" floodColor="#000" floodOpacity="0.28" /></filter>
        </defs>
        <circle cx="32" cy="32" r="27" fill={`url(#${id}-disc)`} filter={small ? undefined : `url(#${id}-shadow)`} />
        <circle cx="32" cy="32" r="26.4" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.2" />
        <g className="ember-spark">
          {!small && <path d={SPARK} fill="var(--mark-on)" opacity="0.35" filter={`url(#${id}-glow)`} />}
          <path d={SPARK} fill={`url(#${id}-spark)`} />
          {!small && <path d={SMALL} fill="var(--mark-on)" opacity="0.85" />}
        </g>
      </svg>
    </span>
  );
}
