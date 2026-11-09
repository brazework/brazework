import { cn } from "@/lib/forge";

// Ember: Forge's AI, shown as a glowing glass orb with light swirling inside (Forge is where sparks
// fly). It appears wherever the app talks to you: the feed's create box, the guide, Copilot, empty
// and waiting states. Pure SVG + CSS (no JavaScript), so it renders on the server.
//
// Built back to front: an outer glow, the sphere's base colour, three soft swirls of light turning
// at different speeds inside it, a hot core, then the glass (rim light, highlight, edge). Moods are
// expressed through light and motion (globals.css), not a face. Colours come from
// --ember-a/--ember-b/--ember-c, so it follows the skin.

export type EmberMood = "idle" | "thinking" | "happy" | "sleepy" | "surprised";

const R = 22;

export function Ember({ mood = "idle", size = 48, className, label }: { mood?: EmberMood; size?: number; className?: string; label?: string }) {
  const id = `ember-${mood}-${size}`;
  const small = size < 28; // tiny orbs skip the outer glow so they stay crisp in buttons
  return (
    <span className={cn("ember inline-block shrink-0", `ember-${mood}`, className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 64 64" className="block size-full overflow-visible">
        <defs>
          <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.55" stopColor="var(--ember-a)" stopOpacity="0.6" />
            <stop offset="0.76" stopColor="var(--ember-b)" stopOpacity="0.24" />
            <stop offset="1" stopColor="var(--ember-b)" stopOpacity="0" />
          </radialGradient>
          {/* Base: deep at the edge so the light inside reads as glowing. */}
          <radialGradient id={`${id}-base`} cx="0.42" cy="0.4" r="0.7">
            <stop offset="0" stopColor="var(--ember-a)" />
            <stop offset="0.55" stopColor="var(--ember-b)" />
            <stop offset="1" stopColor="color-mix(in oklab, var(--ember-b) 55%, black)" />
          </radialGradient>
          <radialGradient id={`${id}-core`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="white" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="color-mix(in oklab, var(--ember-a) 40%, white)" stopOpacity="0.5" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-spec`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="white" stopOpacity="0.9" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="color-mix(in oklab, var(--ember-a) 40%, white)" stopOpacity="0.75" />
          </linearGradient>
          <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.8" />
          </filter>
          <clipPath id={`${id}-clip`}><circle cx="32" cy="32" r={R} /></clipPath>
        </defs>

        {/* Outer glow. */}
        {!small && <circle className="ember-glow" cx="32" cy="32" r="31" fill={`url(#${id}-glow)`} />}

        <g className="ember-body">
          <circle cx="32" cy="32" r={R} fill={`url(#${id}-base)`} />
          {/* Light swirling inside, blurred into one another. */}
          <g clipPath={`url(#${id}-clip)`}>
            <g filter={`url(#${id}-soft)`}>
              <g className="ember-swirl-1"><ellipse cx="23" cy="39" rx="14" ry="8.5" transform="rotate(-25 23 39)" fill="var(--ember-c)" opacity="0.9" /></g>
              <g className="ember-swirl-2"><ellipse cx="40" cy="23" rx="13" ry="7.5" transform="rotate(30 40 23)" fill="color-mix(in oklab, var(--ember-a) 45%, white)" opacity="0.95" /></g>
              <g className="ember-swirl-3"><ellipse cx="40" cy="43" rx="11" ry="7" transform="rotate(-40 40 43)" fill="var(--ember-a)" opacity="0.85" /></g>
            </g>
            <circle className="ember-core" cx="31" cy="33" r="11" fill={`url(#${id}-core)`} />
          </g>
          {/* Glass: rim light along the bottom, a highlight up top, and a fine edge. */}
          <circle cx="32" cy="32" r={R - 0.6} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.6" />
          <ellipse cx="25.5" cy="19.5" rx="8.5" ry="4.2" transform="rotate(-24 25.5 19.5)" fill={`url(#${id}-spec)`} opacity="0.75" />
          <circle cx="32" cy="32" r={R - 0.4} fill="none" stroke="white" strokeOpacity="0.28" strokeWidth="0.8" />
        </g>
      </svg>
    </span>
  );
}
