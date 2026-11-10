import { ImageResponse } from "next/og";

export const alt = "Brazework: where STEM clubs build, prove it and get hired.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview for iMessage, Slack, X and LinkedIn. Generated at build time.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#09090b", color: "#fafafa", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", left: 200, top: -260, width: 900, height: 700, borderRadius: 9999, background: "radial-gradient(closest-side, rgba(255,255,255,0.14), rgba(9,9,11,0))", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 600 }}>
          <svg width="52" height="52" viewBox="0 0 28 28" fill="none">
            <path d="M4 22 L14 4 L24 22 Z" stroke="#fafafa" strokeWidth="2" strokeLinejoin="round" />
            <path d="M9 22 L14 13 L19 22" stroke="#fafafa" strokeWidth="2" strokeLinejoin="round" />
          </svg>
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
