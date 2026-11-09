import { cn } from "@/lib/forge";

// Ember: Forge's AI, shown as a glowing glass orb with light moving inside it (Forge is where sparks
// fly). It appears wherever the app talks to you: the feed's create box, the guide, Copilot, empty
// and waiting states. Pure SVG + CSS (no JavaScript), so it renders on the server.
//
// Built like a lit glass sphere, back to front: a two-tone outer glow; a deep base; soft plasma
// drifting inside; thin bands of energy circling at different speeds; a white-hot core; then the
// glass itself (a fresnel edge glow, light gathered at the bottom, and a highlight up top). Moods
// are light and motion (globals.css), not a face. Colours come from --ember-a/--ember-b/--ember-c.

export type EmberMood = "idle" | "thinking" | "happy" | "sleepy" | "surprised";

const R = 22;

export function Ember({ mood = "idle", size = 48, className, label }: { mood?: EmberMood; size?: number; className?: string; label?: string }) {
  const id = `ember-${mood}-${size}`;
  const small = size < 28; // tiny orbs skip the outer glow and bands so they stay crisp in buttons
  const u = (k: string) => `url(#${id}-${k})`;
  return (
    <span className={cn("ember inline-block shrink-0", `ember-${mood}`, className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 64 64" className="block size-full overflow-visible">
        <defs>
          <radialGradient id={`${id}-halo-in`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.6" stopColor="var(--ember-a)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--ember-a)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-halo-out`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.5" stopColor="var(--ember-c)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--ember-b)" stopOpacity="0" />
          </radialGradient>
          {/* Deep at the edge so everything inside reads as light. */}
          <radialGradient id={`${id}-base`} cx="0.45" cy="0.45" r="0.65">
            <stop offset="0" stopColor="var(--ember-b)" />
            <stop offset="0.7" stopColor="color-mix(in oklab, var(--ember-b) 75%, black)" />
            <stop offset="1" stopColor="color-mix(in oklab, var(--ember-b) 45%, black)" />
          </radialGradient>
          <radialGradient id={`${id}-core`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="white" stopOpacity="1" />
            <stop offset="0.35" stopColor="color-mix(in oklab, var(--ember-a) 35%, white)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--ember-a)" stopOpacity="0" />
          </radialGradient>
          {/* Fresnel: glass glows brightest at its edge. */}
          <radialGradient id={`${id}-fresnel`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.72" stopColor="white" stopOpacity="0" />
            <stop offset="0.95" stopColor="color-mix(in oklab, var(--ember-a) 40%, white)" stopOpacity="0.45" />
            <stop offset="1" stopColor="white" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id={`${id}-spec`} cx="0.5" cy="0.4" r="0.55">
            <stop offset="0" stopColor="white" stopOpacity="0.95" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.95" />
            <stop offset="1" stopColor="var(--ember-a)" stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-plasma`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4.2" /></filter>
          <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="0.7" /></filter>
          <filter id={`${id}-caustic`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" /></filter>
          <clipPath id={`${id}-clip`}><circle cx="32" cy="32" r={R} /></clipPath>
        </defs>

        {/* Two-tone glow: a tight warm one and a wide accent one, breathing out of step. */}
        {!small && <circle className="ember-glow-out" cx="32" cy="32" r="32" fill={u("halo-out")} />}
        {!small && <circle className="ember-glow" cx="32" cy="32" r="28" fill={u("halo-in")} />}

        <g className="ember-body">
          <circle cx="32" cy="32" r={R} fill={u("base")} />
          <g clipPath={u("clip")}>
            {/* Plasma drifting inside. */}
            <g filter={u("plasma")} style={{ opacity: "var(--ember-plasma, 1)" }}>
              <g className="ember-swirl-1"><ellipse cx="22" cy="40" rx="13" ry="9" fill="var(--ember-c)" opacity="0.95" /></g>
              <g className="ember-swirl-2"><ellipse cx="41" cy="24" rx="12" ry="8" fill="var(--ember-a)" /></g>
              <g className="ember-swirl-3"><ellipse cx="42" cy="42" rx="9" ry="6" fill="color-mix(in oklab, var(--ember-c) 50%, var(--ember-a))" opacity="0.9" /></g>
            </g>
            {/* Bands of energy circling the core. */}
            {!small && (
              <g filter={u("soft")} fill="none" strokeLinecap="round">
                <g className="ember-band-1"><ellipse cx="32" cy="32" rx="17" ry="6.5" transform="rotate(-28 32 32)" stroke={u("band")} strokeWidth="1.3" strokeDasharray="34 80" /></g>
                <g className="ember-band-2"><ellipse cx="32" cy="32" rx="14" ry="5" transform="rotate(38 32 32)" stroke={u("band")} strokeWidth="1" strokeDasharray="22 70" opacity="0.8" /></g>
              </g>
            )}
            <circle className="ember-core" cx="31.5" cy="33" r="10" fill={u("core")} />
            {/* Light gathered low in the glass, opposite the highlight. */}
            <ellipse cx="36" cy="47" rx="10" ry="4" fill="white" opacity="0.4" filter={u("caustic")} />
          </g>
          {/* Glass: edge glow, a highlight up top, and a fine rim. */}
          <circle cx="32" cy="32" r={R} fill={u("fresnel")} style={{ opacity: "var(--ember-fresnel, 1)" }} />
          <ellipse cx="25" cy="19.5" rx="9" ry="4.6" transform="rotate(-28 25 19.5)" fill={u("spec")} opacity="0.85" />
          {!small && <ellipse cx="41.5" cy="46" rx="3.2" ry="1.3" transform="rotate(-35 41.5 46)" fill="white" opacity="0.35" />}
          <circle cx="32" cy="32" r={R - 0.3} fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="0.6" />
        </g>
      </svg>
    </span>
  );
}
