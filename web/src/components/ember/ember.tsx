import { cn } from "@/lib/forge";

// Ember: Forge's character, a small living flame (Forge is where sparks fly). It's the face of
// Copilot and shows up wherever the app talks to you: the feed's create box, the guide, empty and
// waiting states. Pure SVG + CSS (no JavaScript), coloured through --ember-a/--ember-b (globals.css),
// so it renders on the server and follows the skin.
//
// One clean silhouette given volume by light, not by extra shapes: a body lit from the top left,
// shade pooled at the bottom right, a hairline edge, a warm core and a glossy highlight.

export type EmberMood = "idle" | "thinking" | "happy" | "sleepy" | "surprised";

const BODY = "M32 3.5c2.6 6.4 7.7 10.2 11.6 15.2C47.9 24 50 29.5 50 36.4 50 47.6 42 56 32 56s-18-8.4-18-19.6c0-6.3 2.6-11.2 6.3-15.4.6 3.3 2.3 5.6 4.9 6.6-1.9-8.4 2.6-16.5 6.8-24.1Z";

export function Ember({ mood = "idle", size = 48, className, label }: { mood?: EmberMood; size?: number; className?: string; label?: string }) {
  const id = `ember-${mood}-${size}`;
  const small = size < 36; // tiny Embers drop the fine detail so they stay crisp
  const eyeY = mood === "thinking" ? 38.6 : 39.8;
  const eyeRy = mood === "surprised" ? 4.8 : 4.2;
  const glint = "var(--ember-glint, white)";
  return (
    <span className={cn("ember inline-block shrink-0", `ember-${mood}`, className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 64 64" className="block size-full overflow-visible">
        <defs>
          {/* Lit from the top left: highlight, the flame's colour, then its deeper tone at the edge. */}
          <radialGradient id={`${id}-body`} cx="0.36" cy="0.3" r="0.8">
            <stop offset="0" stopColor="color-mix(in oklab, var(--ember-a) 55%, white)" />
            <stop offset="0.38" stopColor="var(--ember-a)" />
            <stop offset="0.78" stopColor="color-mix(in oklab, var(--ember-a) 30%, var(--ember-b))" />
            <stop offset="1" stopColor="var(--ember-b)" />
          </radialGradient>
          <radialGradient id={`${id}-shade`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="color-mix(in oklab, var(--ember-b) 60%, black)" stopOpacity="0.5" />
            <stop offset="1" stopColor="color-mix(in oklab, var(--ember-b) 60%, black)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-core`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="white" stopOpacity="var(--ember-glow, 0.6)" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-gloss`} cx="0.5" cy="0.35" r="0.6">
            <stop offset="0" stopColor="white" stopOpacity="0.85" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-cheek`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff6f91" stopOpacity="0.6" />
            <stop offset="1" stopColor="#ff6f91" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="var(--ember-b)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--ember-b)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-ground`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="black" stopOpacity="0.22" />
            <stop offset="1" stopColor="black" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${id}-clip`}><path d={BODY} /></clipPath>
        </defs>

        {/* Soft glow behind, and a contact shadow so it sits on the page. */}
        {!small && <circle className="ember-halo" cx="32" cy="36" r="30" fill={`url(#${id}-halo)`} />}
        <ellipse className="ember-shadow" cx="32" cy="60.5" rx="13" ry="2.4" fill={`url(#${id}-ground)`} />

        <g className="ember-float">
          <path d={BODY} fill={`url(#${id}-body)`} />
          <g clipPath={`url(#${id}-clip)`}>
            {/* Shade pooled at the bottom right, and the warm core low in the flame. */}
            <ellipse cx="44" cy="52" rx="18" ry="14" fill={`url(#${id}-shade)`} />
            <ellipse cx="31" cy="50" rx="13" ry="8" fill={`url(#${id}-core)`} />
          </g>
          {/* Hairline edge: keeps the shape crisp on light and dark pages. */}
          <path d={BODY} fill="none" stroke="color-mix(in oklab, var(--ember-b) 55%, black)" strokeOpacity="0.2" strokeWidth={small ? 1.4 : 1} />
          {/* Gloss: a soft highlight on the left shoulder and a sharp catch-light near the tip. */}
          <g clipPath={`url(#${id}-clip)`}>
            <ellipse cx="20.6" cy="35" rx="2.8" ry="6.4" transform="rotate(14 20.6 35)" fill={`url(#${id}-gloss)`} />
          </g>
          {!small && <circle cx="30.6" cy="13.4" r="1.2" fill="white" opacity="0.7" />}

          {/* Cheeks. */}
          <ellipse cx="21.4" cy="45.4" rx="4.2" ry="2.8" fill={`url(#${id}-cheek)`} />
          <ellipse cx="42.6" cy="45.4" rx="4.2" ry="2.8" fill={`url(#${id}-cheek)`} />

          {/* Face. */}
          <g stroke="var(--ember-eye)" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {!small && mood === "thinking" && <path d="M22.8 32.8q3.4-2.4 6.6-.8M35 34.4h6" strokeWidth="1.7" />}
            {!small && mood === "surprised" && <path d="M22.8 32q3.3-2.6 6.6-.6M34.6 31.4q3.3-2 6.6.6" strokeWidth="1.7" />}
            {mood === "happy" ? (
              <>
                <path d="M23 40.6q3.4-4.6 6.8 0M34.2 40.6q3.4-4.6 6.8 0" strokeWidth="2.6" />
                <path d="M27 45.6q5 6.8 10 0Z" fill="var(--ember-eye)" strokeWidth="1.6" />
                {!small && <path d="M29.6 48.8q2.4-1.6 4.8 0q-2.4 1.6-4.8 0Z" fill="#ff6f91" stroke="none" />}
              </>
            ) : mood === "sleepy" ? (
              <>
                <path d="M23.2 40.4q3.3 2.4 6.6 0M34.2 40.4q3.3 2.4 6.6 0" strokeWidth="2.4" />
                <path d="M30 47.6q2 1.2 4 0" strokeWidth="2" />
              </>
            ) : (
              <>
                <g className="ember-eyes" stroke="none">
                  <ellipse cx="26.4" cy={eyeY} rx="3.3" ry={eyeRy} fill="var(--ember-eye)" />
                  <ellipse cx="37.6" cy={eyeY} rx="3.3" ry={eyeRy} fill="var(--ember-eye)" />
                  <circle cx={mood === "thinking" ? 27.8 : 27.5} cy={eyeY - 1.7} r="1.4" fill={glint} />
                  <circle cx={mood === "thinking" ? 39 : 38.7} cy={eyeY - 1.7} r="1.4" fill={glint} />
                  {!small && <circle cx="25.4" cy={eyeY + 1.8} r="0.6" fill={glint} opacity="0.85" />}
                  {!small && <circle cx="36.6" cy={eyeY + 1.8} r="0.6" fill={glint} opacity="0.85" />}
                </g>
                {mood === "surprised" ? <ellipse cx="32" cy="48.6" rx="2.1" ry="2.6" fill="var(--ember-eye)" stroke="none" /> : mood === "thinking" ? <path d="M29.6 47.6q2.6-.9 5 .3" strokeWidth="2" /> : <path d="M28.4 46.4q3.6 3.2 7.2 0" strokeWidth="2.3" />}
              </>
            )}
          </g>
        </g>

        {/* Two sparkles orbiting (faster while thinking), and embers rising off the tip. */}
        {!small && (
          <g className="ember-sparks" fill="var(--ember-a)">
            <path d="M54 12l1.1 2.7 2.7 1.1-2.7 1.1L54 19.6l-1.1-2.7-2.7-1.1 2.7-1.1Z" />
            <path d="M9 26l.7 1.7 1.7.7-1.7.7L9 30.8l-.7-1.7-1.7-.7 1.7-.7Z" opacity="0.8" />
          </g>
        )}
        {!small && (
          <g className="ember-rise" fill="var(--ember-a)">
            <circle cx="25" cy="12" r="0.9" />
            <circle cx="39" cy="9" r="0.75" />
            <circle cx="33" cy="4" r="0.65" />
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
