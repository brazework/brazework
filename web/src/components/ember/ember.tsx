import { cn } from "@/lib/forge";

// Ember: Forge's character, a small robot with an ember for a heart (Forge is where sparks fly). It's
// the face of Copilot and shows up wherever the app talks to you: the feed's create box, the guide,
// empty and waiting states. Pure SVG + CSS (no JavaScript), so it renders on the server.
//
// A pearl-white shell lit from the top left, a dark glass visor with LED eyes, and an ember glowing
// in its antenna and chest. The LEDs and ember take --ember-a/--ember-b (globals.css), so they
// follow the skin; the shell and visor stay the same everywhere.

export type EmberMood = "idle" | "thinking" | "happy" | "sleepy" | "surprised";

const HEAD = { x: 11, y: 12, w: 42, h: 32, r: 14 };
const VISOR = { x: 16, y: 18, w: 32, h: 21, r: 10 };
const EYE_Y = 28.5;

export function Ember({ mood = "idle", size = 48, className, label }: { mood?: EmberMood; size?: number; className?: string; label?: string }) {
  const id = `ember-${mood}-${size}`;
  const small = size < 36; // tiny Embers drop the fine detail so they stay crisp
  const led = "var(--ember-a)";
  return (
    <span className={cn("ember inline-block shrink-0", `ember-${mood}`, className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 64 64" className="block size-full overflow-visible">
        <defs>
          {/* Shell: pearl white lit from the top left, cooling to grey at the far edge. */}
          <radialGradient id={`${id}-shell`} cx="0.32" cy="0.22" r="0.95">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#f0f2f6" />
            <stop offset="0.82" stopColor="#d3d8e1" />
            <stop offset="1" stopColor="#b6bdc9" />
          </radialGradient>
          <linearGradient id={`${id}-visor`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#232838" />
            <stop offset="1" stopColor="#06080d" />
          </linearGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="white" stopOpacity="0" />
          </linearGradient>
          {/* The ember: hot centre, theme colours outward. */}
          <radialGradient id={`${id}-ember`} cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stopColor="color-mix(in oklab, var(--ember-a) 40%, white)" />
            <stop offset="0.45" stopColor="var(--ember-a)" />
            <stop offset="1" stopColor="var(--ember-b)" />
          </radialGradient>
          <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="var(--ember-a)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--ember-a)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="var(--ember-b)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--ember-b)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-ground`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="black" stopOpacity="0.24" />
            <stop offset="1" stopColor="black" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-led`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.9" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id={`${id}-head`}><rect x={HEAD.x} y={HEAD.y} width={HEAD.w} height={HEAD.h} rx={HEAD.r} /></clipPath>
          <clipPath id={`${id}-visor-clip`}><rect x={VISOR.x} y={VISOR.y} width={VISOR.w} height={VISOR.h} rx={VISOR.r} /></clipPath>
        </defs>

        {/* Soft glow behind, and a contact shadow so it sits on the page. */}
        {!small && <circle className="ember-halo" cx="32" cy="34" r="30" fill={`url(#${id}-halo)`} />}
        <ellipse className="ember-shadow" cx="32" cy="61.6" rx="13" ry="2.2" fill={`url(#${id}-ground)`} />

        <g className="ember-float">
          {/* Body: a small torso with arms and the ember in its chest. */}
          <rect x="27" y="42.5" width="10" height="4.5" rx="1.5" fill="#9aa3b2" />
          <g className="ember-arm-l"><ellipse cx="16.6" cy="51.4" rx="2.7" ry="4.4" transform="rotate(14 16.6 51.4)" fill={`url(#${id}-shell)`} stroke="#0b1020" strokeOpacity={small ? 0.32 : 0.14} strokeWidth="0.8" /></g>
          <g className="ember-arm-r"><ellipse cx="47.4" cy="51.4" rx="2.7" ry="4.4" transform="rotate(-14 47.4 51.4)" fill={`url(#${id}-shell)`} stroke="#0b1020" strokeOpacity={small ? 0.32 : 0.14} strokeWidth="0.8" /></g>
          <rect x="19" y="45.5" width="26" height="13.5" rx="6.75" fill={`url(#${id}-shell)`} stroke="#0b1020" strokeOpacity={small ? 0.32 : 0.14} strokeWidth="0.8" />
          {!small && <circle cx="32" cy="52.2" r="5" fill={`url(#${id}-glow)`} />}
          <circle className="ember-core" cx="32" cy="52.2" r="2.5" fill={`url(#${id}-ember)`} />

          {/* Antenna, topped with the ember. */}
          <path d="M32 12.5V8.4" stroke="#9aa3b2" strokeWidth="1.6" strokeLinecap="round" />
          <g className="ember-orb">
            {!small && <circle cx="32" cy="5.6" r="6" fill={`url(#${id}-glow)`} />}
            <circle cx="32" cy="5.6" r="3.2" fill={`url(#${id}-ember)`} />
            {!small && <circle cx="30.9" cy="4.5" r="0.9" fill="white" opacity="0.8" />}
          </g>

          {/* Ear pods. */}
          <rect x="7" y="23" width="5.5" height="11" rx="2.75" fill="color-mix(in oklab, var(--ember-a) 45%, var(--ember-b))" />
          <rect x="51.5" y="23" width="5.5" height="11" rx="2.75" fill="color-mix(in oklab, var(--ember-a) 45%, var(--ember-b))" />

          {/* Head: shell, shade along the bottom, hairline edge and a gloss highlight. */}
          <rect x={HEAD.x} y={HEAD.y} width={HEAD.w} height={HEAD.h} rx={HEAD.r} fill={`url(#${id}-shell)`} />
          <g clipPath={`url(#${id}-head)`}>
            <ellipse cx="38" cy="47" rx="26" ry="8" fill="#0b1020" opacity="0.08" />
            {!small && <ellipse cx="20" cy="15.5" rx="7" ry="2.6" transform="rotate(-18 20 15.5)" fill="white" opacity="0.9" />}
          </g>
          <rect x={HEAD.x} y={HEAD.y} width={HEAD.w} height={HEAD.h} rx={HEAD.r} fill="none" stroke="#0b1020" strokeOpacity={small ? 0.32 : 0.14} strokeWidth="0.8" />

          {/* Visor: dark glass with a sheen, and the LED face behind it. */}
          <rect className="ember-visor" x={VISOR.x} y={VISOR.y} width={VISOR.w} height={VISOR.h} rx={VISOR.r} fill={`url(#${id}-visor)`} />
          <g className="ember-visor-led" filter={small ? undefined : `url(#${id}-led)`} stroke={led} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {mood === "happy" ? (
              <>
                <path d="M22.8 29.6q2.7-3.8 5.4 0M35.8 29.6q2.7-3.8 5.4 0" strokeWidth="2.2" />
                <path d="M28 33.2q4 3.6 8 0" strokeWidth="1.8" />
              </>
            ) : mood === "sleepy" ? (
              <>
                <path d="M23 29.2h5M36 29.2h5" strokeWidth="1.9" />
                <path d="M30.4 34.2h3.2" strokeWidth="1.5" />
              </>
            ) : mood === "surprised" ? (
              <>
                <g className="ember-eyes" stroke="none" fill={led}>
                  <circle cx="25.5" cy={EYE_Y} r="3.4" />
                  <circle cx="38.5" cy={EYE_Y} r="3.4" />
                </g>
                <ellipse cx="32" cy="34.6" rx="1.5" ry="1.7" strokeWidth="1.4" />
              </>
            ) : (
              <>
                <g className="ember-look">
                  <g className="ember-eyes" stroke="none" fill={led}>
                    <rect x={mood === "thinking" ? 24.3 : 23.2} y={mood === "thinking" ? 24.2 : 25} width="4.6" height="7" rx="2.3" />
                    <rect x={mood === "thinking" ? 37.3 : 36.2} y={mood === "thinking" ? 24.2 : 25} width="4.6" height={mood === "thinking" ? 5.6 : 7} rx="2.3" />
                  </g>
                </g>
                {mood === "thinking" ? <path d="M30 34.4h4.4" strokeWidth="1.5" /> : <path d="M28.6 33.4q3.4 2.6 6.8 0" strokeWidth="1.7" />}
              </>
            )}
          </g>
          {/* Cheek LEDs and the glass sheen over everything. */}
          {!small && mood !== "sleepy" && (
            <g fill="#ff6f91" opacity="0.4">
              <ellipse cx="20.6" cy="34" rx="2" ry="1.1" />
              <ellipse cx="43.4" cy="34" rx="2" ry="1.1" />
            </g>
          )}
          <g clipPath={`url(#${id}-visor-clip)`}>
            <path d="M16 18h17l-10 21h-7Z" fill={`url(#${id}-sheen)`} />
          </g>
        </g>

        {/* Two sparkles orbiting (faster while thinking), and sparks rising off the antenna. */}
        {!small && (
          <g className="ember-sparks" fill="var(--ember-a)">
            <path d="M56 8l1.1 2.7 2.7 1.1-2.7 1.1L56 15.6l-1.1-2.7-2.7-1.1 2.7-1.1Z" />
            <path d="M7 12l.7 1.7 1.7.7-1.7.7L7 16.8l-.7-1.7-1.7-.7 1.7-.7Z" opacity="0.8" />
          </g>
        )}
        {!small && (
          <g className="ember-rise" fill="var(--ember-a)">
            <circle cx="29.6" cy="2" r="0.8" />
            <circle cx="34.6" cy="1" r="0.65" />
            <circle cx="32" cy="-1" r="0.55" />
          </g>
        )}
        {mood === "sleepy" && (
          <g className="ember-zz" fill="var(--ember-b)" fontFamily="var(--font-sans)" fontWeight="700">
            <text x="47" y="11" fontSize="9">z</text>
            <text x="54" y="4" fontSize="6">z</text>
          </g>
        )}
      </svg>
    </span>
  );
}
