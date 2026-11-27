import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";
import { proofBadge } from "@/lib/proof-card";
import { loadProof } from "@/lib/proof-public";

export const alt = "A result on Brazework, signed by someone who saw it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The proof card as a picture (Linear FIX-128): what LinkedIn, X, iMessage and Slack show for /p/<id>,
// and what "Download image" saves. The result, who made it, and who stands behind it.
export default async function ProofImage({ params }: { params: Promise<{ id: string }> }) {
  const p = await loadProof((await params).id);
  const signed = p?.level === "signed";
  const tone = signed ? { bg: "#e7f4ea", fg: "#15803d" } : p?.level === "waiting" ? { bg: "#f1eee7", fg: "#5f5e5a" } : { bg: "#e7f0fd", fg: "#2563eb" };
  const title = p ? (p.title.length > 80 ? `${p.title.slice(0, 79)}…` : p.title) : "Your work, signed by the people who saw it.";
  const fs = title.length > 50 ? 64 : 78;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#fbfbfa", color: "#1f1f1d", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600 }}><BrandMark size={44} color="#1f1f1d" seam /> Brazework</div>
          {p && <div style={{ display: "flex", fontSize: 26, color: "#5f5e5a" }}>{p.project}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: fs, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.04 }}>{title}</div>
          {p && <div style={{ display: "flex", marginTop: 34, alignSelf: "flex-start", fontSize: 28, fontWeight: 600, color: tone.fg, background: tone.bg, padding: "14px 22px", borderRadius: 16 }}>{proofBadge(p)}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontWeight: 600 }}>{p ? `${p.member.first} ${p.member.last}`.trim() : ""}</div>
            <div style={{ display: "flex", color: "#5f5e5a", fontSize: 24 }}>{p?.member.headline ?? ""}</div>
          </div>
          <div style={{ display: "flex", color: "#8a8984", fontSize: 24 }}>Signed by the people who saw it</div>
        </div>
      </div>
    ),
    size,
  );
}
