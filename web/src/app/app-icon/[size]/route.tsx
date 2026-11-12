import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/app-icon-art";

// Home Screen icons for the installed web app (manifest.ts): /app-icon/192, /app-icon/512 (and 180,
// kept for links saved before app/apple-icon.tsx took over).
const SIZES = new Set([180, 192, 512]);

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIconArt size={size} />, { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } });
}
