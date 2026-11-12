// The Brazework mark: a peak in two halves, brazed together. Brazing joins two metals into one piece
// stronger than either alone (docs/naming.md), and the filler that does it is brass.
// Mono by default: the seam is the gap between the halves and the halves take the text colour. `seam`
// fills the gap with brass, for icons and the share card. No hooks or imports, so next/og can draw it too.
// The same shapes, by hand: app/icon.svg and ios/scripts/make-icon.swift. Change all three together.
export const BRASS = { from: "#f28c28", to: "#ffd479" } as const;

const HALVES = "M14.2 6 V26.5 H4.5 Z M17.8 6 L27.5 26.5 H17.8 Z";

export function BrandMark({ size = 24, color = "currentColor", seam = false }: { size?: number; color?: string; seam?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {seam && (
        <defs>
          <linearGradient id="bw-brass" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={BRASS.from} />
            <stop offset="1" stopColor={BRASS.to} />
          </linearGradient>
        </defs>
      )}
      <path d={HALVES} fill={color} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {seam && <rect x="15.1" y="4.6" width="1.8" height="22.7" fill="url(#bw-brass)" />}
    </svg>
  );
}
