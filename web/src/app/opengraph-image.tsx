import { ImageResponse } from "next/og";

export const alt = "Forge: proof of work beats a résumé. The professional network for STEM.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview for iMessage, Slack, X and LinkedIn. Generated at build time.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#07090c", color: "#e6eaf0", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", left: 200, top: -260, width: 900, height: 700, borderRadius: 9999, background: "radial-gradient(closest-side, rgba(255,77,26,0.45), rgba(7,9,12,0))", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 600 }}>
          <svg width="52" height="52" viewBox="0 0 28 28" fill="none">
            <path d="M4 22 L14 4 L24 22 Z" stroke="#ff7a2f" strokeWidth="2" strokeLinejoin="round" />
            <path d="M9 22 L14 13 L19 22" stroke="#ff7a2f" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Forge
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>Proof of work</div>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1.1, color: "#ff7a2f" }}>beats a résumé.</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#a9b3c1" }}>The professional network for STEM · built for university clubs</div>
      </div>
    ),
    size,
  );
}
