import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

// Home Screen icons for the installed web app (manifest.ts): the Brazework mark, brass seam and all, on near-black, full
// bleed so iOS and Android can round or mask the corners themselves. /app-icon/192, /app-icon/512.
const SIZES = new Set([180, 192, 512]);

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const mark = Math.round(size * 0.56);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 30% 20%, #27272a, #09090b 70%)" }}>
        <BrandMark size={mark} color="#fafafa" seam />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
