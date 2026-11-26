import { cn } from "@/lib/forge";

// The assistant's mark (redrawn 2026-11-26, the founders' call: sleek, modern, black). An ink disc
// with a sharp four-point spark cut out of it in the page's own colour: black on light pages, white
// on dark ones, like the primary buttons (globals.css --mark / --mark-on). A faint sheen across the
// top keeps it from reading as a flat dot; there is no glow, plasma or bobbing. It appears wherever
// the app talks to you: the ask bar, the sidebar, the composer, empty and waiting states. Pure SVG +
// CSS (no JavaScript), so it renders on the server.
//
// Moods are motion only (globals.css): the spark breathes when idle, turns while thinking, rests
// when sleepy. The component keeps its old name (Torch) in code; what people call it is set in copy.

export type EmberMood = "idle" | "thinking" | "happy" | "sleepy" | "surprised";

export function Ember({ mood = "idle", size = 48, className, label }: { mood?: EmberMood; size?: number; className?: string; label?: string }) {
  const id = `mark-${mood}-${size}`;
  return (
    <span className={cn("ember inline-block shrink-0", `ember-${mood}`, className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 64 64" className="block size-full">
        <defs>
          <linearGradient id={`${id}-sheen`} x1="0.2" y1="0" x2="0.7" y2="0.75">
            <stop offset="0" stopColor="var(--mark-on)" stopOpacity="0.26" />
            <stop offset="0.55" stopColor="var(--mark-on)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="27" fill="var(--mark)" />
        <circle cx="32" cy="32" r="27" fill={`url(#${id}-sheen)`} />
        {/* The spark: four points, the vertical pair a little longer, with a small second one beside it. */}
        <g className="ember-spark" fill="var(--mark-on)">
          <path d="M32 12.5 C33.5 24.6 39.4 30.5 51.5 32 C39.4 33.5 33.5 39.4 32 51.5 C30.5 39.4 24.6 33.5 12.5 32 C24.6 30.5 30.5 24.6 32 12.5 Z" />
          {size >= 28 && <path d="M45.5 15.5 C45.9 18.9 47.1 20.1 50.5 20.5 C47.1 20.9 45.9 22.1 45.5 25.5 C45.1 22.1 43.9 20.9 40.5 20.5 C43.9 20.1 45.1 18.9 45.5 15.5 Z" opacity="0.85" />}
        </g>
      </svg>
    </span>
  );
}
