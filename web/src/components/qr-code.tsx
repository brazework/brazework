import { qrSvgPath } from "@/lib/verify-public";

// A QR code for a link, drawn as one SVG path in the current text colour on the surface colour, so it
// works in light and dark (and prints black on white). Renders on the server or the client.
export function QrCode({ value, size = 128, label, className }: { value: string; size?: number; label: string; className?: string }) {
  const qr = qrSvgPath(value);
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" className={className}>
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.d} fill="#111" />
    </svg>
  );
}
