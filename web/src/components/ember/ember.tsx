import { cn } from "@/lib/forge";

// Ember: Forge's character, a small living flame (Forge is where sparks fly). It's the face of
// Copilot and shows up wherever the app talks to you: the feed hero, the guide, empty and waiting
// states. Pure SVG + CSS (no JavaScript), coloured by the active theme through --ember-a/--ember-b
// (globals.css), so it matches every skin and renders on the server.
//
// Built in layers, back to front: outer glow, back flame, two swaying side flames, the body, its
// hot core, rim light and gloss, then the face, then sparks and rising embers.

export type EmberMood = "idle" | "thinking" | "happy" | "sleepy" | "surprised";

export function Ember({ mood = "idle", size = 48, className, label }: { mood?: EmberMood; size?: number; className?: string; label?: string }) {
  const id = `ember-${mood}-${size}`;
  const small = size < 36; // tiny Embers drop the fine detail so they stay crisp
  const eyeY = mood === "thinking" ? 38.4 : 39.6;
  const eyeRy = mood === "surprised" ? 4.6 : 3.9;
  return (
    <span className={cn("ember inline-block shrink-0", `ember-${mood}`, className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 64 64" className="block size-full overflow-visible">
        <defs>
          <linearGradient id={`${id}-body`} x1="0.25" y1="0" x2="0.7" y2="1">
            <stop offset="0" stopColor="var(--ember-a)" />
            <stop offset="0.55" stopColor="color-mix(in oklab, var(--ember-a) 45%, var(--ember-b))" />
            <stop offset="1" stopColor="var(--ember-b)" />
          </linearGradient>
          <linearGradient id={`${id}-back`} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0" stopColor="var(--ember-b)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--ember-b)" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id={`${id}-core`} cx="0.5" cy="0.7" r="0.55">
            <stop offset="0" stopColor="white" stopOpacity="var(--ember-glow, 0.6)" />
            <stop offset="0.6" stopColor="var(--ember-a)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--ember-a)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="var(--ember-b)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--ember-b)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-eye`} cx="0.45" cy="0.3" r="0.8">
            <stop offset="0" stopColor="color-mix(in oklab, var(--ember-eye) 70%, white)" />
            <stop offset="0.5" stopColor="var(--ember-eye)" />
          </radialGradient>
        </defs>

        {/* Outer glow and ground shadow. */}
        <circle className="ember-halo" cx="32" cy="38" r="30" fill={`url(#${id}-halo)`} />
        <ellipse className="ember-shadow" cx="32" cy="62" rx="12" ry="2" fill="var(--ember-b)" opacity="0.25" />

        <g className="ember-float">
          {/* Back flame: a darker silhouette that gives the body depth. */}
          {!small && <path d="M32 1.5c3.4 7.6 9.4 11.8 13.6 17.6 3.6 5 5.9 10.3 5.9 17.3C51.5 48.6 42.8 58 32 58S12.5 48.6 12.5 36.4c0-7.2 3-12.7 7.4-17.1.3 3.6 1.9 6.2 4.6 7.6-1.5-9.5 3.2-17.7 7.5-25.4Z" fill={`url(#${id}-back)`} opacity="0.55" />}
          {/* Side flames, swaying on their own. */}
          <path className="ember-tongue-l" d="M20.5 42c-6.2-5.2-7.6-13.6-4-21.4 1.2 4.6 3.7 7.4 7.4 8.6Z" fill="var(--ember-b)" opacity="0.85" />
          <path className="ember-tongue-r" d="M43.5 42c6.6-5 8.4-13.4 5.4-21.8-1.4 4.4-4 7.2-7.8 8.2Z" fill="var(--ember-b)" opacity="0.85" />
          {/* Body. */}
          <path d="M32 3.5c2.6 6.4 7.7 10.2 11.6 15.2C47.9 24 50 29.5 50 36.4 50 47.6 42 56 32 56s-18-8.4-18-19.6c0-6.3 2.6-11.2 6.3-15.4.6 3.3 2.3 5.6 4.9 6.6-1.9-8.4 2.6-16.5 6.8-24.1Z" fill={`url(#${id}-body)`} />
          {/* Hot core. */}
          <ellipse cx="32" cy="42" rx="14" ry="13" fill={`url(#${id}-core)`} />
          {!small && (
            <>
              {/* Rim light along the left edge, and a glossy highlight. */}
              <path d="M27.6 12.5c-3.6 6-8.2 12-9.8 18.6-.9 3.6-.9 7.4.2 10.8" fill="none" stroke="white" strokeOpacity="0.38" strokeWidth="1.4" strokeLinecap="round" />
              <ellipse cx="23.6" cy="27" rx="2.2" ry="4.2" transform="rotate(24 23.6 27)" fill="white" opacity="0.32" />
            </>
          )}

          {/* Cheeks. */}
          <ellipse cx="21.8" cy="45" rx="3.4" ry="2.1" fill="#ff6f91" opacity="0.42" />
          <ellipse cx="42.2" cy="45" rx="3.4" ry="2.1" fill="#ff6f91" opacity="0.42" />

          {/* Face. */}
          <g stroke="var(--ember-eye)" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Brows carry the expression. */}
            {!small && mood === "thinking" && <path d="M23 32.6q3.4-2.4 6.6-.8M35 34.2h6" strokeWidth="1.6" />}
            {!small && mood === "surprised" && <path d="M23 32q3.3-2.6 6.6-.6M34.4 31.4q3.3-2 6.6.6" strokeWidth="1.6" />}
            {mood === "happy" ? (
              <>
                <path d="M23.2 40.4q3.3-4.4 6.6 0M34.2 40.4q3.3-4.4 6.6 0" strokeWidth="2.5" />
                {/* Open smile with a little tongue. */}
                <path d="M27 45.4q5 6.6 10 0Z" fill="var(--ember-eye)" strokeWidth="1.6" />
                {!small && <path d="M29.6 48.6q2.4-1.6 4.8 0q-2.4 1.6-4.8 0Z" fill="#ff6f91" stroke="none" />}
              </>
            ) : mood === "sleepy" ? (
              <>
                <path d="M23.4 40.2q3.2 2.4 6.4 0M34.2 40.2q3.2 2.4 6.4 0" strokeWidth="2.3" />
                <path d="M30 47.4q2 1.2 4 0" strokeWidth="2" />
              </>
            ) : (
              <>
                <g className="ember-eyes" stroke="none">
                  <ellipse cx="26.6" cy={eyeY} rx="3.1" ry={eyeRy} fill={`url(#${id}-eye)`} />
                  <ellipse cx="37.4" cy={eyeY} rx="3.1" ry={eyeRy} fill={`url(#${id}-eye)`} />
                  <circle cx={mood === "thinking" ? 27.9 : 27.6} cy={eyeY - 1.6} r="1.25" fill="var(--ember-glint, white)" />
                  <circle cx={mood === "thinking" ? 38.7 : 38.4} cy={eyeY - 1.6} r="1.25" fill="var(--ember-glint, white)" />
                  {!small && <circle cx="25.6" cy={eyeY + 1.6} r="0.55" fill="var(--ember-glint, white)" opacity="0.8" />}
                  {!small && <circle cx="36.4" cy={eyeY + 1.6} r="0.55" fill="var(--ember-glint, white)" opacity="0.8" />}
                </g>
                {mood === "surprised" ? <ellipse cx="32" cy="48.4" rx="2.1" ry="2.6" fill="var(--ember-eye)" stroke="none" /> : mood === "thinking" ? <path d="M29.6 47.4q2.6-.9 5 .3" strokeWidth="2" /> : <path d="M28.4 46.2q3.6 3.2 7.2 0" strokeWidth="2.3" />}
              </>
            )}
          </g>
        </g>

        {/* Sparks orbiting (faster while thinking). */}
        <g className="ember-sparks" fill="var(--ember-a)">
          <path d="M54 12l1.2 2.9 2.9 1.2-2.9 1.2L54 20.2l-1.2-2.9-2.9-1.2 2.9-1.2Z" />
          <path d="M8.5 24l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8Z" opacity="0.85" />
          <circle cx="56" cy="40" r="1.2" opacity="0.7" />
        </g>
        {/* Embers rising off the flame. */}
        {!small && (
          <g className="ember-rise" fill="var(--ember-a)">
            <circle cx="24" cy="12" r="1" />
            <circle cx="40" cy="8" r="0.8" />
            <circle cx="33" cy="4" r="0.7" />
          </g>
        )}
        {mood === "sleepy" && (
          <g className="ember-zz" fill="var(--ember-b)" fontFamily="var(--font-sans)" fontWeight="700">
            <text x="46" y="14" fontSize="9">z</text>
            <text x="53" y="7" fontSize="6">z</text>
          </g>
        )}
      </svg>
    </span>
  );
}
