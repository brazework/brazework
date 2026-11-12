import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/app-icon-art";

// /favicon.ico, for the tools that ask for it by name (crawlers, bookmark and RSS apps, old browsers);
// pages link icon.svg. Drawn from the same mark as every other icon, so it can't drift from the logo:
// a 48 px PNG inside an ICO wrapper (one entry; every browser since IE11 reads PNG inside ICO).
const SIZE = 48;

export async function GET() {
  const png = Buffer.from(await new ImageResponse(<AppIconArt size={SIZE} />, { width: SIZE, height: SIZE }).arrayBuffer());
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(SIZE, 6); // width
  header.writeUInt8(SIZE, 7); // height
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14); // image size
  header.writeUInt32LE(22, 18); // image offset: right after this header
  return new Response(Buffer.concat([header, png]), { headers: { "Content-Type": "image/x-icon", "Cache-Control": "public, max-age=86400" } });
}
