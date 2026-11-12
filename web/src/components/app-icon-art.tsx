import { BrandMark } from "@/components/brand-mark";

// The Brazework app icon, drawn for ImageResponse: the mark with its brass seam on near-black, full
// bleed so iOS and Android can round or mask the corners themselves. One drawing for every size: the
// Home Screen icons (app/app-icon/[size]), Apple's touch icon (app/apple-icon.tsx) and /favicon.ico.
export function AppIconArt({ size }: { size: number }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 30% 20%, #27272a, #09090b 70%)" }}>
      <BrandMark size={Math.round(size * 0.56)} color="#fafafa" seam />
    </div>
  );
}
