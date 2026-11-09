import { cn } from "@/lib/forge";

// Ember: Forge's character, a small spark (Forge is where sparks fly). It's the face of Copilot and
// shows up wherever the app talks to you: the feed hero, the guide, empty and waiting states.
// Pure SVG + CSS (no JavaScript), coloured by the active theme through --ember-a/--ember-b
// (globals.css), so it matches every skin and renders on the server.

export type EmberMood = "idle" | "thinking" | "happy" | "sleepy" | "surprised";

export function Ember({ mood = "idle", size = 48, className, label }: { mood?: EmberMood; size?: number; className?: string; label?: string }) {
  const id = `ember-${mood}-${size}`;
  return (
    <span className={cn("ember inline-block shrink-0", `ember-${mood}`, className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 64 64" className="ember-body block size-full overflow-visible">
        <defs>
          <linearGradient id={`${id}-g`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="var(--ember-a)" />
            <stop offset="1" stopColor="var(--ember-b)" />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="0.5" cy="0.62" r="0.5">
            <stop offset="0" stopColor="white" stopOpacity="var(--ember-glow, 0.55)" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Soft shadow on the "ground"; it shrinks as Ember floats up. */}
        <ellipse className="ember-shadow" cx="32" cy="61" rx="11" ry="2.2" fill="var(--ember-b)" opacity="0.22" />
        <g className="ember-float">
          {/* Body: a rounded flame with a little curl at the tip. */}
          <path d="M32 3.5c2.6 6.4 7.7 10.2 11.6 15.2C47.9 24 50 29.5 50 36.4 50 47.6 42 56 32 56s-18-8.4-18-19.6c0-6.3 2.6-11.2 6.3-15.4.6 3.3 2.3 5.6 4.9 6.6-1.9-8.4 2.6-16.5 6.8-24.1Z" fill={`url(#${id}-g)`} />
          {/* Inner light. */}
          <path d="M32 22c4.8 5 9 9.3 9 16 0 6.6-4 11.5-9 11.5s-9-4.9-9-11.5c0-3.7 1.6-6.6 3.8-9 .5 2 1.6 3.3 3.2 3.9-.9-4.2.4-7.6 2-10.9Z" fill={`url(#${id}-glow)`} />
          {/* Cheeks. */}
          <ellipse cx="22.5" cy="44" rx="3.2" ry="2" fill="#ff7a9a" opacity="0.38" />
          <ellipse cx="41.5" cy="44" rx="3.2" ry="2" fill="#ff7a9a" opacity="0.38" />
          {/* Face. */}
          <g fill="var(--ember-eye)" stroke="var(--ember-eye)" strokeLinecap="round" strokeLinejoin="round">
            {mood === "happy" ? (
              <>
                <path d="M23.5 40.5q3-4 6 0M34.5 40.5q3-4 6 0" fill="none" strokeWidth="2.4" />
                <path d="M27.5 46q4.5 4.5 9 0" fill="none" strokeWidth="2.2" />
              </>
            ) : mood === "sleepy" ? (
              <>
                <path d="M23.5 40q3 2.2 6 0M34.5 40q3 2.2 6 0" fill="none" strokeWidth="2.2" />
                <path d="M30 47q2 1 4 0" fill="none" strokeWidth="2" />
              </>
            ) : (
              <>
                <g className="ember-eyes">
                  <ellipse cx="26.5" cy={mood === "thinking" ? 38.6 : 40} rx="2.9" ry={mood === "surprised" ? 4.4 : 3.6} stroke="none" />
                  <ellipse cx="37.5" cy={mood === "thinking" ? 38.6 : 40} rx="2.9" ry={mood === "surprised" ? 4.4 : 3.6} stroke="none" />
                  <circle cx={mood === "thinking" ? 27.6 : 27.4} cy={mood === "thinking" ? 37 : 38.6} r="1" fill="var(--ember-glint, white)" stroke="none" />
                  <circle cx={mood === "thinking" ? 38.6 : 38.4} cy={mood === "thinking" ? 37 : 38.6} r="1" fill="var(--ember-glint, white)" stroke="none" />
                </g>
                {mood === "surprised" ? <ellipse cx="32" cy="48" rx="2" ry="2.4" stroke="none" /> : mood === "thinking" ? <path d="M29.5 47.2h5" fill="none" strokeWidth="2" /> : <path d="M28.5 46.2q3.5 3 7 0" fill="none" strokeWidth="2.2" />}
              </>
            )}
          </g>
        </g>
        {/* Sparks orbiting (faster while thinking). */}
        <g className="ember-sparks" fill="var(--ember-a)">
          <path d="M53 14l1.2 2.8L57 18l-2.8 1.2L53 22l-1.2-2.8L49 18l2.8-1.2Z" />
          <circle cx="9" cy="22" r="1.6" />
          <circle cx="55" cy="40" r="1.2" opacity="0.8" />
        </g>
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
