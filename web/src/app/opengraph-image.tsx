import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

export const alt = "Brazework: where STEM clubs build, prove it and get hired.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview for iMessage, Slack, X and LinkedIn. Generated at build time.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#09090b", color: "#fafafa", fontFamily: "sans-serif", position: "relative" }}>
        {/* A soft light from above. An SVG gradient, not CSS: next/og draws radial-gradient(closest-side) as a hard-edged grey blob. */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <radialGradient id="glow">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="650" cy="90" rx="450" ry="350" fill="url(#glow)" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 600 }}>
          <BrandMark size={56} color="#fafafa" seam />
          Brazework
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>Proof of work</div>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1.1, color: "#8b8b94" }}>beats a résumé.</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa" }}>Home base for university STEM clubs · verified work that gets you hired</div>
      </div>
    ),
    size,
  );
}
